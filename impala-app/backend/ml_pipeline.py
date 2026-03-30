import cv2
import os

def extract_frames(video_path: str, output_dir: str, fps_target: int = 5):
    """
    Extracts frames from a video file at a specific frame rate.
    fps_target: How many frames to extract per second of video. 
    (Gaussian splatting usually needs around 100-300 images total, not the full 30fps/60fps).
    """
    print(f"[ML PIPELINE] Starting frame extraction for: {video_path}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"[ML PIPELINE] Error: Cannot open video {video_path}")
        return False

    original_fps = round(cap.get(cv2.CAP_PROP_FPS))
    if original_fps == 0:
        original_fps = 30
        
    # Calculate how many frames to skip to match the target FPS
    # E.g., if original is 30fps and target is 5fps, we save every 6th frame.
    frame_interval = max(1, original_fps // fps_target)
    
    frame_count = 0
    saved_count = 0
    
    while True:
        success, frame = cap.read()
        if not success:
            break
            
        if frame_count % frame_interval == 0:
            frame_filename = os.path.join(output_dir, f"frame_{saved_count:04d}.jpg")
            cv2.imwrite(frame_filename, frame)
            saved_count += 1
            
        frame_count += 1
        
    cap.release()
    print(f"[ML PIPELINE] Extraction complete. Saved {saved_count} frames to {output_dir}")
    return True