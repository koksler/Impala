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

  return (
    <div className="relative flex-1 w-full bg-neutral-900 overflow-hidden">
      <VideoBackground url={videoUrl} visible={showVideo} />
      <EditorCanvas splatUrl={splatUrl} />
      <EditorUI />
    </div>
  );
};