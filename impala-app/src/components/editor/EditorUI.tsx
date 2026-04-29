import { ObjectSettingsPanel } from '../ui/menus/objectSettingsPanel';
import { SceneSettingsPanel } from '../ui/menus/sceneSettingsPanel';
import { FloatingToolbar } from '../ui/menus/floatingToolbar';
import { TimelinePanel } from '../ui/menus/timelinePanel';
import { useState } from 'react';
import { useStore } from '../../store';

export const EditorUI = () => {
  const [minimized, setMinimized] = useState(false);
  const isExporting = useStore(state => state.isExporting);

  return (
    <div className={`absolute inset-0 pointer-events-none transition-all duration-500 ${isExporting ? 'opacity-50' : 'opacity-100'}`}>
      {/* Side Panels */}
      <div className="absolute inset-0 pointer-events-none z-40 p-4 flex justify-between items-start pt-[20px]">
        <div className="pointer-events-none h-full">
          <ObjectSettingsPanel isMinimized={minimized} onToggleMinimize={() => setMinimized(!minimized)} />
        </div>
        <div className="pointer-events-none h-full">
          <SceneSettingsPanel isMinimized={minimized} />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-end items-center mb-5 gap-[5px]">
        <div className="pointer-events-auto">
          <FloatingToolbar />
        </div>
        <div className="pointer-events-auto">
          <TimelinePanel />
        </div>
      </div>
    </div>
  );
};