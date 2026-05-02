from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from datetime import datetime
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
from typing import Optional, Union

router = APIRouter()

EXPORT_DIR = os.path.abspath("exports")
UPLOAD_DIR = os.path.abspath("uploads")
PROJECTS_ASSETS_DIR = os.path.abspath("projects_assets")
PROJECTS_FILE = os.path.abspath(os.path.join("data", "projects.json"))

def generate_thumbnail(video_path: str, project_id: str) -> str:
    """Extract the first frame of video_path as a JPEG thumbnail."""
    default = "/projects_assets/default_thumb.webp"
    try:
        thumb_dir = os.path.join(PROJECTS_ASSETS_DIR, project_id)
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_path = os.path.join(thumb_dir, "thumb.jpg")
        cmd = [
            "ffmpeg", "-y", "-ss", "0",
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "3",
            thumb_path,
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        if result.returncode == 0 and os.path.exists(thumb_path):
            print(f"[THUMB] Generated thumbnail for {project_id}")
            return f"/projects_assets/{project_id}/thumb.jpg"
        print(f"[THUMB] ffmpeg failed: {result.stderr.decode(errors='ignore')[:200]}")
        return default
    except Exception as e:
        print(f"[THUMB] Error: {e}")
        return default

def is_safe_path(base_dir: str, target_path: str) -> bool:
    """Cryptographically ensure the target path resolves strictly inside the designated base directory."""
    abs_base = os.path.abspath(base_dir)
    abs_target = os.path.abspath(target_path)
    return os.path.commonpath([abs_base, abs_target]) == abs_base

def get_video_framerate(video_path: str) -> str:
    # Security: Verify path is within Upload directory
    if not is_safe_path(UPLOAD_DIR, video_path):
        return "25" # Safe fallback on traversal attempt
        
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=1", video_path
    ]
    try:
        # Security: Added timeout to prevent infinite blocking
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True, timeout=15)
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return "25"

class CropRequest(BaseModel):
    inverse_matrix: list[float]

@router.post("/api/projects/{project_id}/crop")
async def crop_project(project_id: str, req: CropRequest):
    random_id = uuid.uuid4().hex[:8]
    output_filename = f"splat_cropped_{random_id}.ply"
    output_ply = os.path.join(EXPORT_DIR, project_id, output_filename)
    
    existing_crops = glob.glob(os.path.join(EXPORT_DIR, project_id, "splat_cropped_*.ply"))
    if existing_crops:
        input_ply = max(existing_crops, key=os.path.getmtime)
    else:
        input_ply = os.path.join(EXPORT_DIR, project_id, "splat.ply")
        
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
    
    # Clean up old crops except the current one
    remaining_crops = glob.glob(os.path.join(EXPORT_DIR, project_id, "splat_cropped_*.ply"))
    for old_crop in remaining_crops:
        if os.path.basename(old_crop) != output_filename:
            try:
                os.remove(old_crop)
            except OSError:
                pass
            
    return {
       "status": "success", 
       "new_url": f"/exports/{project_id}/{output_filename}"
    }

class CropInsideAABBRequest(BaseModel):
    aabb_min: list[float]     # world-space AABB min [x, y, z]
    aabb_max: list[float]     # world-space AABB max [x, y, z]
    splat_matrix: list[float] # 16-element column-major world matrix of the splat mesh
    current_splat_filename: str = ""  # filename of the currently displayed PLY (e.g. splat_cropped_abc.ply)

@router.post("/api/projects/{project_id}/crop-inside")
async def crop_inside_project(project_id: str, req: CropInsideAABBRequest):
    random_id = uuid.uuid4().hex[:8]
    output_filename = f"splat_cropped_{random_id}.ply"
    output_ply = os.path.join(EXPORT_DIR, project_id, output_filename)

    # Always operate on the currently-displayed PLY, not just the latest crop.
    # This prevents reading from a previously-damaged file after an undo.
    if req.current_splat_filename:
        candidate = os.path.join(EXPORT_DIR, project_id, req.current_splat_filename)
        input_ply = candidate if os.path.exists(candidate) else os.path.join(EXPORT_DIR, project_id, "splat.ply")
    else:
        existing_crops = glob.glob(os.path.join(EXPORT_DIR, project_id, "splat_cropped_*.ply"))
        input_ply = max(existing_crops, key=os.path.getmtime) if existing_crops else os.path.join(EXPORT_DIR, project_id, "splat.ply")

    plydata = PlyData.read(input_ply)
    v_data  = plydata['vertex'].data

    x = v_data['x'].astype(np.float64)
    y = v_data['y'].astype(np.float64)
    z = v_data['z'].astype(np.float64)

    # Transform splat points to Three.js world space using the splat mesh's matrixWorld.
    # req.splat_matrix is column-major (JS/WebGL convention) → transpose to row-major for numpy.
    splat_mat = np.array(req.splat_matrix, dtype=np.float64).reshape(4, 4).T

    pts       = np.vstack((x, y, z, np.ones(len(x), dtype=np.float64)))
    world_pts = splat_mat @ pts   # 4×N world-space positions

    wx = world_pts[0]
    wy = world_pts[1]
    wz = world_pts[2]

    aabb_min = req.aabb_min   # [x, y, z]
    aabb_max = req.aabb_max   # [x, y, z]

    # Debug — printed in the backend console so coordinate mismatches are visible
    print(f"[crop-inside] AABB  : {[round(v,3) for v in aabb_min]}  →  {[round(v,3) for v in aabb_max]}")
    print(f"[crop-inside] Splat X: {wx.min():.3f}..{wx.max():.3f}  "
          f"Y: {wy.min():.3f}..{wy.max():.3f}  Z: {wz.min():.3f}..{wz.max():.3f}")

    inside = (
        (wx >= aabb_min[0]) & (wx <= aabb_max[0]) &
        (wy >= aabb_min[1]) & (wy <= aabb_max[1]) &
        (wz >= aabb_min[2]) & (wz <= aabb_max[2])
    )
    removed_count = int(inside.sum())
    print(f"[crop-inside] Removing {removed_count} / {len(x)} splats")

    new_v_data  = v_data[~inside]
    new_plydata = PlyData([PlyElement.describe(new_v_data, 'vertex')], text=False)
    new_plydata.write(output_ply)

    # Clean up old cropped files
    for old in glob.glob(os.path.join(EXPORT_DIR, project_id, "splat_cropped_*.ply")):
        if os.path.basename(old) != output_filename:
            try: os.remove(old)
            except OSError: pass

    return {"status": "success", "new_url": f"/exports/{project_id}/{output_filename}", "removed": removed_count}

@router.post("/api/projects/{project_id}/splat/restore")
async def restore_splat(project_id: str):
    """Delete all cropped PLY variants and revert to the original splat.ply."""
    original = os.path.join(EXPORT_DIR, project_id, "splat.ply")
    if not os.path.exists(original):
        raise HTTPException(status_code=404, detail="Original splat.ply not found")
    for old in glob.glob(os.path.join(EXPORT_DIR, project_id, "splat_cropped_*.ply")):
        try: os.remove(old)
        except OSError: pass
    return {"status": "success", "new_url": f"/exports/{project_id}/splat.ply"}

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

class FinalizeRequest(BaseModel):
    fps: Union[str, int, float] = 24
    format: str = ".mp4"
    filename: Optional[str] = None


@router.post("/api/projects/{project_id}/export/finalize")
async def finalize_export(project_id: str, req: FinalizeRequest):
    """Run FFmpeg to stitch frames from the tmp_frames directory into an MP4 video."""
    
    # Security: Sanitize project ID to prevent directory escape via URL manipulation
    if not project_id.isalnum() and '-' not in project_id:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
        
    tmp_dir = os.path.join(EXPORT_DIR, project_id, "tmp_frames")
    if not is_safe_path(EXPORT_DIR, tmp_dir):
        raise HTTPException(status_code=403, detail="Path traversal restricted")
        
    ext = req.format.lower() if req.format else ".mp4"
    
    # Handle filename override
    if req.filename:
        # Sanitize filename (remove paths and invalid chars)
        safe_name = "".join(c for c in req.filename if c.isalnum() or c in (' ', '.', '_', '-')).rstrip()
        output_filename = f"{safe_name}{ext}"
    else:
        output_filename = f"export_{uuid.uuid4().hex[:8]}{ext}"
        
    output_path = os.path.join(EXPORT_DIR, project_id, output_filename)
    
    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)
        
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project or not project.get("video_url"):
        raise HTTPException(status_code=404, detail="Original video not found")
        
    # Security: Restrict filename isolation using basename to strip any injected relative paths
    video_filename = os.path.basename(project["video_url"])
    original_video_path = os.path.join(UPLOAD_DIR, video_filename)

    if not is_safe_path(UPLOAD_DIR, original_video_path) or not os.path.exists(original_video_path):
        raise HTTPException(status_code=404, detail="Original video file missing or path invalid")

    # Handle output formats
    if ext == ".webm":
        vcodec = ["-c:v", "libvpx-vp9", "-b:v", "10M"]
        acodec = ["-c:a", "libopus", "-b:a", "192k"]  # WebM requires Opus/Vorbis, not AAC
    else:
        vcodec = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", "20M", "-maxrate", "25M", "-bufsize", "25M", "-preset", "slow"]
        acodec = ["-c:a", "copy"]  # mp4 can carry AAC natively
        
    input_pattern = os.path.join(tmp_dir, "frame_%05d.webp")
    
    try:
        seq_fps = float(get_video_framerate(original_video_path))
    except (ValueError, ZeroDivisionError):
        seq_fps = req.fps or 24

    
    if ext == ".wav":
        cmd = [
            "ffmpeg", "-y",
            "-i", original_video_path,
            "-vn",
            "-c:a", "pcm_s16le",
            output_path
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-i", original_video_path,
            "-framerate", str(seq_fps),
            "-i", input_pattern,
            "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=pass[vout]",
            "-map", "[vout]",
            "-map", "0:a?",
            *vcodec,
            *acodec,
            output_path
        ]
    
    try:
        # Security: Explicit timeout of 600s (10 minutes) for heavy video rendering
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
        # Clean up frames only on success
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except subprocess.CalledProcessError as e:
        # Security & Debugging: Explicitly decode and log stderr from CalledProcessError
        error_msg = e.stderr.decode('utf-8', errors='ignore') if e.stderr else str(e)
        print(f" {error_msg}")
        raise HTTPException(status_code=500, detail="FFmpeg processing failed")
    except subprocess.TimeoutExpired:
        print(" Process timed out after 600 seconds.")
        raise HTTPException(status_code=504, detail="FFmpeg process timed out")
    except Exception as e:
        print(f" Could not remove frames dir: {e}")
        
    final_url = f"/exports/{project_id}/{output_filename}"
    
    return {
        "status": "success",
        "url": final_url,
        "filename": output_filename
    }

@router.post("/api/projects/import")
async def import_project(
    title: str = Form(...),
    video: UploadFile = File(...),
    splat: UploadFile = File(...),
    cameras: UploadFile = File(...),
    dataparser: UploadFile = File(None)
):
    project_id = str(uuid.uuid4())
    
    # Validation: Ensure all files are present
    if not video or not splat or not cameras:
        raise HTTPException(status_code=400, detail="Missing required files for import")

    # Save video to uploads
    _, video_ext = os.path.splitext(video.filename)
    video_filename = f"{project_id}{video_ext}"
    video_path = os.path.join(UPLOAD_DIR, video_filename)
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
        
    # Create project export dir
    proj_export_dir = os.path.join(EXPORT_DIR, project_id)
    os.makedirs(proj_export_dir, exist_ok=True)
    
    # Save splat and cameras to export dir
    splat_path = os.path.join(proj_export_dir, "splat.ply")
    with open(splat_path, "wb") as buffer:
        shutil.copyfileobj(splat.file, buffer)
        
    cameras_path = os.path.join(proj_export_dir, "transforms_train.json")
    with open(cameras_path, "wb") as buffer:
        shutil.copyfileobj(cameras.file, buffer)
        
    # Optional dataparser transforms
    dp_url = None
    if dataparser:
        dp_path = os.path.join(proj_export_dir, "dataparser_transforms.json")
        with open(dp_path, "wb") as buffer:
            shutil.copyfileobj(dataparser.file, buffer)
        dp_url = f"http://localhost:8000/api/projects/{project_id}/dataparser-transforms"

    thumb_url = generate_thumbnail(video_path, project_id)

    # Create project entry
    new_project = {
        "id": project_id,
        "title": title,
        "lastOpened": datetime.now().strftime("%Y-%m-%d"),
        "img": thumb_url,
        "splat_url": f"http://localhost:8000/exports/{project_id}/splat.ply",
        "cameras_url": f"http://localhost:8000/api/projects/{project_id}/cameras",
        "video_url": f"http://localhost:8000/uploads/{video_filename}",
        "dataparser_transforms_url": dp_url,
    }
    
    # Update projects.json
    if os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, "r") as f:
            projects = json.load(f)
    else:
        projects = []
        
    projects.insert(0, new_project)
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=4)
        
    return {"status": "success", "project": new_project}
