import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store';

interface VideoBackgroundProps {
  url?: string;
  visible: boolean;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ url, visible }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentFrame, isPlaying, totalFrames, setVideoElement, videoOpacity } = useStore();
  const isExporting = useStore(state => state.isExporting);  
  useEffect(() => {
    if (videoRef.current) {
      setVideoElement(videoRef.current);
    }
    // Cleanup: detach from store and stop playback on unmount
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      setVideoElement(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!videoRef.current || totalFrames === 0 || isExporting) return;

    const video = videoRef.current;

    if (isPlaying) {
      // Sync frame to video using hardware-accurate callback
      let callbackId: number;

      const syncFrame = (_now: number, metadata: any) => {
        if (!isPlaying || !video) return;

        const { totalFrames } = useStore.getState();
        const duration = video.duration;
        if (duration <= 0) return;

        // Unified Timing: Match scrub logic by deriving FPS from total duration
        const workingFps = (totalFrames - 1) / duration;
        
        // Exact hardware timestamp of the presented frame
        const fractionalIndex = Math.min(
          Math.max(0, metadata.mediaTime * workingFps),
          totalFrames - 1
        );

        // Perform "transient" store update to bypass React's render loop for CameraSync
        useStore.setState({ 
          currentFrameFractional: fractionalIndex,
          currentFrame: Math.floor(fractionalIndex) // Keep UI integer in sync
        });

        if ('requestVideoFrameCallback' in video) {
          callbackId = (video as any).requestVideoFrameCallback(syncFrame);
        } else {
          callbackId = requestAnimationFrame(() => syncFrame(performance.now(), { mediaTime: video.currentTime }));
        }
      };

      if (video.paused) {
        video.play().catch(() => {});
      }

      if ('requestVideoFrameCallback' in video) {
        callbackId = (video as any).requestVideoFrameCallback(syncFrame);
      } else {
        callbackId = requestAnimationFrame(() => syncFrame(performance.now(), { mediaTime: video.currentTime }));
      }

      return () => {
        if ('cancelVideoFrameCallback' in video) {
          (video as any).cancelVideoFrameCallback(callbackId);
        } else {
          cancelAnimationFrame(callbackId);
        }
      };
    } else {
      // Sync video to frame (when scrubbed manually)
      if (!video.paused) {
        video.pause();
      }

      const duration = video.duration;
      if (duration > 0) {
        // Ensure manual scrub also maintains fractional parity
        useStore.setState({ currentFrameFractional: currentFrame });

        const progress = currentFrame / (totalFrames - 1);
        const targetTime = Math.min(progress * duration, duration - 0.01);

        if (Math.abs(video.currentTime - targetTime) > 0.04) {
          video.currentTime = targetTime;
        }
      }
    }
  }, [isPlaying, totalFrames, isExporting, setVideoElement, currentFrame]);

  if (!url) return null;

  return (
    <div className={`absolute inset-0 z-20 pointer-events-none flex items-center justify-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-contain"
        style={{ opacity: videoOpacity }}
        crossOrigin="anonymous"
        muted 
        playsInline
      />
    </div>
  );
};