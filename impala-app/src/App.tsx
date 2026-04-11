import { useState, useEffect } from 'react';
import { Header } from './components/header';
import { HomePage, type Project } from './components/ui/menus/homePage';
import { EditorView } from './components/layouts/EditorView';
import { useStore } from './store';

import { ToastContainer } from './components/ui/ToastContainer';
import { InitialLoader } from './components/ui/InitialLoader';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'project'>('home');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const { serverStatus, checkServerStatus, setCameraData, setVideoDimensions, setActiveTool, setIsCropping, activeSplatUrl, setIsAppLoading } = useStore();

  useEffect(() => {
    checkServerStatus().then(() => {
        // Hide loader after first check
        setTimeout(() => setIsAppLoading(false), 1000);
    });
    const id = setInterval(checkServerStatus, 5000);
    return () => clearInterval(id);
  }, [checkServerStatus, setIsAppLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // ── Global shortcuts — intercept BEFORE the input focus guard ──
      // Without this, Ctrl+S with focus on a number input lets the browser
      // fire its native "Save Page" dialog, causing a full-page reload.
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Only save when a project is open — not on the home page
        if (useStore.getState().activeProjectId) {
          useStore.getState().saveCurrentProject();
        }
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        console.log(e.shiftKey ? 'Redo triggered' : 'Undo triggered');
        return;
      }

      // ── Tool shortcuts — skip when typing in an input / textarea ──
      const target = e.target as HTMLElement;
      if (
          target.tagName === 'TEXTAREA' ||
          (target as HTMLInputElement).isContentEditable ||
          (target.tagName === 'INPUT' && /^(text|search|url|tel|email|password|number)$/i.test((target as HTMLInputElement).type))
      ) {
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
  }, [setActiveTool, setIsCropping]);

  const handleOpenProject = (project: Project) => {
    const { addToast, updateToast, loadProjectSettings } = useStore.getState();
    
    addToast("Opening Project", "Fetching camera and scene data...", "process", "loading-project");

    setActiveProject(project);
    setCurrentPage('project');
    useStore.getState().setActiveProjectId(project.id);
    useStore.getState().setActiveSplatUrl(project.splat_url);

    // Restore any previously saved settings from the project record
    fetch(`/api/projects`)
      .then(r => r.json())
      .then((allProjects: Project[]) => {
        const saved = allProjects.find(p => p.id === project.id);
        if (saved) loadProjectSettings(saved as Record<string, any>);
      })
      .catch(err => console.warn('[LOAD SETTINGS] Could not restore settings:', err));

    // Always use the relative proxy path so the fetch stays same-origin (avoids COOP issues).
    // The cameras_url stored in projects.json may be an absolute localhost:8000 URL — we strip it.
    const camerasUrlRaw = project.cameras_url || `http://localhost:8000/api/projects/${project.id}/cameras`;
    const camerasUrl = camerasUrlRaw.replace(/^https?:\/\/localhost:\d+/, '');

    fetch(camerasUrl)
      .then(r => r.json())
      .then(data => {
        updateToast("loading-project", { message: "Metadata loaded. Preparing 3D viewer...", progress: 30 });
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
            // Resolve FOV from available intrinsics, in priority order:
            //   1. fl_y + h (COLMAP / Nerfstudio splatfacto export)
            //   2. root camera_angle_y (Nerfstudio instant-ngp, vertical rad)
            //   3. root camera_angle_x (horizontal rad → convert to vertical)
            //   4. default 45°
            let fov = 45;
            let fovSource = 'default-45';
            const first = frames[0];
            const frameH = first.h ?? data.h;
            const frameFlY = first.fl_y ?? data.fl_y;

            console.log('[FOV] Intrinsics →', {
                'first.fl_y': first.fl_y, 'data.fl_y': data.fl_y, 'resolved fl_y': frameFlY,
                'first.h':    first.h,    'data.h':    data.h,    'resolved h':    frameH,
                'camera_angle_x': data.camera_angle_x,
                'camera_angle_y': data.camera_angle_y,
            });

            if (frameFlY && frameH) {
                fov = (2 * Math.atan(frameH / (2 * frameFlY))) * (180 / Math.PI);
                fovSource = `fl_y+h (${frameFlY.toFixed(1)} / ${frameH})`;
            } else if (data.camera_angle_y) {
                fov = data.camera_angle_y * (180 / Math.PI);
                fovSource = `camera_angle_y=${data.camera_angle_y.toFixed(4)} rad`;
            } else if (data.camera_angle_x) {
                const w = data.w || first.w || 1920;
                const h = data.h || first.h || 1080;
                const hFovRad = data.camera_angle_x;
                fov = (2 * Math.atan(Math.tan(hFovRad / 2) * (h / w))) * (180 / Math.PI);
                fovSource = `camera_angle_x→vFOV (${hFovRad.toFixed(4)} rad, ${w}×${h})`;
            }

            setCameraData(frames, fov);
            
            const w = data.w || first.w || 1920;
            const h = data.h || first.h || 1080;
            setVideoDimensions(w, h);
            
            console.log(`[FOV] Result: ${fov.toFixed(2)}° (source: ${fovSource}) | Res: ${w}×${h}`);

        } else {
            console.error("[ERROR] Couldn't find cameras array");
            updateToast("loading-project", { type: 'error', title: 'Load Error', message: "Invalid camera data received." });
        }
      })
      .catch(err => {
          console.error("[FATAL] Camera loading error:", err);
          updateToast("loading-project", { type: 'error', title: 'Load Failed', message: "Network error while fetching metadata." });
      });
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
          splatUrl={activeSplatUrl || activeProject?.splat_url} 
        />
      )}

      <ToastContainer />
      <InitialLoader />
    </div>
  );
}