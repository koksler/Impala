from fastapi import FastAPI, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid

from ml_pipeline import run_nerfstudio_pipeline

app = FastAPI(title="Impala Backend Core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
FRAMES_DIR = "frames"

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/api/status")
def get_status():
    return {"status": "online", "version": "1.0.0"}

def process_video_background(file_path: str, project_id: str):
    print(f"[BACKGROUND] Starting pipeline for {project_id}")
    success = run_nerfstudio_pipeline(video_path=file_path, project_id=project_id)
    
    if success:
        print(f"[BACKGROUND] Project {project_id} is ready for 3D viewing!")
        #todo Later: Updating json DB on finish
    else:
        print(f"[BACKGROUND] Project {project_id} failed.")
    
@app.post("/api/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    print(f"[UPLOAD] Receiving file: {file.filename}")
    
    project_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    safe_filename = f"{project_id}{ext}"
    
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    print(f"[UPLOAD] File saved as: {safe_filename}")
    
    background_tasks.add_task(process_video_background, file_path, project_id)
    
    return {
        "status": "success", 
        "project_id": project_id,
        "message": "Video uploaded. Neural Network training started!"
    }