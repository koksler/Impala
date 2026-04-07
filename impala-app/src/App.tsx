import { useState, useEffect } from 'react';
import { Header } from './components/header';
import { HomePage, type Project } from './components/ui/menus/homePage';
import { EditorView } from './components/layouts/EditorView';
import { useStore } from './store';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'project'>('home');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const { serverStatus, checkServerStatus, setCameraData, setVideoDimensions, setActiveTool, setIsCropping } = useStore();

  useEffect(() => {
    checkServerStatus();
    const id = setInterval(checkServerStatus, 5000);
    return () => clearInterval(id);
  }, [checkServerStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
          target.tagName === 'TEXTAREA' || 
          (target as HTMLInputElement).isContentEditable || 
          (target.tagName === 'INPUT' && /^(text|search|url|tel|email|password|number)$/i.test((target as HTMLInputElement).type))
      ) {
          return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      
      // Prevent default browser shortcuts for our global ones
      if (ctrl && e.key.toLowerCase() === 'z') {
         e.preventDefault();
         console.log(e.shiftKey ? "Redo triggered" : "Undo triggered");
         return;
      }
      
      if (ctrl && e.key.toLowerCase() === 's') {
         e.preventDefault();
         console.log("Save triggered");
         return;
      }

      if (!ctrl && !e.altKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'h': setActiveTool('hand'); break;
          case 'g': setActiveTool('translate'); break;
          case 'r': setActiveTool('rotate'); break;
          case 's': setActiveTool('scale'); break;
          case 'b': setActiveTool('brush'); break;
          case 'e': setActiveTool('eraser'); break;
          case 'c': setIsCropping(!useStore.getState().isCropping); break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool]);

  const handleOpenProject = (project: Project) => {
    setActiveProject(project);
    setCurrentPage('project');

    const camerasUrl = project.cameras_url || `http://localhost:8000/api/projects/${project.id}/cameras`;

    fetch(camerasUrl)
      .then(r => r.json())
      .then(data => {
        console.log("[DEBUG] Cam data:", data);

        let frames = [];
        if (Array.isArray(data)) {
            frames = data;
        } else if (data.cameras && Array.isArray(data.cameras)) {
            frames = data.cameras;
        } else if (data.frames && Array.isArray(data.frames)) {
            frames = data.frames;
        }

        if (frames.length > 0) {
            // FOV weird calc
            let fov = 45;
            const first = frames[0];
            if (first.fl_y && first.h) {
                fov = (2 * Math.atan(first.h / (2 * first.fl_y))) * (180 / Math.PI);
            }

            setCameraData(frames, fov);
            
            const w = data.w || first.w || 1920;
            const h = data.h || first.h || 1080;
            setVideoDimensions(w, h);
            
            console.log(`Loaded ${frames.length} frames. FOV: ${fov.toFixed(2)}`);
        } else {
            console.error("[ERROR] Couldn't find cameras array");
        }
      })
      .catch(err => console.error("[FATAL] Camera loading error:", err));
  };

  return (
    <div className="flex flex-col w-full h-screen bg-bg overflow-hidden text-text-main">
      <div className="flex-none w-full z-50">
        <Header 
          variant={currentPage} 
          projectName={activeProject?.title} 
          serverStatus={serverStatus} 
          onGoHome={() => setCurrentPage('home')} 
        />
      </div>

      {currentPage === 'home' ? (
        <HomePage onOpenProject={handleOpenProject} />
      ) : (
        <EditorView 
          videoUrl={activeProject?.video_url} 
          splatUrl={activeProject?.splat_url} 
        />
      )}
    </div>
  );
}