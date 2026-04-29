import gc
import glob
import json
import multiprocessing
import os
import re
import shutil
import subprocess
import sys

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE,
)
_ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

# Minimum fraction of frames that must be registered by COLMAP to continue.
_MIN_FRAME_REGISTRATION_RATE = 0.95


def _validate_project_id(project_id: str) -> str:
    """
    Assert project_id is a canonical UUID v4.
    Returns the lower-cased ID so callers can use it directly.
    Raises ValueError if the format is invalid.
    """
    if not _UUID_RE.match(project_id):
        raise ValueError(f"Invalid project_id format: {project_id!r}")
    return project_id.lower()


def _safe_join(base: str, *parts: str) -> str:
    """
    Join *parts* onto *base* and verify the result stays inside *base*.
    Raises ValueError on path-traversal attempts.
    """
    target = os.path.realpath(os.path.join(base, *parts))
    base_real = os.path.realpath(base)
    if os.path.commonpath([base_real, target]) != base_real:
        raise ValueError(f"Path traversal detected: {target!r} escapes {base_real!r}")
    return target


def _terminate_process(process: subprocess.Popen, timeout: int = 30) -> None:
    """
    Gracefully terminate a subprocess, escalating to SIGKILL after *timeout*
    seconds so that process.wait() can never block forever.
    """
    process.terminate()
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def _get_gpu_info() -> tuple[int, int]:
    """
    Returns (gpu_count, vram_mb_of_best_gpu).
    Falls back to (0, 0) if torch / CUDA is unavailable.
    """
    try:
        import torch
        if not torch.cuda.is_available():
            return 0, 0
        count = torch.cuda.device_count()
        best_vram = max(
            torch.cuda.get_device_properties(i).total_memory
            for i in range(count)
        ) // (1024 * 1024)
        return count, best_vram
    except Exception:
        return 0, 0


def _free_vram() -> None:
    """
    Release cached GPU memory and run a Python GC cycle.
    Safe to call even when CUDA/torch is not installed.
    """
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.synchronize()
            torch.cuda.empty_cache()
    except Exception:
        pass
    gc.collect()

def _check_colmap_gpu() -> None:
    """
    Runs a quick test on the system's COLMAP installation to see if it supports CUDA.
    Prints a visible console warning if it's missing or CPU-only.
    """
    try:
        # Check if colmap is in PATH and look at its feature_extractor help menu
        result = subprocess.run(["colmap", "feature_extractor", "--help"], 
            capture_output=True, text=True
        )
        
        if "use_gpu" in result.stdout:
            print("\n" + "="*70)
            print(" ✅ [GPU CHECK] CUDA-enabled COLMAP detected in system PATH!")
            print("               Phase 1 (Feature Extraction) WILL use your GPU.")
            print("="*70 + "\n")
        else:
            print("\n" + "="*70)
            print(" ⚠️ [GPU CHECK] COLMAP found, but it might not have CUDA support!")
            print("               If Phase 1 takes more than 15 minutes, abort the")
            print("               process and install the 'windows-cuda' COLMAP zip.")
            print("="*70 + "\n")
            
    except FileNotFoundError:
        print("\n" + "="*70)
        print(" ❌ [GPU CHECK] 'colmap' is NOT in your system PATH!")
        print("               Nerfstudio is using a fallback that will run entirely")
        print("               on your CPU. This is why it takes 4+ hours.")
        print("               Please install CUDA COLMAP and add it to your PATH.")
        print("="*70 + "\n")
    except Exception as e:
        print(f"\n[GPU CHECK] Could not verify COLMAP status: {e}\n")
        
        
def _create_proxy_video(input_path: str, processed_dir: str) -> str:
    """
    Downscales the video to a max dimension of 960px to massively speed up COLMAP.
    Maintains exact frame count, timing, and aspect ratio.
    """
    proxy_path = os.path.join(processed_dir, "proxy_video.mp4")

    vf_scale = r"scale=if(gt(iw\,ih)\,960\,-2):if(gt(iw\,ih)\,-2\,960)"
    
    cmd =[
        "ffmpeg", "-y", 
        "-i", input_path,
        "-vf", vf_scale, 
        "-c:v", "libx264", 
        "-crf", "23", 
        "-preset", "fast",
        proxy_path
    ]
    
    try:
        print(f"\n[PROXY] Generating 960px proxy video for {os.path.basename(input_path)}...")
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        print(f"[PROXY] Proxy created successfully at {proxy_path}\n")
        return proxy_path
        
    except subprocess.CalledProcessError as e:
        print(f"\n[PROXY ERROR] FFmpeg failed with exit code {e.returncode}")
        print(f"[PROXY ERROR] FFmpeg output: {e.stderr}")
        print("[PROXY] Falling back to high-res video...\n")
        return input_path

def _check_colmap_registration(
    processed_dir: str,
    total_frames: int,
    min_rate: float = _MIN_FRAME_REGISTRATION_RATE,
) -> tuple[bool, int, float]:
    """
    Read the transforms.json produced by COLMAP and verify that enough
    frames were successfully registered.

    Returns (ok, registered_count, rate).
    """
    transforms_path = os.path.join(processed_dir, "transforms.json")
    if not os.path.exists(transforms_path):
        print("[PHASE 1] transforms.json not found — cannot verify frame registration.")
        return False, 0, 0.0

    try:
        with open(transforms_path, "r", encoding="utf-8") as f:
            transforms = json.load(f)
    except Exception as e:
        print(f"[PHASE 1] Failed to parse transforms.json: {e}")
        return False, 0, 0.0

    registered = len(transforms.get("frames",[]))
    rate = registered / total_frames if total_frames > 0 else 0.0
    return rate >= min_rate, registered, rate


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_nerfstudio_pipeline(
    video_path: str,
    project_id: str,
    total_frames: int,
    progress_callback=None,
):
    """
    Runs the full Gaussian Splatting pipeline:
    Video -> COLMAP -> Splatfacto -> Export .ply -> Export Cameras (GLB)

    Returns True on full success, False if any critical phase fails.
    """
    # ---- guard: project_id must be a valid UUID v4 -------------------------
    try:
        project_id = _validate_project_id(project_id)
    except ValueError as exc:
        print(f"[PIPELINE] Rejected invalid project_id: {exc}")
        return False

    # ---- resource detection ------------------------------------------------
    cpu_count = multiprocessing.cpu_count()
    gpu_count, best_vram_mb = _get_gpu_info()
    print(
        f"[PIPELINE] Resources: {cpu_count} CPU threads, "
        f"{gpu_count} GPU(s), best VRAM: {best_vram_mb} MB"
    )

    cwd = os.path.abspath(".")
    processed_dir = _safe_join(cwd, "processed_data", project_id)
    os.makedirs(processed_dir, exist_ok=True)

    venv_scripts_dir = os.path.dirname(sys.executable)
    exe_ext = ".exe" if os.name == "nt" else ""

    ns_process_exe = os.path.join(venv_scripts_dir, f"ns-process-data{exe_ext}")
    ns_train_exe   = os.path.join(venv_scripts_dir, f"ns-train{exe_ext}")
    ns_export_exe  = os.path.join(venv_scripts_dir, f"ns-export{exe_ext}")

    my_env = os.environ.copy()
    my_env["PYTHONIOENCODING"]              = "utf-8"
    my_env["PYTHONUTF8"]                    = "1"
    my_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
    
    # Tell OpenMP / BLAS / MKL to use all available CPU cores
    my_env["OMP_NUM_THREADS"]               = str(cpu_count)
    my_env["OPENBLAS_NUM_THREADS"]          = str(cpu_count)
    my_env["MKL_NUM_THREADS"]               = str(cpu_count)
    
    if gpu_count > 0:
        my_env["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"

    # ------------------------------------------------------------------ #
    # Phase 1 – COLMAP processing                                         #
    # ------------------------------------------------------------------ #
    print(f"[PHASE 1] Starting COLMAP processing for {project_id}...")
    _check_colmap_gpu()
    if progress_callback:
        progress_callback(5)

    proxy_video_path = _create_proxy_video(video_path, processed_dir)

    target_frames = str(total_frames + 50) if total_frames > 0 else "1500"

    process_cmd =[
        ns_process_exe, "video",
        "--data",                proxy_video_path,  # <--- UPDATED
        "--output-dir",          processed_dir,
        "--num-frames-target",   target_frames,
        "--matching-method",     "sequential",
    ]

    try:
        subprocess.run(process_cmd, check=True, env=my_env)
        print("[PHASE 1] COLMAP finished successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 1] Error during processing: {e}")
        return False

    # ---- edge-case: abort if too few frames were registered ----------------
    ok, registered, rate = _check_colmap_registration(processed_dir, total_frames)
    if not ok:
        print(
            f"[PHASE 1] ABORT — COLMAP registered only {registered}/{total_frames} "
            f"frames ({rate:.1%}), which is below the required "
            f"{_MIN_FRAME_REGISTRATION_RATE:.0%} threshold.\n"
            f"          Possible causes: motion blur, featureless surfaces, "
            f"rapid camera movement, or very short video."
        )
        return False

    print(f"[PHASE 1] Frame registration: {registered}/{total_frames} ({rate:.1%}) — OK")

    # ------------------------------------------------------------------ #
    # Phase 2 – Train Gaussian Splatting                                  #
    # ------------------------------------------------------------------ #
    print("[PHASE 2] Starting Splatfacto training...")
    if progress_callback:
        progress_callback(10)

    # 4000 iterations is plenty for a high-quality splat.
    train_cmd =[
        ns_train_exe, "splatfacto",
        "--data",                                   processed_dir,
        "--max-num-iterations",                     "4000",
        "--project-name",                           project_id,
        "--viewer.quit-on-train-completion",        "True",
        "--steps-per-save",                         "4000",
        "--steps-per-eval-image",                   "500",
        "--steps-per-eval-all-images",              "4000",
    ]

    try:
        process = subprocess.Popen(
            train_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=my_env,
        )

        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()

            clean_line = _ANSI_ESCAPE.sub("", line)

            match = re.search(r"(\d{1,3})%", clean_line)
            if match:
                percent = int(match.group(1))
                ui_progress = 10 + int(percent * 0.8)
                if progress_callback:
                    progress_callback(ui_progress)

            if "Training Finished" in clean_line or "Use ctrl+c to quit" in clean_line:
                print("\n[PHASE 2] Training done — terminating viewer process...")
                _terminate_process(process)
                break

        try:
            process.stdout.read()
        except Exception:
            pass
        process.wait()

        print(f"[PHASE 2] Training complete for {project_id}!")

    except Exception as e:
        print(f"[PHASE 2] Training failed: {e}")
        return False

    finally:
        print("[PHASE 2] Releasing VRAM...")
        _free_vram()
        print("[PHASE 2] VRAM released.")

    # ------------------------------------------------------------------ #
    # Phase 3 – Export 3D Scene (.ply)                                    #
    # ------------------------------------------------------------------ #
    print("[PHASE 3] Exporting 3D scene to .ply format...")
    if progress_callback:
        progress_callback(92)

    outputs_dir = _safe_join(cwd, "outputs", project_id, "splatfacto")
    search_pattern = os.path.join(outputs_dir, "*", "config.yml")
    config_paths = glob.glob(search_pattern)

    if not config_paths:
        print("[PHASE 3] Could not find config.yml — training output may be missing.")
        return False

    latest_config = max(config_paths, key=os.path.getmtime)
    export_dir = _safe_join(cwd, "exports", project_id)
    os.makedirs(export_dir, exist_ok=True)

    export_cmd =[
        ns_export_exe, "gaussian-splat",
        "--load-config",  latest_config,
        "--output-dir",   export_dir,
    ]

    try:
        subprocess.run(export_cmd, check=True, env=my_env)
        print("[PHASE 3] .ply export complete.")

        dp_src = os.path.join(os.path.dirname(latest_config), "dataparser_transforms.json")
        dp_dst = os.path.join(processed_dir, "dataparser_transforms.json")
        if os.path.exists(dp_src):
            shutil.copy2(dp_src, dp_dst)
            print("[PHASE 3] Copied dataparser_transforms.json.")

    except subprocess.CalledProcessError as e:
        print(f"[PHASE 3] .ply export failed: {e}")
        return False

    # ------------------------------------------------------------------ #
    # Phase 3.5 – Export proxy mesh (.obj)                                #
    # ------------------------------------------------------------------ #
    print("[PHASE 3.5] Exporting proxy mesh for VFX compositing...")
    if progress_callback:
        progress_callback(94)

    poisson_export_cmd =[
        ns_export_exe, "poisson",
        "--load-config",       latest_config,
        "--output-dir",        export_dir,
        "--target-num-faces",  "50000",
        "--normal-method",     "open3d",
    ]

    try:
        subprocess.run(poisson_export_cmd, check=True, env=my_env)
        print("[PHASE 3.5] Proxy mesh exported successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 3.5] Proxy mesh export failed (non-fatal): {e}")

    # ------------------------------------------------------------------ #
    # Phase 4 – Export Camera Trajectory                                  #
    # ------------------------------------------------------------------ #
    print("[PHASE 4] Exporting camera trajectory to GLB/JSON...")
    if progress_callback:
        progress_callback(96)

    camera_export_cmd =[
        ns_export_exe, "cameras",
        "--load-config",  latest_config,
        "--output-dir",   export_dir,
    ]

    try:
        subprocess.run(camera_export_cmd, check=True, env=my_env)
        print(f"[PHASE 4] Camera export complete — saved to {export_dir}")
        if progress_callback:
            progress_callback(100)
        return True
    except subprocess.CalledProcessError as e:
        print(f"[PHASE 4] Camera export failed: {e}")
        return False