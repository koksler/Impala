from fastapi import FastAPI, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid

from ml_pipeline import extract_frames

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

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(FRAMES_DIR, exist_ok=True)

@app.get("/api/status")
def get_status():
    return {"status": "online"}

def process_video_background(file_path: str, project_id: str):
    output_folder = os.path.join(FRAMES_DIR, project_id)
    extract_frames(video_path=file_path, output_dir=output_folder, fps_target=5)
    
@app.post("/api/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    print(f"[UPLOAD] Receiving file: {file.filename}")
    
    # Generate a unique safe ID for this project
    project_id = str(uuid.uuid4())
    
    # Extract the original extension (e.g., ".mp4")
    _, ext = os.path.splitext(file.filename)
    safe_filename = f"{project_id}{ext}"
    
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    print(f"[UPLOAD] File saved securely as: {safe_filename}")
    
    background_tasks.add_task(process_video_background, file_path, project_id)
    
    return {
        "status": "success", 
        "original_filename": file.filename,
        "project_id": project_id,
        "message": "File uploaded. Frame extraction started in the background."
    }