import React from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from './store';

export function VideoSync({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) {
    const { isPlaying, totalFrames, setCurrentFrame } = useStore();
  
    useFrame(() => {
      if (isPlaying && videoRef.current && totalFrames > 0) {
        const progress = videoRef.current.currentTime / videoRef.current.duration;
        const frame = Math.floor(progress * totalFrames);
        if (frame !== useStore.getState().currentFrame) {
          setCurrentFrame(frame);
        }
      }
    });
  
    return null;
  }