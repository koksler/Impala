import { EditorCanvas } from '../editor/editorCanvas';
import { EditorUI } from '../editor/EditorUI';
import { VideoBackground } from '../3d/VideoBackground';
import { useStore } from '../../store';

interface EditorViewProps {
  videoUrl?: string;
  splatUrl?: string;
}

export const EditorView = ({ videoUrl, splatUrl }: EditorViewProps) => {
  const showVideo = useStore(state => state.showVideo);
  const videoDimensions = useStore(state => state.videoDimensions);

  const aspectRatio = videoDimensions 
    ? `${videoDimensions.width} / ${videoDimensions.height}` 
    : '16 / 9';

  return (
    <div className="relative flex-1 w-full bg-neutral-900 overflow-hidden flex items-center justify-center">
      <div 
        className="relative flex items-center justify-center"
        style={{ 
          aspectRatio, 
          maxWidth: '100%', 
          maxHeight: '100%',
          width: '100%',
          objectFit: 'contain' as any
        }}
      >
        <VideoBackground url={videoUrl} visible={showVideo} />
        <EditorCanvas splatUrl={splatUrl} />
      </div>
      <EditorUI />
    </div>
  );
};