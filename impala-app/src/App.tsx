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
      if (ctrl && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        e.stopPropagation();
        // Only save when a project is open — not on the home page
        if (useStore.getState().activeProjectId) {
          useStore.getState().saveCurrentProject();
        }
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
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
    useStore.getState().setActiveProxyUrl(project.proxy_url || null);

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

            // Frame matching and interpolation logic
            // Colmap drops blurry frames, meaning 'frames' is sparse compared to the actual video.
            const parsedFrames: any[] = [];
            let maxFrameIndex = 0;

            frames.forEach((f: any) => {
                const fp = f.file_path || '';
                const match = fp.match(/frame_(\d+)/i);
                if (match) {
                    const idx = parseInt(match[1], 10) - 1; // 1-indexed filename to 0-indexed array
                    parsedFrames[idx] = f;
                    if (idx > maxFrameIndex) maxFrameIndex = idx;
                }
            });

            // If we couldn't parse any frame filenames, fallback to the raw continuous array
            let finalFrames = frames;
            if (maxFrameIndex > 0 && maxFrameIndex < 100000) { // Safety bound
                finalFrames = new Array(maxFrameIndex + 1).fill(null);
                
                // Pass 1: Fill existings
                for (let i = 0; i <= maxFrameIndex; i++) {
                    if (parsedFrames[i]) finalFrames[i] = parsedFrames[i];
                }
                
                // Pass 2: Interpolate missing
                const firstValidParsedFrame = parsedFrames.find(f => f != null) || frames[0];

                import('three').then((THREE) => {
                    let lastValidIdx = 0;
                    for (let i = 0; i <= maxFrameIndex; i++) {
                        if (finalFrames[i]) {
                            lastValidIdx = i;
                            continue;
                        }
                        
                        // Find next valid
                        let nextValidIdx = i;
                        while (nextValidIdx <= maxFrameIndex && !finalFrames[nextValidIdx]) {
                            nextValidIdx++;
                        }
                        
                        if (nextValidIdx > maxFrameIndex || !finalFrames[lastValidIdx]) {
                            // If we can't interpolate, just duplicate the closest known matrix
                            // (Using firstValidParsedFrame prevents initial jumping if the first frames were dropped)
                            finalFrames[i] = finalFrames[lastValidIdx] || firstValidParsedFrame;
                            continue;
                        }

                        // Interpolate!
                        const f1 = finalFrames[lastValidIdx];
                        const f2 = finalFrames[nextValidIdx];
                        
                        const mRaw1 = f1.transform || f1.transform_matrix || f1.camera_to_world || [];
                        const mRaw2 = f2.transform || f2.transform_matrix || f2.camera_to_world || [];
                        const flat1 = Array.isArray(mRaw1[0]) ? mRaw1.flat() : mRaw1;
                        const flat2 = Array.isArray(mRaw2[0]) ? mRaw2.flat() : mRaw2;

                        if (flat1.length >= 12 && flat2.length >= 12) {
                            const m1 = new THREE.Matrix4().set(
                                flat1[0], flat1[1], flat1[2], flat1[3],
                                flat1[4], flat1[5], flat1[6], flat1[7],
                                flat1[8], flat1[9], flat1[10], flat1[11],
                                0, 0, 0, 1
                            );
                            const m2 = new THREE.Matrix4().set(
                                flat2[0], flat2[1], flat2[2], flat2[3],
                                flat2[4], flat2[5], flat2[6], flat2[7],
                                flat2[8], flat2[9], flat2[10], flat2[11],
                                0, 0, 0, 1
                            );
                            
                            const p1 = new THREE.Vector3().setFromMatrixPosition(m1);
                            const q1 = new THREE.Quaternion().setFromRotationMatrix(m1);
                            
                            const p2 = new THREE.Vector3().setFromMatrixPosition(m2);
                            const q2 = new THREE.Quaternion().setFromRotationMatrix(m2);
                            
                            const t = (i - lastValidIdx) / (nextValidIdx - lastValidIdx);
                            
                            const p3 = p1.clone().lerp(p2, t);
                            const q3 = q1.clone().slerp(q2, t);
                            
                            const m3 = new THREE.Matrix4().compose(p3, q3, new THREE.Vector3(1, 1, 1));
                            const e = m3.elements; // column-major
                            // We need to restore to the flat row-major layout expected by CameraSync
                            const newFlat = [
                                e[0], e[4], e[8], e[12],
                                e[1], e[5], e[9], e[13],
                                e[2], e[6], e[10], e[14]
                            ];
                            
                            finalFrames[i] = {
                                ...f1,
                                transform_matrix: [
                                    [newFlat[0], newFlat[1], newFlat[2], newFlat[3]],
                                    [newFlat[4], newFlat[5], newFlat[6], newFlat[7]],
                                    [newFlat[8], newFlat[9], newFlat[10], newFlat[11]]
                                ]
                            };
                        } else {
                            finalFrames[i] = f1;
                        }
                    }
                    
                    setCameraData(finalFrames, fov);
                });
            } else {
                setCameraData(finalFrames, fov);
            }
            
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
          proxyUrl={useStore.getState().activeProxyUrl || activeProject?.proxy_url}
        />
      )}

      <ToastContainer />
      <InitialLoader />
    </div>
  );
}