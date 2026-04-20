from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import os
import json
import uuid
import string
import subprocess
import threading
import shutil
from typing import Optional

router = APIRouter()

EXPORT_DIR = os.path.abspath("exports")
UPLOAD_DIR = os.path.abspath("uploads")
PROJECTS_FILE = os.path.abspath(os.path.join("data", "projects.json"))

# ─── In-memory job registry ───────────────────────────────────────────────────

blender_jobs: dict[str, dict] = {}

# ─── Blender discovery ────────────────────────────────────────────────────────

def find_blender_executable() -> Optional[str]:
    """
    Looks across common directories on Windows for the blender.exe executable.
    Locate the Blender executable across common locations:
      1. System PATH  (covers Linux, macOS, and any manually added path)
      2. Windows Registry — Steam (HKCU and HKLM)
      3. All drive letters — Steam library roots (SteamLibrary / Steam)
      4. Steam Program Files default locations
      5. Blender Foundation standard Windows installs (Blender 3.x / 4.x / 5.x)
    Returns the first valid executable path found, or None.
    """

    # 1. System PATH
    try:
        cmd = "where" if os.name == "nt" else "which"
        result = subprocess.run([cmd, "blender"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            path = result.stdout.strip().splitlines()[0].strip()
            if path and os.path.isfile(path):
                return path
    except Exception:
        pass

    # 2. Steam via Windows Registry
    if os.name == "nt":
        try:
            import winreg
            for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                for reg_path in (
                    r"SOFTWARE\Valve\Steam",
                    r"SOFTWARE\WOW6432Node\Valve\Steam",
                ):
                    try:
                        key = winreg.OpenKey(hive, reg_path)
                        steam_path, _ = winreg.QueryValueEx(key, "SteamPath")
                        winreg.CloseKey(key)
                        # Steam stores paths with forward slashes
                        steam_path = steam_path.replace("/", os.sep)
                        candidate = os.path.join(
                            steam_path, "steamapps", "common", "Blender", "blender.exe"
                        )
                        if os.path.isfile(candidate):
                            return candidate
                    except Exception:
                        pass
        except ImportError:
            pass  # winreg not available (non-Windows)

    # 3. All drive letters — Steam library root patterns
    if os.name == "nt":
        steam_lib_patterns = [
            "{drive}:\\SteamLibrary",
            "{drive}:\\Steam",
            "{drive}:\\Program Files (x86)\\Steam",
            "{drive}:\\Program Files\\Steam",
        ]
        for drive in string.ascii_uppercase:
            for pattern in steam_lib_patterns:
                steam_root = pattern.format(drive=drive)
                candidate = os.path.join(
                    steam_root, "steamapps", "common", "Blender", "blender.exe"
                )
                if os.path.isfile(candidate):
                    return candidate

    # 4. Blender Foundation standard installs — Program Files on all drives
    if os.name == "nt":
        for drive in string.ascii_uppercase:
            for pf in ("Program Files", "Program Files (x86)"):
                foundation = os.path.join(f"{drive}:\\", pf, "Blender Foundation")
                if not os.path.isdir(foundation):
                    continue
                # Sort entries descending so newest version wins
                # Supports Blender 3.x, 4.x, 5.x folder names
                try:
                    entries = sorted(os.listdir(foundation), reverse=True)
                except OSError:
                    continue
                for entry in entries:
                    candidate = os.path.join(foundation, entry, "blender.exe")
                    if os.path.isfile(candidate):
                        return candidate

    # 5. macOS app bundle
    mac_candidate = "/Applications/Blender.app/Contents/MacOS/Blender"
    if os.path.isfile(mac_candidate):
        return mac_candidate

    return None


def get_blender_version(exe: str) -> Optional[str]:
    """Return the first line of `blender --version` output, e.g. 'Blender 5.1.0'."""
    try:
        result = subprocess.run(
            [exe, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        lines = result.stdout.strip().splitlines()
        return lines[0] if lines else None
    except Exception:
        return None


# ─── Availability endpoint ────────────────────────────────────────────────────

@router.get("/api/blender/available")
def blender_available():
    """
    Returns Blender availability + path + version.
    Called by the frontend when the RenderModal opens.
    """
    exe = find_blender_executable()
    if exe is None:
        return {"available": False, "path": None, "version": None}

    version = get_blender_version(exe)
    return {"available": True, "path": exe, "version": version or "Unknown"}


# ─── Render request schema ────────────────────────────────────────────────────

class BlenderRenderRequest(BaseModel):
    engine: str = "eevee"          # "eevee" | "cycles"
    samples: int = 64              # Cycles only; Eevee ignores this
    width: int = 1920
    height: int = 1080
    format: str = ".mp4"
    include_shadows: bool = True
    render_occlusion: bool = True
    proxy_url: Optional[str] = None

    # Scene state passed from frontend
    obj_pos: list[float] = [0, 0, 0]
    obj_rot: list[float] = [0, 0, 0]
    obj_scale: list[float] = [1, 1, 1]
    scene_pos: list[float] = [0, 0, 0]
    scene_rot: list[float] = [0, 0, 0]
    scene_scale: list[float] = [1, 1, 1]
    env_intensity: float = 1.0
    env_rotation: float = 0.0
    light_elevation: float = 45.0
    env_tint: str = "#ffffff"
    shadow_blur: float = 0.5
    shadow_opacity: float = 0.4
    fov: float = 45.0


# ─── Render job ───────────────────────────────────────────────────────────────

BLENDER_SCRIPT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "blender_render.py")
)


def _run_blender_job(job_id: str, project_id: str, exe: str, config: dict):
    """Background thread: run Blender, then FFmpeg composite."""
    job = blender_jobs[job_id]
    frames_dir = config["output_dir"]
    total_frames = config["total_frames"]

    try:
        job["status"] = "rendering"

        config_json_path = os.path.join(frames_dir, "config.json")
        with open(config_json_path, "w") as f:
            json.dump(config, f)

        blender_log_path = os.path.join(frames_dir, "blender.log")
        f_log = open(blender_log_path, "w", encoding="utf-8")

        proc = subprocess.Popen(
            [exe, "--background", "--factory-startup", "--python", BLENDER_SCRIPT_PATH, "--", config_json_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        job["_proc"] = proc

        # Stream output and update progress by counting rendered frames
        for line in proc.stdout:
            print(f"[BLENDER] {line.strip()}", flush=True)
            f_log.write(line)
            f_log.flush()
            if job.get("cancelled"):
                proc.terminate()
                job["status"] = "cancelled"
                f_log.close()
                return
            # Blender prints "Fra:N " when completing a frame
            if line.startswith("Fra:") or "Saved:" in line:
                rendered = len([
                    f for f in os.listdir(frames_dir)
                    if f.endswith(".png")
                ]) if os.path.isdir(frames_dir) else 0
                job["progress"] = min(90, int(rendered / max(total_frames, 1) * 90))

        proc.wait()
        f_log.close()
        
        if proc.returncode != 0:
            job["status"] = "error"
            job["error"] = f"Blender exited with code {proc.returncode}"
            return

        rendered_frames = [f for f in os.listdir(frames_dir) if f.endswith(".png")]
        if not rendered_frames:
            job["status"] = "error"
            job["error"] = "Blender exited with code 0 but no PNG frames were generated. Check blender.log in the export folder."
            return

        # FFmpeg composite step
        job["status"] = "compositing"
        job["progress"] = 92

        original_video = config["video_path"]
        ext = config.get("format", ".mp4").lower()
        output_filename = f"blender_export_{uuid.uuid4().hex[:8]}{ext}"
        output_path = os.path.join(EXPORT_DIR, project_id, output_filename)
        input_pattern = os.path.join(frames_dir, "frame_%05d.png")
        fps = config.get("fps", "25")

        # Dynamically calculate the framerate required for the sequence to perfectly span
        # the entire original video duration, preventing audio/video desync or early clipping.
        try:
            dur_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", original_video]
            dur_res = subprocess.run(dur_cmd, capture_output=True, text=True, timeout=10)
            vid_dur = float(dur_res.stdout.strip())
            seq_len = len([f for f in os.listdir(frames_dir) if f.endswith(".png")])
            seq_fps = seq_len / vid_dur if vid_dur > 0 else float(fps)
        except Exception:
            seq_fps = float(fps)

        if ext == ".webm":
            vcodec = ["-c:v", "libvpx-vp9", "-b:v", "10M"]
        else:
            vcodec = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", "20M", "-maxrate", "25M", "-bufsize", "25M", "-preset", "slow"]

        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", original_video,
            "-framerate", str(seq_fps),
            "-i", input_pattern,
            "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=pass[vout]",
            "-map", "[vout]",
            "-map", "0:a?",
            *vcodec,
            "-c:a", "copy",
            output_path,
        ]
        
        print(f"[FFMPEG] Running: {' '.join(ffmpeg_cmd)}")
        ffmpeg_proc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if ffmpeg_proc.returncode != 0:
            job["status"] = "error"
            job["error"] = f"FFmpeg compositing failed: {ffmpeg_proc.stderr.strip()}"
            return

        # Cleanup frames
        shutil.rmtree(frames_dir, ignore_errors=True)

        job["status"] = "done"
        job["progress"] = 100
        job["url"] = f"/exports/{project_id}/{output_filename}"
        job["filename"] = output_filename

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


@router.post("/api/projects/{project_id}/render/blender")
async def start_blender_render(
    project_id: str,
    req: BlenderRenderRequest,
    background_tasks: BackgroundTasks,
):
    exe = find_blender_executable()
    if exe is None:
        raise HTTPException(
            status_code=503,
            detail="Blender executable not found. Install Blender 4.x/5.x and ensure it is accessible.",
        )

    # Load project for video path and camera data
    if not os.path.exists(PROJECTS_FILE):
        raise HTTPException(status_code=404, detail="Projects file not found")

    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)

    project = next((p for p in projects if p["id"] == project_id), None)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    video_url = project.get("video_url", "")
    video_path = os.path.join(UPLOAD_DIR, os.path.basename(video_url))
    if not os.path.isfile(video_path):
        raise HTTPException(status_code=404, detail="Original video file not found")

    # Camera transforms
    cameras_path = os.path.join(EXPORT_DIR, project_id, "transforms_train.json")
    if not os.path.isfile(cameras_path):
        raise HTTPException(status_code=404, detail="Camera transforms not found")

    with open(cameras_path, "r") as f:
        cameras_data = json.load(f)

    frames_raw = cameras_data.get("frames", cameras_data) if isinstance(cameras_data, dict) else cameras_data

    # Model path
    model_url = project.get("customModelUrl", "")
    model_path = ""
    if model_url and "projects_assets" in model_url:
        rel = model_url.split("projects_assets/")[-1]
        model_path = os.path.abspath(os.path.join("projects_assets", rel))

    proxy_url = req.proxy_url
    proxy_path = ""
    if proxy_url and "exports" in proxy_url:
        rel = proxy_url.split("exports/")[-1]
        proxy_path = os.path.abspath(os.path.join(EXPORT_DIR, rel))

    job_id = uuid.uuid4().hex
    frames_dir = os.path.abspath(os.path.join(EXPORT_DIR, project_id, f"blender_frames_{job_id}"))
    os.makedirs(frames_dir, exist_ok=True)

    # Get video FPS
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, timeout=10,
        )
        fps_str = result.stdout.strip()
        if "/" in fps_str:
            n, d = fps_str.split("/")
            fps = round(float(n) / float(d), 3)
        else:
            fps = float(fps_str) if fps_str else 25.0
    except Exception:
        fps = 25.0

    config = {
        "job_id": job_id,
        "engine": req.engine,
        "samples": req.samples,
        "width": req.width,
        "height": req.height,
        "model_path": model_path,
        "proxy_path": proxy_path,
        "output_dir": frames_dir,
        "video_path": video_path,
        "fps": fps,
        "format": req.format,
        "include_shadows": req.include_shadows,
        "render_occlusion": req.render_occlusion,
        "total_frames": len(frames_raw),
        "frames": [
            {
                "index": i,
                "matrix": (
                    f["transform_matrix"]
                    if "transform_matrix" in f
                    else f.get("transform", f.get("camera_to_world", []))
                ),
            }
            for i, f in enumerate(frames_raw)
        ],
        "obj_pos": req.obj_pos,
        "obj_rot": req.obj_rot,
        "obj_scale": req.obj_scale,
        "scene_pos": req.scene_pos,
        "scene_rot": req.scene_rot,
        "scene_scale": req.scene_scale,
        "env_intensity": req.env_intensity,
        "env_rotation": req.env_rotation,
        "light_elevation": req.light_elevation,
        "env_tint": req.env_tint,
        "shadow_blur": req.shadow_blur,
        "shadow_opacity": req.shadow_opacity,
        "fov": req.fov,
    }

    blender_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "url": None,
        "filename": None,
        "error": None,
        "cancelled": False,
    }

    thread = threading.Thread(
        target=_run_blender_job,
        args=(job_id, project_id, exe, config),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id}


@router.get("/api/projects/{project_id}/render/blender/{job_id}/status")
def get_blender_render_status(project_id: str, job_id: str):
    job = blender_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status": job["status"],
        "progress": job["progress"],
        "url": job.get("url"),
        "filename": job.get("filename"),
        "error": job.get("error"),
    }


@router.post("/api/projects/{project_id}/render/blender/{job_id}/cancel")
def cancel_blender_render(project_id: str, job_id: str):
    job = blender_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    job["cancelled"] = True
    proc = job.get("_proc")
    if proc:
        try:
            proc.terminate()
        except Exception:
            pass
    job["status"] = "cancelled"
    return {"status": "cancelled"}
