from fastapi import APIRouter, File, UploadFile, HTTPException
import os
import shutil
import uuid
import struct
import json
import glob
import subprocess
import numpy as np
from plyfile import PlyData, PlyElement
from pydantic import BaseModel

router = APIRouter()

EXPORT_DIR = "exports"
UPLOAD_DIR = "uploads"
PROJECTS_FILE = os.path.join("data", "projects.json")

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
        return "25" # safe fallback

class CropRequest(BaseModel):
    inverse_matrix: list[float]

@router.post("/api/projects/{project_id}/crop")
async def crop_project(project_id: str, req: CropRequest):
    input_ply = os.path.join(EXPORT_DIR, project_id, "splat.ply")
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
       "new_url": f"/exports/{project_id}/{output_filename}"
    }

@router.post("/api/projects/{project_id}/export/batch")
async def export_batch(project_id: str, frames: list[UploadFile] = File(...)):
    """Save a batch of frames to a temporary directory."""
    tmp_dir = os.path.join(EXPORT_DIR, project_id, "tmp_frames")
    os.makedirs(tmp_dir, exist_ok=True)
    
    for file in frames:
        if not file.filename:
            continue
        file_path = os.path.join(tmp_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    return {"status": "success", "count": len(frames)}

@router.post("/api/projects/{project_id}/export/finalize")
async def finalize_export(project_id: str):
    """Run FFmpeg to stitch frames from the tmp_frames directory into an MP4 video."""
    tmp_dir = os.path.join(EXPORT_DIR, project_id, "tmp_frames")
    output_filename = f"export_{uuid.uuid4().hex[:8]}.mp4"
    output_path = os.path.join(EXPORT_DIR, project_id, output_filename)
    
    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)
        
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project or not project.get("video_url"):
        raise HTTPException(status_code=404, detail="Original video not found")
        
    video_filename = project["video_url"].split("/")[-1]
    original_video_path = os.path.join(UPLOAD_DIR, video_filename)

    if not os.path.exists(original_video_path):
        raise HTTPException(status_code=404, detail="Original video file missing")

    exact_fps = get_video_framerate(original_video_path)
    input_pattern = os.path.join(tmp_dir, "frame_%05d.webp")
    
    cmd = [
        "ffmpeg", "-y",
        "-i", original_video_path,
        "-framerate", exact_fps,
        "-i", input_pattern,
        "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=pass[vout]",
        "-map", "[vout]",       # Maps the composited video to the output
        "-map", "0:a?",         # Maps the original audio track to the output
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-b:v", "20M",          # Forces a 20Mbps bitrate
        "-maxrate", "25M",
        "-bufsize", "25M",      
        "-preset", "slow",      
        "-c:a", "copy",         # Copies the audio losslessly without re-compressing
        output_path
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        # Clean up frames only on success
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except subprocess.CalledProcessError as e:
        print("[FFMPEG ERROR]", e.stderr.decode('utf-8', errors='ignore'))
        raise HTTPException(status_code=500, detail="FFmpeg processing failed")
    except Exception as e:
        print(f"[CLEANUP ERROR] Could not remove frames dir: {e}")
        
    return {
        "status": "success",
        "url": f"/exports/{project_id}/{output_filename}",
        "filename": output_filename
    }
