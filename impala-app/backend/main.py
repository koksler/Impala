from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks
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
    allow_origins=["*"], # ["http://localhost:5173"]
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

def process_video_background(file_path: str, project_id: str):
    print(f"[BACKGROUND] Starting pipeline for {project_id}")
    success = run_nerfstudio_pipeline(video_path=file_path, project_id=project_id)
    
    if success:
        print(f"[BACKGROUND] Project {project_id} is ready for 3D viewing!")
    else:
        print(f"[BACKGROUND] Project {project_id} failed.")
    
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
        
        # Derive the public video URL from the saved upload filename
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
    """Returns the nerfstudio dataparser_transforms.json that encodes the
    applied_transform + scale used to align camera poses with the exported
    Gaussian splat (.ply) coordinate space."""
    search_pattern = os.path.join("outputs", project_id, "splatfacto", "*", "dataparser_transforms.json")
    dp_paths = glob.glob(search_pattern)
    
    if not dp_paths:
        return {"error": "Dataparser transforms not found"}
        
    latest_dp = max(dp_paths, key=os.path.getctime)
    with open(latest_dp, "r") as f:
        return json.load(f)
    
@app.get("/api/projects/{project_id}/cameras")
def get_project_cameras(project_id: str):
    """Returns camera poses enriched with intrinsics from COLMAP.
    
    ns-export cameras produces a bare array of {file_path, transform} objects
    with NO intrinsics.  The intrinsics live in processed_data/transforms.json
    (the COLMAP-derived file). We merge them so the frontend has everything it
    needs to calculate the correct FOV.
    """
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

    # Normalise to a list of frame dicts no matter what nerfstudio produces
    if isinstance(cameras_raw, list):
        frames = cameras_raw
    elif isinstance(cameras_raw, dict):
        frames = cameras_raw.get("frames") or cameras_raw.get("cameras") or list(cameras_raw.values())
    else:
        frames = []

    # Load COLMAP intrinsics (fl_y, h, w, etc.)
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
    """Persist 3D scene / material / environment settings for a project."""
    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)

    project = next((p for p in projects if p["id"] == project_id), None)
    if project is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")

    # Merge fields, allowing explicit nulls to clear values
    payload = settings.model_dump()
    # Filter out only fields that weren't actually in the SaveSettings model (if any defaults)
    # but we want to keep things that were sent as null.
    # Pydantic's model_dump(exclude_unset=True) is better here.
    payload = settings.model_dump(exclude_unset=True)
    project.update(payload)
    project["lastOpened"] = datetime.now().strftime("%Y-%m-%d")

    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=4)

    return {"status": "saved", "project_id": project_id}

@app.post("/api/projects/{project_id}/model")
async def upload_project_model(project_id: str, file: UploadFile = File(...)):
    """Upload a custom 3D model (.glb/.gltf) to the project's assets."""
    # Create project-specific asset directory
    project_assets_dir = os.path.join("projects_assets", project_id)
    os.makedirs(project_assets_dir, exist_ok=True)
    
    # Optional: Clean up old models to save space
    for old_file in os.listdir(project_assets_dir):
        try:
            os.remove(os.path.join(project_assets_dir, old_file))
        except:
            pass
            
    # Save file
    safe_filename = file.filename.replace(" ", "_")
    file_path = os.path.join(project_assets_dir, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "status": "success",
        "url": f"http://localhost:8000/projects_assets/{project_id}/{safe_filename}",
        "name": file.filename
    }