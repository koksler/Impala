import glob
import ipaddress
import json
import os
import re
import shutil
import socket
import threading
import urllib.error
import urllib.request
import uuid
from datetime import datetime

import time

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, BackgroundTasks, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from plyfile import PlyData, PlyElement
from pydantic import BaseModel
import subprocess

try:
    from ml_pipeline import run_nerfstudio_pipeline
    ML_SUPPORTED = True
except ImportError:
    ML_SUPPORTED = False
    print("ML Pipeline disabled: Nerfstudio or Torch not found. Running in Viewer/Export mode.")

from routers.exporter import router as exporter_router
from routers.blender import router as blender_router

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL   = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
UPLOAD_DIR = os.path.abspath("uploads")
EXPORT_DIR = os.path.abspath("exports")
PROJECTS_FILE = os.path.abspath(os.path.join("data", "projects.json"))

for _d in (EXPORT_DIR, UPLOAD_DIR, "projects_assets", "data"):
    os.makedirs(_d, exist_ok=True)

# ---------------------------------------------------------------------------
# Allowed extensions for user-uploaded 3-D model assets
# ---------------------------------------------------------------------------
_ALLOWED_MODEL_EXTENSIONS = {
    ".glb", ".gltf", ".obj", ".fbx", ".ply", ".usdz", ".stl",
}

# ---------------------------------------------------------------------------
# Thread lock — protects all reads + writes to projects.json
# ---------------------------------------------------------------------------
_projects_lock = threading.Lock()

# ---------------------------------------------------------------------------
# In-memory pipeline status
# ---------------------------------------------------------------------------
project_status_db: dict = {}

# Short-lived cache for GET /api/projects/{id}/status so that rapid-fire
# frontend polling doesn't cause unnecessary work. Value: (payload, timestamp).
_STATUS_CACHE_TTL = 1.5  # seconds
_status_cache: dict[str, tuple[dict, float]] = {}

# ---------------------------------------------------------------------------
# UUID validation
# ---------------------------------------------------------------------------
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


def _assert_uuid(value: str) -> str:
    """Return lower-cased UUID or raise HTTPException 400."""
    if not _UUID_RE.match(value):
        raise HTTPException(status_code=400, detail="Invalid project ID format.")
    return value.lower()


# ---------------------------------------------------------------------------
# Path-safety helpers
# ---------------------------------------------------------------------------

def is_safe_path(base_dir: str, target_path: str) -> bool:
    abs_base   = os.path.realpath(os.path.abspath(base_dir))
    abs_target = os.path.realpath(os.path.abspath(target_path))
    return os.path.commonpath([abs_base, abs_target]) == abs_base


def _safe_join(base: str, *parts: str) -> str:
    """Join paths and raise HTTPException 400 on traversal."""
    target = os.path.realpath(os.path.join(base, *parts))
    base_r = os.path.realpath(base)
    if os.path.commonpath([base_r, target]) != base_r:
        raise HTTPException(status_code=400, detail="Invalid path.")
    return target


# ---------------------------------------------------------------------------
# SSRF protection for /api/link-asset
# ---------------------------------------------------------------------------

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local / cloud metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _is_private_ip(host: str) -> bool:
    try:
        addr = ipaddress.ip_address(socket.gethostbyname(host))
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except Exception:
        return True   # fail closed


def _validate_external_url(url: str) -> None:
    """
    Raise HTTPException 400 if *url* is not a safe, public HTTPS resource.
    Blocks non-HTTPS schemes and private/loopback IP ranges.
    """
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed URL.")

    if parsed.scheme not in ("https",):
        raise HTTPException(
            status_code=400,
            detail="Only HTTPS URLs are accepted for linked assets.",
        )

    host = parsed.hostname or ""
    if not host:
        raise HTTPException(status_code=400, detail="URL has no host.")

    if _is_private_ip(host):
        raise HTTPException(
            status_code=400,
            detail="URL resolves to a private or reserved address.",
        )


# ---------------------------------------------------------------------------
# projects.json helpers (all calls must hold _projects_lock)
# ---------------------------------------------------------------------------

def _read_projects() -> list:
    """Return the current project list; initialises the file if absent."""
    if not os.path.exists(PROJECTS_FILE):
        return []
    try:
        with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
        if not content:
            return []
        return json.loads(content)
    except Exception as e:
        print(f"[projects.json] Read error: {e}")
        return []


def _write_projects(projects: list) -> None:
    with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
        json.dump(projects, f, indent=4)


# ---------------------------------------------------------------------------
# ffprobe helpers
# ---------------------------------------------------------------------------

def get_video_framerate(video_path: str) -> str:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=1", video_path,
    ]
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, text=True, check=True)
        return result.stdout.strip() or "25"
    except Exception:
        return "25"


def get_video_total_frames(video_path: str) -> int:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=nb_frames",
        "-of", "default=noprint_wrappers=1:nokey=1", video_path,
    ]
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, text=True, check=True)
        raw = result.stdout.strip()
        if not raw or raw.upper() == "N/A":
            print(f"[ffprobe] nb_frames returned {raw!r} for {video_path!r}; will use fallback.")
            return 0
        return int(raw)
    except ValueError as e:
        print(f"[ffprobe] Could not parse frame count for {video_path!r}: {e}")
        return 0
    except Exception as e:
        print(f"[ffprobe] Probe failed for {video_path!r}: {e}")
        return 0

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Impala Backend Core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # credentials=True + origins=* is invalid per spec
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exporter_router)
app.include_router(blender_router)


@app.middleware("http")
async def add_coop_coep_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return response


app.mount("/exports",          StaticFiles(directory=EXPORT_DIR),       name="exports")
app.mount("/projects_assets",  StaticFiles(directory="projects_assets"), name="projects_assets")
app.mount("/uploads",          StaticFiles(directory=UPLOAD_DIR),        name="uploads")


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@app.get("/api/status")
def get_status():
    return {"status": "online"}


# ---------------------------------------------------------------------------
# Upload & pipeline
# ---------------------------------------------------------------------------

@app.post("/api/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
):
    if not ML_SUPPORTED:
        raise HTTPException(
            status_code=501,
            detail="This server does not support CUDA training. Use 'Import Project' instead.",
        )

    project_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename or "")
    safe_filename = f"{project_id}{ext}"
    file_path = _safe_join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    project_status_db[project_id] = {"status": "starting", "progress": 0}
    background_tasks.add_task(background_pipeline, file_path, project_id, title)

    return {"status": "success", "project_id": project_id}


@app.get("/api/projects")
def get_projects():
    with _projects_lock:
        return _read_projects()


@app.get("/api/projects/{project_id}/status")
def get_project_status(project_id: str):
    _assert_uuid(project_id)

    now = time.monotonic()
    cached = _status_cache.get(project_id)
    if cached is not None and (now - cached[1]) < _STATUS_CACHE_TTL:
        return cached[0]

    result = project_status_db.get(project_id, {"status": "unknown", "progress": 0})
    _status_cache[project_id] = (result, now)
    return result


def background_pipeline(file_path: str, project_id: str, title: str):
    """Background task: run the ML pipeline then persist the result."""

    def _set_status(payload: dict) -> None:
        """Write to the status DB and immediately invalidate the cache."""
        project_status_db[project_id] = payload
        _status_cache.pop(project_id, None)

    def _progress(pct: int) -> None:
        current = project_status_db.get(project_id, {})
        _set_status({**current, "progress": pct})

    _set_status({"status": "processing", "progress": 10})

    total_frames = get_video_total_frames(file_path)
    if total_frames <= 0:
        total_frames = 1000

    target_frames = total_frames + 50 

    success = run_nerfstudio_pipeline(
        video_path=file_path,
        project_id=project_id,
        total_frames=target_frames, 
        progress_callback=_progress,
    )

    if success:
        _set_status({"status": "done", "progress": 100})
        upload_filename = os.path.basename(file_path)

        new_project = {
            "id": project_id,
            "title": title,
            "lastOpened": datetime.now().strftime("%Y-%m-%d"),
            "img": "/projects_assets/default_thumb.webp",
            "splat_url":               f"{BASE_URL}/exports/{project_id}/splat.ply",
            "proxy_url":               f"{BASE_URL}/exports/{project_id}/mesh.obj",
            "cameras_url":             f"{BASE_URL}/api/projects/{project_id}/cameras",
            "video_url":               f"{BASE_URL}/uploads/{upload_filename}",
            "dataparser_transforms_url": f"{BASE_URL}/api/projects/{project_id}/dataparser-transforms",
        }

        with _projects_lock:
            projects = _read_projects()
            projects.insert(0, new_project)
            _write_projects(projects)

        project_status_db[project_id]["project"] = new_project
        _status_cache.pop(project_id, None)
    else:
        _set_status({"status": "error", "progress": 0})


# ---------------------------------------------------------------------------
# Tracking / camera data
# ---------------------------------------------------------------------------

@app.get("/api/projects/{project_id}/tracking")
def get_project_tracking(project_id: str):
    _assert_uuid(project_id)
    path = _safe_join(os.path.abspath("processed_data"), project_id, "transforms.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"error": "Tracking data not found"}


@app.get("/api/projects/{project_id}/dataparser-transforms")
def get_dataparser_transforms(project_id: str):
    _assert_uuid(project_id)

    search_pattern = os.path.join(
        "outputs", project_id, "splatfacto", "*", "dataparser_transforms.json"
    )
    dp_paths = glob.glob(search_pattern)

    export_path = _safe_join(EXPORT_DIR, project_id, "dataparser_transforms.json")
    if os.path.exists(export_path):
        dp_paths.append(export_path)

    if not dp_paths:
        return {"error": "Dataparser transforms not found"}

    latest_dp = max(dp_paths, key=os.path.getmtime)
    with open(latest_dp, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/projects/{project_id}/cameras")
def get_project_cameras(project_id: str):
    _assert_uuid(project_id)

    poses_path  = _safe_join(os.path.abspath("exports"), project_id, "transforms_train.json")
    colmap_path = _safe_join(os.path.abspath("processed_data"), project_id, "transforms.json")

    cameras_raw = None
    if os.path.exists(poses_path):
        with open(poses_path, "r", encoding="utf-8") as f:
            cameras_raw = json.load(f)
    else:
        fallback = _safe_join(os.path.abspath("exports"), project_id, "cameras.json")
        if os.path.exists(fallback):
            with open(fallback, "r", encoding="utf-8") as f:
                cameras_raw = json.load(f)

    if isinstance(cameras_raw, list):
        frames = cameras_raw
    elif isinstance(cameras_raw, dict):
        frames = cameras_raw.get("frames") or cameras_raw.get("cameras") or list(cameras_raw.values())
    else:
        frames = []

    intrinsics: dict = {}

    if os.path.exists(colmap_path):
        with open(colmap_path, "r", encoding="utf-8") as f:
            colmap = json.load(f)
        for key in ("fl_x", "fl_y", "cx", "cy", "w", "h",
                    "camera_angle_x", "camera_angle_y", "camera_model"):
            if key in colmap and colmap[key] is not None:
                intrinsics[key] = colmap[key]

    # Enrich frames with their true index parsed from the filename (e.g. frame_00005.png)
    _frame_re = re.compile(r'frame_(\d+)')
    for idx, frm in enumerate(frames):
        fp = frm.get("file_path", "")
        m = _frame_re.search(fp)
        frm["frameIndex"] = (int(m.group(1)) - 1) if m else idx

    # Pull video stats for perfect sync
    total_frames_from_video = 0
    video_fps = 0.0

    with _projects_lock:
        projects = _read_projects()

    project = next((p for p in projects if p["id"] == project_id), None)

    if project and project.get("video_url"):
        video_filename = os.path.basename(project["video_url"])
        video_path = _safe_join(UPLOAD_DIR, video_filename)
        if os.path.exists(video_path):
            total_frames_from_video = get_video_total_frames(video_path)
            fps_str = get_video_framerate(video_path)
            if "/" in fps_str:
                num, den = fps_str.split("/", 1)
                try:
                    video_fps = float(num) / float(den)
                except (ValueError, ZeroDivisionError):
                    video_fps = 24.0
            else:
                try:
                    video_fps = float(fps_str)
                except ValueError:
                    video_fps = 24.0

    if isinstance(cameras_raw, dict):
        print(f"[DEBUG] cameras_raw is dict. Keys: {list(cameras_raw.keys())[:20]}")
        for key in ("fl_x", "fl_y", "cx", "cy", "w", "h",
                    "camera_angle_x", "camera_angle_y", "camera_model"):
            if key not in intrinsics and key in cameras_raw:
                intrinsics[key] = cameras_raw[key]

    if ("fl_y" not in intrinsics or "h" not in intrinsics) and frames:
        first_frame = frames[0]
        if isinstance(first_frame, dict):
            print(f"[DEBUG] first_frame keys: {list(first_frame.keys())}")
            for key in ("fl_x", "fl_y", "cx", "cy", "w", "h",
                        "camera_angle_x", "camera_angle_y"):
                if key not in intrinsics and key in first_frame:
                    intrinsics[key] = first_frame[key]

    # Last-resort: recover intrinsics from a linked project's colmap file
    if ("fl_y" not in intrinsics or "h" not in intrinsics) and frames:
        _proj_re = re.compile(r'processed_data[\\/]([a-f0-9\-]{36})', re.IGNORECASE)
        for frm in frames[:5]:
            fp = frm.get("file_path", "")
            m = _proj_re.search(fp)
            if m:
                other_id = m.group(1)
                if _UUID_RE.match(other_id):
                    other_colmap = _safe_join(
                        os.path.abspath("processed_data"), other_id, "transforms.json"
                    )
                    if os.path.exists(other_colmap):
                        print(f"[DEBUG] Recovering metadata from linked project: {other_id}")
                        with open(other_colmap, "r", encoding="utf-8") as other_f:
                            other_data = json.load(other_f)
                        for key in ("fl_x", "fl_y", "cx", "cy", "w", "h",
                                    "camera_angle_x", "camera_angle_y"):
                            if key not in intrinsics and key in other_data:
                                intrinsics[key] = other_data[key]
                        break

    print(f"[DEBUG] Final intrinsics: {intrinsics}")
    return {
        "frames": frames,
        "total_frames": total_frames_from_video,
        "fps": video_fps,
        **intrinsics,
    }


# ---------------------------------------------------------------------------
# Project settings / model upload
# ---------------------------------------------------------------------------

class SaveSettings(BaseModel):
    objPos: list[float] | None = None
    objRot: list[float] | None = None
    objScale: list[float] | None = None
    scenePos: list[float] | None = None
    sceneRot: list[float] | None = None
    sceneScale: list[float] | None = None
    shadowOpacity: float | None = None
    shadowBlur: float | None = None
    shadowColor: str | None = None
    matRoughness: float | None = None
    matMetallic: float | None = None
    envIntensity: float | None = None
    envRotation: float | None = None
    envTint: str | None = None
    customModelUrl: str | None = None
    customModelName: str | None = None
    customModels: list[dict] | None = None
    activeModelId: str | None = None
    savedSplatUrl: str | None = None


@app.post("/api/projects/{project_id}/save")
def save_project_settings(project_id: str, settings: SaveSettings):
    _assert_uuid(project_id)

    with _projects_lock:
        projects = _read_projects()
        project = next((p for p in projects if p["id"] == project_id), None)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")

        project.update(settings.model_dump(exclude_unset=True))
        project["lastOpened"] = datetime.now().strftime("%Y-%m-%d")
        _write_projects(projects)

    return {"status": "saved", "project_id": project_id}


@app.post("/api/projects/{project_id}/model")
async def upload_project_model(project_id: str, file: UploadFile = File(...)):
    _assert_uuid(project_id)

    # Sanitise filename and check extension against allowlist
    raw_name = os.path.basename(file.filename or "upload")
    _, ext = os.path.splitext(raw_name)
    if ext.lower() not in _ALLOWED_MODEL_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported model format {ext!r}. "
                   f"Allowed: {', '.join(sorted(_ALLOWED_MODEL_EXTENSIONS))}",
        )

    safe_filename = raw_name.replace(" ", "_")
    project_assets_dir = _safe_join(os.path.abspath("projects_assets"), project_id)
    os.makedirs(project_assets_dir, exist_ok=True)

    # We no longer delete old files to allow multiple models
    import uuid
    unique_filename = f"{uuid.uuid4().hex[:8]}_{safe_filename}"
    file_path = _safe_join(project_assets_dir, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "success",
        "url": f"{BASE_URL}/projects_assets/{project_id}/{unique_filename}",
        "name": file.filename,
    }


# ---------------------------------------------------------------------------
# Delete project
# ---------------------------------------------------------------------------

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    _assert_uuid(project_id)

    with _projects_lock:
        projects = _read_projects()
        project = next((p for p in projects if p["id"] == project_id), None)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")

        # 1. Remove upload file
        video_url = project.get("video_url")
        if video_url:
            upload_filename = os.path.basename(video_url)
            upload_path = _safe_join(UPLOAD_DIR, upload_filename)
            if os.path.exists(upload_path):
                try:
                    os.remove(upload_path)
                except OSError as e:
                    print(f"[delete] Could not remove upload: {e}")

        # 2. Remove directories
        safe_pid = project_id   # already validated as UUID above
        dirs_to_remove = [
            _safe_join(EXPORT_DIR,                          safe_pid),
            _safe_join(os.path.abspath("processed_data"),   safe_pid),
            _safe_join(os.path.abspath("projects_assets"),  safe_pid),
            _safe_join(os.path.abspath("outputs"),          safe_pid),
        ]

        for d in dirs_to_remove:
            if os.path.exists(d):
                try:
                    shutil.rmtree(d)
                    print(f"[delete] Removed directory: {d}")
                except OSError as e:
                    print(f"[delete] Could not remove {d}: {e}")

        # 3. Update projects.json
        projects = [p for p in projects if p["id"] != project_id]
        _write_projects(projects)

    # 4. Remove from in-memory status
    project_status_db.pop(project_id, None)

    return {"status": "deleted", "project_id": project_id}


# ---------------------------------------------------------------------------
# Link asset (external URL → pipeline)
# ---------------------------------------------------------------------------

class LinkAssetRequest(BaseModel):
    url: str
    title: str


def download_and_process(url: str, project_id: str, title: str) -> None:
    """Downloads an external file then kicks off the processing pipeline."""
    try:
        project_status_db[project_id] = {"status": "downloading", "progress": 5}

        from urllib.parse import urlparse
        parsed = urlparse(url)
        base_url = parsed._replace(query="", fragment="").geturl()
        potential_ext = os.path.splitext(base_url)[1]
        ext = potential_ext if (1 < len(potential_ext) < 6) else ".mp4"

        safe_filename = f"{project_id}{ext}"
        file_path = _safe_join(UPLOAD_DIR, safe_filename)

        print(f"[LINK] Downloading {url} to {file_path}...")

        # Build a one-off opener — never mutate the global default opener
        opener = urllib.request.build_opener()
        opener.addheaders = [("User-agent", "Mozilla/5.0")]
        with opener.open(url) as response, open(file_path, "wb") as out_f:
            shutil.copyfileobj(response, out_f)

        print("[LINK] Download complete. Starting pipeline...")
        background_pipeline(file_path, project_id, title)

    except Exception as e:
        print(f"[LINK] Error downloading asset: {e}")
        project_status_db[project_id] = {"status": "error", "progress": 0}


@app.post("/api/link-asset")
async def link_asset(background_tasks: BackgroundTasks, request: LinkAssetRequest):
    if not ML_SUPPORTED:
        raise HTTPException(
            status_code=501,
            detail="This server does not support CUDA training.",
        )

    # Validate URL before queuing the background task
    _validate_external_url(request.url)

    project_id = str(uuid.uuid4())
    project_status_db[project_id] = {"status": "starting", "progress": 0}

    background_tasks.add_task(download_and_process, request.url, project_id, request.title)

    return {"status": "success", "project_id": project_id}


# ---------------------------------------------------------------------------
# Cache / cleanup utilities
# ---------------------------------------------------------------------------

@app.post("/api/cache/clear")
def clear_cache():
    """Safely clear processed_data/ and uploads/ contents not in projects.json."""
    with _projects_lock:
        projects = _read_projects()

    if projects is None:
        return {"deleted_files": 0, "deleted_bytes": 0, "error": "Could not read projects file"}

    active_ids    = {str(p["id"]).lower() for p in projects if "id" in p}
    active_files  = {os.path.basename(p["video_url"]).lower()
                     for p in projects if p.get("video_url")}

    deleted_files = 0
    deleted_bytes = 0

    processed_dir = os.path.abspath("processed_data")
    if os.path.exists(processed_dir):
        for d in os.listdir(processed_dir):
            if d.lower() not in active_ids:
                path = os.path.join(processed_dir, d)
                if not os.path.isdir(path):
                    continue
                try:
                    bytes_size = sum(
                        os.path.getsize(os.path.join(dp, fn))
                        for dp, _, fns in os.walk(path)
                        for fn in fns
                    )
                    shutil.rmtree(path)
                    deleted_files += 1
                    deleted_bytes += bytes_size
                    print(f"[CACHE CLEAR] Removed processed_data/{d}")
                except OSError as e:
                    print(f"[CACHE CLEAR] Error removing {d}: {e}")

    if os.path.exists(UPLOAD_DIR):
        for fname in os.listdir(UPLOAD_DIR):
            if fname.lower() not in active_files:
                path = os.path.join(UPLOAD_DIR, fname)
                if os.path.isdir(path):
                    continue
                try:
                    size = os.path.getsize(path)
                    os.remove(path)
                    deleted_files += 1
                    deleted_bytes += size
                    print(f"[CACHE CLEAR] Removed uploads/{fname}")
                except OSError as e:
                    print(f"[CACHE CLEAR] Error removing upload {fname}: {e}")

    return {
        "status": "success",
        "deleted_files": deleted_files,
        "deleted_bytes": deleted_bytes,
    }


@app.post("/api/projects/cleanup")
def cleanup_projects():
    """Purge orphaned folders from exports/ and projects_assets/."""
    with _projects_lock:
        projects = _read_projects()

    active_ids = {str(p["id"]).lower() for p in projects if "id" in p}
    deleted_count = 0

    for base_dir in [EXPORT_DIR, "projects_assets", "outputs"]:
        if not os.path.exists(base_dir):
            continue
        for d in os.listdir(base_dir):
            full_path = os.path.join(base_dir, d)
            if not os.path.isdir(full_path):
                continue
            if d.lower() not in active_ids:
                try:
                    shutil.rmtree(full_path)
                    deleted_count += 1
                    print(f"[PURGE] Removed orphaned folder {base_dir}/{d}")
                except OSError as e:
                    print(f"[PURGE] Error removing {base_dir}/{d}: {e}")

    return {"status": "success", "deleted_files": deleted_count}


# ---------------------------------------------------------------------------
# Static UI (must be last — avoids shadowing API routes)
# ---------------------------------------------------------------------------

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "static"))
if os.path.exists(DIST_DIR):
    print(f"Production mode: Serving static files from {DIST_DIR}")
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")
else:
    print("Development mode: Serving API only.")