import os
import sys
import subprocess

def run_nerfstudio_pipeline(video_path: str, project_id: str):
    """
    Runs the full Gaussian Splatting pipeline: Video -> COLMAP -> Splatfacto Training.
    """
    processed_dir = os.path.join("processed_data", project_id)
    os.makedirs(processed_dir, exist_ok=True)

    # sys.executable automatically points to venv/Scripts on Windows and venv/bin on Linux
    venv_scripts_dir = os.path.dirname(sys.executable)
    
    # Windows uses .exe extensions, Linux/Mac do not
    exe_ext = ".exe" if os.name == 'nt' else ""
    
    # Build exact paths
    ns_process_exe = os.path.join(venv_scripts_dir, f"ns-process-data{exe_ext}")
    ns_train_exe = os.path.join(venv_scripts_dir, f"ns-train{exe_ext}")

    print(f"[PHASE 1] Starting COLMAP processing for {project_id}...")
    
    process_cmd = [
        ns_process_exe, "video",
        "--data", video_path,
        "--output-dir", processed_dir,
        "--num-frames-target", "150" 
    ]
    
    try:
        subprocess.run(process_cmd, check=True)
        print(f"[PHASE 1] COLMAP finished successfully!")
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 1] Error during processing: {e}")
        return False

    print(f"[PHASE 2] Starting Splatfacto training on RTX 3070...")
    
    train_cmd = [
        ns_train_exe, "splatfacto",
        "--data", processed_dir,
        # 7,000 for a draft
        "--max-num-iterations", "7000", 
        "--project-name", project_id
    ]
    
    try:
        subprocess.run(train_cmd, check=True)
        print(f"[PHASE 2] Training complete for {project_id}!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 2] Training failed: {e}")
        return False