import { EditorCanvas } from '../editor/editorCanvas';
import { EditorUI } from '../editor/EditorUI';
import { VideoBackground } from '../3d/VideoBackground';
import { useStore } from '../../store';
import { useEffect, useRef, useState } from 'react';

interface EditorViewProps {
  videoUrl?: string;
  splatUrl?: string;
  proxyUrl?: string;
}

export const EditorView = ({ videoUrl, splatUrl, proxyUrl }: EditorViewProps) => {
  const showVideo = useStore(state => state.showVideo);
  const videoDimensions = useStore(state => state.videoDimensions);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [exactSize, setExactSize] = useState({ width: '100%', height: '100%' });

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Default 16:9 if none loaded yet
    const videoRatio = videoDimensions ? (videoDimensions.width / videoDimensions.height) : (16 / 9);
    
    const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        const containerRatio = width / height;
        
        if (containerRatio > videoRatio) {
            // Container is wider than the video — constrain by height
            setExactSize({ width: `${height * videoRatio}px`, height: `${height}px` });
        } else {
            // Container is taller than the video — constrain by width
            setExactSize({ width: `${width}px`, height: `${width / videoRatio}px` });
        }
    });
    
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [videoDimensions]);

  return (
    <div className="relative flex-1 w-full bg-black overflow-hidden flex items-center justify-center p-4" ref={containerRef}>
      {/* Strictly enforce the calculated pixel sizing on this inner wrapper */}
      <div 
        className="relative bg-black flex items-center justify-center"
        style={{ 
          width: exactSize.width,
          height: exactSize.height
        }}
      >
        <VideoBackground url={videoUrl} visible={showVideo} />
        <EditorCanvas splatUrl={splatUrl} proxyUrl={proxyUrl} />
      </div>
      <EditorUI />
    </div>
  );
};