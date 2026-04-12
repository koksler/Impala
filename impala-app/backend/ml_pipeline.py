import os
import sys
import subprocess
import glob
import re
import shutil

def run_nerfstudio_pipeline(video_path: str, project_id: str, progress_callback=None):
    """
    Runs the full Gaussian Splatting pipeline: 
    Video -> COLMAP -> Splatfacto -> Export .ply -> Export Cameras (GLB)
    """
    processed_dir = os.path.join("processed_data", project_id)
    os.makedirs(processed_dir, exist_ok=True)

    venv_scripts_dir = os.path.dirname(sys.executable)
    exe_ext = ".exe" if os.name == 'nt' else ""
    
    ns_process_exe = os.path.join(venv_scripts_dir, f"ns-process-data{exe_ext}")
    ns_train_exe = os.path.join(venv_scripts_dir, f"ns-train{exe_ext}")
    ns_export_exe = os.path.join(venv_scripts_dir, f"ns-export{exe_ext}")

    # Environment stuff HERE
    my_env = os.environ.copy()
    my_env["PYTHONIOENCODING"] = "utf-8"
    my_env["PYTHONUTF8"] = "1"
    my_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1" 

    # Phase 1: Processing shit
    
    print(f"[PHASE 1] Starting COLMAP processing for {project_id}...")
    if progress_callback: progress_callback(5)
    
    process_cmd =[
        ns_process_exe, "video",
        "--data", video_path,
        "--output-dir", processed_dir,
        "--num-frames-target", "1000" 
    ]
    
    try:
        subprocess.run(process_cmd, check=True, env=my_env)
        print(f"[PHASE 1] COLMAP finished successfully!")
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 1] Error during processing: {e}")
        return False

    # Phase 2: Train Gaussian Splatting
    
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
            
            # Watch for finish markers
            if "Training Finished" in line or "Use ctrl+c to quit" in line:
                print(f"\n[PHASE 2] Training done! Killing the viewer process...")
                process.terminate()
                break
                
            if progress_callback:
                match = re.search(r'\((\d+\.\d+)%\)', line)
                if match:
                    percent = float(match.group(1))
                    ui_progress = 10 + int(percent * 0.8) # Works wonky, have to redo
                    progress_callback(ui_progress)
                    
        process.wait()
        print(f"[PHASE 2] Training complete for {project_id}!")
    except Exception as e:
        print(f"[PHASE 2] Training failed: {e}")
        return False

    # Phase 3: Export 3D Scene (.ply)
    print(f"[PHASE 3] Exporting 3D scene to .ply format...")
    if progress_callback: progress_callback(92)
    
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
        print(f"[PHASE 3] .ply Export complete!")

        # Copy dataparser_transforms.json for compatibility
        dp_src = os.path.join(os.path.dirname(latest_config), "dataparser_transforms.json")
        dp_dst = os.path.join(processed_dir, "dataparser_transforms.json")
        if os.path.exists(dp_src):
            shutil.copy2(dp_src, dp_dst)
            print(f"[PHASE 3] Copied dataparser_transforms.json")

    except subprocess.CalledProcessError as e:
        print(f"[PHASE 3] .ply Export failed: {e}")
        return False

    # Phase 3.5: Export 3D Mesh (.obj) for proxy occlusion and shadows
    print(f"[PHASE 3.5] Exporting proxy mesh for VFX compositing...")
    if progress_callback: progress_callback(94)

    poisson_export_cmd = [
        ns_export_exe, "poisson",
        "--load-config", latest_config,
        "--output-dir", export_dir,
        "--target-num-faces", "50000",
        "--normal-method", "open3d"
    ]

    try:
        subprocess.run(poisson_export_cmd, check=True, env=my_env)
        print(f"[PHASE 3.5] Proxy Mesh exported successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 3.5] Proxy Mesh export failed: {e}")
        # We don't return False here because the mesh is optional. The splat can still be viewed.

    # Phase 4: Export Camera Trajectory
    print(f"[PHASE 4] Exporting Camera Trajectory to GLB/JSON...")
    if progress_callback: progress_callback(96)
    
    camera_export_cmd = [
        ns_export_exe, "cameras",
        "--load-config", latest_config,
        "--output-dir", export_dir
    ]
    
    try:
        subprocess.run(camera_export_cmd, check=True, env=my_env)
        print(f"[PHASE 4] Camera Export complete! Saved to {export_dir}")
        
        if progress_callback: progress_callback(100)
        return True
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 4] Camera Export failed: {e}")
        return False # Though we have the splat