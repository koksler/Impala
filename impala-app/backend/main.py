from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import uuid
import json
from datetime import datetime
from ml_pipeline import run_nerfstudio_pipeline
import glob
import numpy as np
from plyfile import PlyData, PlyElement
from pydantic import BaseModel
import subprocess
from routers.exporter import router as exporter_router

def get_video_framerate(video_path: str) -> str:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=1", video_path
    ]
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, text=True, check=True)
        return result.stdout.strip()
    except Exception:
        return "25" # safe European fallback if ffprobe fails

app = FastAPI(title="Impala Backend Core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exporter_router)

UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
PROJECTS_FILE = os.path.join("data", "projects.json")
os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("projects_assets", exist_ok=True)
os.makedirs("data", exist_ok=True)

app.mount("/exports", StaticFiles(directory=EXPORT_DIR), name="exports")
app.mount("/projects_assets", StaticFiles(directory="projects_assets"), name="projects_assets")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if not os.path.exists(PROJECTS_FILE):
    with open(PROJECTS_FILE, "w") as f:
        json.dump([], f)
        
project_status_db = {}

@app.get("/api/status")
def get_status():
    return {"status": "online"}

@app.post("/api/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...), title: str = Form(...)):
    project_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    safe_filename = f"{project_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    project_status_db[project_id] = {"status": "starting", "progress": 0}
    background_tasks.add_task(background_pipeline, file_path, project_id, title)
    
    return {"status": "success", "project_id": project_id}
    
@app.get("/api/projects")
def get_projects():
    if not os.path.exists(PROJECTS_FILE):
        return []
    with open(PROJECTS_FILE, "r") as f:
        return json.load(f)
    
@app.get("/api/projects/{project_id}/status")
def get_project_status(project_id: str):
    return project_status_db.get(project_id, {"status": "unknown", "progress": 0})

def background_pipeline(file_path: str, project_id: str, title: str):
    """Bg task during upload progress"""
    project_status_db[project_id] = {"status": "processing", "progress": 10}
    
    success = run_nerfstudio_pipeline(video_path=file_path, project_id=project_id)
    
    if success:
        project_status_db[project_id] = {"status": "done", "progress": 100}
        upload_filename = os.path.basename(file_path)

        new_project = {
            "id": project_id,
            "title": title,
            "lastOpened": datetime.now().strftime("%Y-%m-%d"),
            "img": "/projects_assets/default_thumb.webp",
            "splat_url": f"http://localhost:8000/exports/{project_id}/splat.ply",
            "proxy_url": f"http://localhost:8000/exports/{project_id}/mesh.obj",
            "cameras_url": f"http://localhost:8000/api/projects/{project_id}/cameras",
            "video_url": f"http://localhost:8000/uploads/{upload_filename}",
            "dataparser_transforms_url": f"http://localhost:8000/api/projects/{project_id}/dataparser-transforms",
        }
        
        with open(PROJECTS_FILE, "r") as f:
            projects = json.load(f)
        projects.insert(0, new_project)
        with open(PROJECTS_FILE, "w") as f:
            json.dump(projects, f, indent=4)
            
        project_status_db[project_id]["project"] = new_project
    else:
        project_status_db[project_id] = {"status": "error", "progress": 0}
        
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return response

@app.get("/api/projects/{project_id}/tracking")
def get_project_tracking(project_id: str):
    path = f"processed_data/{project_id}/transforms.json"
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"error": "Tracking data not found"}

@app.get("/api/projects/{project_id}/dataparser-transforms")
def get_dataparser_transforms(project_id: str):
    search_pattern = os.path.join("outputs", project_id, "splatfacto", "*", "dataparser_transforms.json")
    dp_paths = glob.glob(search_pattern)
    if not dp_paths:
        return {"error": "Dataparser transforms not found"}
    latest_dp = max(dp_paths, key=os.path.getctime)
    with open(latest_dp, "r") as f:
        return json.load(f)
    
@app.get("/api/projects/{project_id}/cameras")
def get_project_cameras(project_id: str):
    poses_path   = f"exports/{project_id}/transforms_train.json"
    colmap_path  = f"processed_data/{project_id}/transforms.json"

    cameras_raw = None
    if os.path.exists(poses_path):
        with open(poses_path, "r") as f:
            cameras_raw = json.load(f)
    else:
        fallback = f"exports/{project_id}/cameras.json"
        if os.path.exists(fallback):
            with open(fallback, "r") as f:
                cameras_raw = json.load(f)

    if isinstance(cameras_raw, list):
        frames = cameras_raw
    elif isinstance(cameras_raw, dict):
        frames = cameras_raw.get("frames") or cameras_raw.get("cameras") or list(cameras_raw.values())
    else:
        frames = []

    intrinsics = {}
    if os.path.exists(colmap_path):
        with open(colmap_path, "r") as f:
            colmap = json.load(f)
        for key in ("fl_x", "fl_y", "cx", "cy", "w", "h",
                    "camera_angle_x", "camera_angle_y", "camera_model"):
            if key in colmap and colmap[key] is not None:
                intrinsics[key] = colmap[key]

    return {"frames": frames, **intrinsics}

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
    savedSplatUrl: str | None = None

@app.post("/api/projects/{project_id}/save")
def save_project_settings(project_id: str, settings: SaveSettings):
    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)

    project = next((p for p in projects if p["id"] == project_id), None)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    payload = settings.model_dump(exclude_unset=True)
    project.update(payload)
    project["lastOpened"] = datetime.now().strftime("%Y-%m-%d")

    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=4)

    return {"status": "saved", "project_id": project_id}

@app.post("/api/projects/{project_id}/model")
async def upload_project_model(project_id: str, file: UploadFile = File(...)):
    project_assets_dir = os.path.join("projects_assets", project_id)
    os.makedirs(project_assets_dir, exist_ok=True)
    
    for old_file in os.listdir(project_assets_dir):
        try:
            os.remove(os.path.join(project_assets_dir, old_file))
        except:
            pass
            
    safe_filename = file.filename.replace(" ", "_")
    file_path = os.path.join(project_assets_dir, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "status": "success",
        "url": f"http://localhost:8000/projects_assets/{project_id}/{safe_filename}",
        "name": file.filename
    }

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    """Delete a project and all its associated data (uploads, exports, processed data)."""
    if not os.path.exists(PROJECTS_FILE):
        raise HTTPException(status_code=404, detail="Projects list not found")

    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)

    project = next((p for p in projects if p["id"] == project_id), None)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # 1. Identify upload file from video_url
    video_url = project.get("video_url")
    if video_url:
        upload_filename = os.path.basename(video_url)
        upload_path = os.path.join(UPLOAD_DIR, upload_filename)
        if os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except Exception as e:
                print(f"[DELETE] Could not remove upload: {e}")

    # 2. Remove directories
    dirs_to_remove = [
        os.path.join(EXPORT_DIR, project_id),
        os.path.join("processed_data", project_id),
        os.path.join("projects_assets", project_id),
        os.path.join("outputs", project_id)
    ]

    for d in dirs_to_remove:
        if os.path.exists(d):
            try:
                shutil.rmtree(d)
                print(f"[DELETE] Removed directory: {d}")
            except Exception as e:
                print(f"[DELETE] Could not remove directory {d}: {e}")

    # 3. Update projects.json
    projects = [p for p in projects if p["id"] != project_id]
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=4)

    # 4. Cleanup background status
    if project_id in project_status_db:
        del project_status_db[project_id]

    return {"status": "deleted", "project_id": project_id}


@app.post("/api/cache/clear")
def clear_cache():
    """Safely clear processed_data/ and uploads/ contents not in projects.json."""
    if not os.path.exists(PROJECTS_FILE):
        return {"deleted_files": 0, "deleted_bytes": 0}

    try:
        with open(PROJECTS_FILE, "r") as f:
            content = f.read().strip()
            if not content:
                print("[CACHE CLEAR] projects.json is empty. Skipping purge for safety.")
                return {"deleted_files": 0, "deleted_bytes": 0, "error": "Empty projects file"}
            projects = json.loads(content)
    except Exception as e:
        print(f"[CACHE CLEAR] Failed to read projects.json: {e}")
        return {"deleted_files": 0, "deleted_bytes": 0, "error": str(e)}

    # Case-insensitive set of project IDs
    active_ids = {str(p["id"]).lower() for p in projects if "id" in p}
    active_files = set()
    for p in projects:
        if p.get("video_url"):
            active_files.add(os.path.basename(p["video_url"]).lower())

    deleted_files = 0
    deleted_bytes = 0

    # 1. Clean processed_data/
    processed_dir = "processed_data"
    if os.path.exists(processed_dir):
        for d in os.listdir(processed_dir):
            if d.lower() not in active_ids:
                path = os.path.join(processed_dir, d)
                if not os.path.isdir(path): continue
                try:
                    bytes_size = sum(os.path.getsize(os.path.join(dirpath, filename)) for dirpath, _, filenames in os.walk(path) for filename in filenames)
                    shutil.rmtree(path)
                    deleted_files += 1
                    deleted_bytes += bytes_size
                    print(f"[CACHE CLEAR] Removed processed_data/{d}")
                except Exception as e:
                    print(f"[CACHE CLEAR] Error removing {d}: {e}")

    # 2. Clean uploads/
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            if f.lower() not in active_files:
                path = os.path.join(UPLOAD_DIR, f)
                if os.path.isdir(path): continue
                try:
                    size = os.path.getsize(path)
                    os.remove(path)
                    deleted_files += 1
                    deleted_bytes += size
                    print(f"[CACHE CLEAR] Removed uploads/{f}")
                except Exception as e:
                    print(f"[CACHE CLEAR] Error removing upload {f}: {e}")

    return {
        "status": "success",
        "deleted_files": deleted_files,
        "deleted_bytes": deleted_bytes
    }

@app.post("/api/projects/cleanup")
def cleanup_projects():
    """Purge orphaned folders from exports/ and projects_assets/."""
    if not os.path.exists(PROJECTS_FILE):
        return {"deleted_files": 0}

    try:
        with open(PROJECTS_FILE, "r") as f:
            content = f.read().strip()
            if not content:
                print("[PURGE] projects.json is empty. Skipping purge for safety.")
                return {"deleted_files": 0, "error": "Empty projects file"}
            projects = json.loads(content)
    except Exception as e:
        print(f"[PURGE] Failed to read projects.json: {e}")
        return {"deleted_files": 0, "error": str(e)}

    active_ids = {str(p["id"]).lower() for p in projects if "id" in p}
    deleted_count = 0

    for base_dir in [EXPORT_DIR, "projects_assets", "outputs"]:
        if os.path.exists(base_dir):
            for d in os.listdir(base_dir):
                full_path = os.path.join(base_dir, d)
                if not os.path.isdir(full_path): continue
                
                if d.lower() not in active_ids:
                    try:
                        shutil.rmtree(full_path)
                        deleted_count += 1
                        print(f"[PURGE] Removed orphaned folder {base_dir}/{d}")
                    except Exception as e:
                        print(f"[PURGE] Error removing {base_dir}/{d}: {e}")
    
    return {"status": "success", "deleted_files": deleted_count}
