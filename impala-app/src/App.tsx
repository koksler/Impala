import { useState, useEffect } from 'react';
import { Header } from './components/header';
import { HomePage, type Project } from './components/ui/menus/homePage';
import { EditorView } from './components/layouts/EditorView';
import { useStore } from './store';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'project'>('home');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const { serverStatus, checkServerStatus, setCameraData, setDataparserTransform } = useStore();

  useEffect(() => {
    checkServerStatus();
    const id = setInterval(checkServerStatus, 5000);
    return () => clearInterval(id);
  }, [checkServerStatus]);

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