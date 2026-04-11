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

app = FastAPI(title="Impala Backend Core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
PROJECTS_FILE = "projects.json"
os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/exports", StaticFiles(directory=EXPORT_DIR), name="exports")
app.mount("/projects_assets", StaticFiles(directory="projects_assets", html=True), name="projects_assets")
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
    path = f"exports/{project_id}/transforms_train.json"
    
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
            
    fallback_path = f"exports/{project_id}/cameras.json"
    if os.path.exists(fallback_path):
        with open(fallback_path, "r") as f:
            return json.load(f)
            
    return {"error": "Camera data not found", "searched_path": path}

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

    # Merge only the fields that were actually sent (non-None)
    payload = settings.model_dump(exclude_none=True)
    project.update(payload)
    project["lastOpened"] = datetime.now().strftime("%Y-%m-%d")

    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=4)

    return {"status": "saved", "project_id": project_id}

class CropRequest(BaseModel):
    inverse_matrix: list[float]

@app.post("/api/projects/{project_id}/crop")
async def crop_project(project_id: str, req: CropRequest):
    input_ply = os.path.join(EXPORT_DIR, project_id, "splat.ply")
    
    # We always crop from the original splat.ply to prevent compounding/intersection of previously cropped slices.
    existing_crops = glob.glob(os.path.join(EXPORT_DIR, project_id, "splat_cropped_*.ply"))
        
    random_id = uuid.uuid4().hex[:8]
    output_filename = f"splat_cropped_{random_id}.ply"
    output_ply = os.path.join(EXPORT_DIR, project_id, output_filename)
    
    # Convert JS column-major 16-element array to 4x4 numpy matrix
    inv_matrix = np.array(req.inverse_matrix).reshape(4, 4).T
    
    plydata = PlyData.read(input_ply)
    v_data = plydata['vertex'].data
    
    # Extract positions
    x = v_data['x']
    y = v_data['y']
    z = v_data['z']
    
    # Create 4xN matrix for multiplication (x, y, z, 1)
    pts = np.vstack((x, y, z, np.ones_like(x)))
    transformed_pts = inv_matrix @ pts
    
    # Check bounds (-0.5 to 0.5 in local crop space)
    tx, ty, tz = transformed_pts[0, :], transformed_pts[1, :], transformed_pts[2, :]
    mask = (tx >= -0.5) & (tx <= 0.5) & (ty >= -0.5) & (ty <= 0.5) & (tz >= -0.5) & (tz <= 0.5)
    
    # Filter and save
    new_v_data = v_data[mask]
    new_plydata = PlyData([PlyElement.describe(new_v_data, 'vertex')], text=False)
    new_plydata.write(output_ply)
    
    # Clean up old crops
    for old_crop in existing_crops:
        try:
            os.remove(old_crop)
        except OSError:
            pass
            
    return {
       "status": "success", 
       "new_url": f"http://localhost:8000/exports/{project_id}/{output_filename}"
    }