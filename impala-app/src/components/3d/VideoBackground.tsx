import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store';

interface VideoBackgroundProps {
  url?: string;
  visible: boolean;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ url, visible }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentFrame, isPlaying, totalFrames, setVideoElement, videoOpacity } = useStore();

  useEffect(() => {
    if (videoRef.current) {
        setVideoElement(videoRef.current);
    }
    if (!videoRef.current || totalFrames === 0) return;
        
    const duration = videoRef.current.duration;
    
    if (duration > 0) {

        const progress = currentFrame / (totalFrames - 1);
        const targetTime = progress * duration;

        if (Math.abs(videoRef.current.currentTime - targetTime) > 0.03) {
            videoRef.current.currentTime = targetTime;
        }
    }

    if (isPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else if (!isPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [currentFrame, isPlaying, totalFrames]);

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