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
    if (!videoRef.current || totalFrames === 0 || isExporting) return;

    const video = videoRef.current;

    if (isPlaying) {
      // Sync frame to video
      const updateFrame = () => {
        if (!isPlaying || !video) return;
        const progress = video.currentTime / video.duration;
        const frame = Math.min(Math.floor(progress * totalFrames), totalFrames - 1);
        if (frame !== useStore.getState().currentFrame) {
          useStore.getState().setCurrentFrame(frame);
        }
        requestAnimationFrame(updateFrame);
      };
      const raf = requestAnimationFrame(updateFrame);

      if (video.paused) {
        video.play().catch(() => {});
      }

      return () => cancelAnimationFrame(raf);
    } else {
      // Sync video to frame (when scrubbed manually)
      if (!video.paused) {
        video.pause();
      }

      const duration = video.duration;
      if (duration > 0) {
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