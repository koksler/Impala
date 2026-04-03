import os
import sys
import subprocess
import glob
import re

def run_nerfstudio_pipeline(video_path: str, project_id: str, progress_callback=None):
    """
    Runs the full Gaussian Splatting pipeline: Video -> COLMAP -> Splatfacto -> Export .ply
    """
    processed_dir = os.path.join("processed_data", project_id)
    os.makedirs(processed_dir, exist_ok=True)

    venv_scripts_dir = os.path.dirname(sys.executable)
    exe_ext = ".exe" if os.name == 'nt' else ""
    
    ns_process_exe = os.path.join(venv_scripts_dir, f"ns-process-data{exe_ext}")
    ns_train_exe = os.path.join(venv_scripts_dir, f"ns-train{exe_ext}")
    ns_export_exe = os.path.join(venv_scripts_dir, f"ns-export{exe_ext}")

    # envo
    my_env = os.environ.copy()
    my_env["PYTHONIOENCODING"] = "utf-8"
    my_env["PYTHONUTF8"] = "1"
    my_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1" 

    # Process Video (COLMAP)
    print(f"🚀 [PHASE 1] Starting COLMAP processing for {project_id}...")
    if progress_callback: progress_callback(5)
    process_cmd =[
        ns_process_exe, "video",
        "--data", video_path,
        "--output-dir", processed_dir,
        "--num-frames-target", "150" 
    ]
    
    try:
        subprocess.run(process_cmd, check=True, env=my_env)
        print(f"[PHASE 1] COLMAP finished successfully!")
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 1] Error during processing: {e}")
        return False

    # Train Gaussian Splatting
    print(f"[PHASE 2] Starting Splatfacto training...")
    if progress_callback: progress_callback(10)
    
    train_cmd =[
        ns_train_exe, "splatfacto",
        "--data", processed_dir,
        "--max-num-iterations", "7000", 
        "--project-name", project_id,
        "--viewer.quit-on-train-completion", "True"
    ]
    
    try:
        process = subprocess.Popen(
            train_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=my_env
        )
        
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            
            if "Training Finished" in line or "Use ctrl+c to quit" in line:
                print(f"\n[PHASE 2] Training done! Force-killing the viewer to prevent hang...")
                process.terminate()
                break
                
            if progress_callback:
                match = re.search(r'\((\d+\.\d+)%\)', line)
                if match:
                    percent = float(match.group(1))
                    ui_progress = 10 + int(percent * 0.8)
                    progress_callback(ui_progress)
                    
        process.wait()
        print(f"[PHASE 2] Training complete for {project_id}!")
    except Exception as e:
        print(f"[PHASE 2] Training failed: {e}")
        return False

    # Export stuff (.ply)
    print(f"[PHASE 3] Exporting 3D scene to .ply format...")
    if progress_callback: progress_callback(95)
    
    search_pattern = os.path.join("outputs", project_id, "splatfacto", "*", "config.yml")
    config_paths = glob.glob(search_pattern)
    
    if not config_paths:
        print(f"[PHASE 3] Could not find config.yml!")
        return False
    
    latest_config = max(config_paths, key=os.path.getctime)
    export_dir = os.path.join("exports", project_id)
    os.makedirs(export_dir, exist_ok=True)
    
    export_cmd =[
        ns_export_exe, "gaussian-splat",
        "--load-config", latest_config,
        "--output-dir", export_dir
    ]
    
    try:
        subprocess.run(export_cmd, check=True, env=my_env)
        print(f"[PHASE 3] Export complete! Saved to {export_dir}")
        if progress_callback: progress_callback(100)
        return True
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 3] Export failed: {e}")
        return False