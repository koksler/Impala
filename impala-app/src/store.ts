import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as THREE from 'three';

/** The 3x4 applied_transform matrix + scale from nerfstudio's dataparser_transforms.json.
 * This aligns raw camera poses (transforms.json) with the exported .ply splat space. */
export interface DataparserTransform {
    transform: number[][];  // 3x4 row-major matrix
    scale: number;
}

export type ToastType = 'process' | 'error' | 'success';

export type Toast = {
    id: string;
    title: string;
    message: string;
    type: ToastType;
    progress?: number;
};

interface AppState {
    serverStatus: 'online' | 'offline' | 'checking';
    checkServerStatus: () => Promise<void>;

    isPlaying: boolean;
    currentFrame: number;
    totalFrames: number;
    fps: number;
    setPlaying: (playing: boolean) => void;
    setCurrentFrame: (frame: number) => void;

    cameraData: CameraFrame[] | null;
    cameraFov: number;
    setCameraData: (data: CameraFrame[], fov: number) => void;

    dataparsedTransform: DataparserTransform | null;
    setDataparserTransform: (t: DataparserTransform) => void;

    cameraEnabled: boolean;

    showVideo: boolean;
    showModels: boolean;
    showGrid: boolean;
    showSplat: boolean;
    showCameraPath: boolean;
    toggleVisibility: (key: 'showVideo' | 'showModels' | 'showGrid' | 'showSplat' | 'showCameraPath') => void;

    videoOpacity: number;
    setVideoOpacity: (v: number) => void;

    transformTarget: 'object' | 'scene';
    setTransformTarget: (t: 'object' | 'scene') => void;

    scenePos: [number, number, number];
    sceneRot: [number, number, number];
    sceneScale: [number, number, number];
    setScenePos: (pos: [number, number, number]) => void;
    setSceneRot: (rot: [number, number, number]) => void;
    setSceneScale: (scale: [number, number, number]) => void;

    videoDimensions: { width: number; height: number } | null;
    setVideoDimensions: (width: number, height: number) => void;

    activeTool: string;
    setActiveTool: (tool: string) => void;

    videoElement: HTMLVideoElement | null;
    setVideoElement: (el: HTMLVideoElement | null) => void;

    snapToGrid: boolean;
    setSnapToGrid: (val: boolean) => void;
    isCropping: boolean;
    setIsCropping: (val: boolean) => void;

    splatViewer: any | null;
    setSplatViewer: (viewer: any) => void;

    cropBox: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    };
    setCropBox: (transform: Partial<{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] }>) => void;

    objPos: [number, number, number];
    objRot: [number, number, number];
    objScale: [number, number, number];
    setObjPos: (pos: [number, number, number]) => void;
    setObjRot: (rot: [number, number, number]) => void;
    setObjScale: (scale: [number, number, number]) => void;

    customModelUrl: string | null;
    setCustomModelUrl: (url: string | null) => void;
    customModelName: string | null;
    setCustomModelName: (name: string | null) => void;

    shadowOpacity: number;
    shadowBlur: number;
    shadowColor: string;
    matRoughness: number;
    matMetallic: number;
    setShadowOpacity: (val: number) => void;
    setShadowBlur: (val: number) => void;
    setShadowColor: (val: string) => void;
    setMatRoughness: (val: number) => void;
    setMatMetallic: (val: number) => void;

    envIntensity: number;
    envRotation: number;
    envTint: string;
    setEnvIntensity: (val: number) => void;
    setEnvRotation: (val: number) => void;
    setEnvTint: (val: string) => void;

    bakedEnvTexture: import('three').Texture | null;
    setBakedEnvTexture: (texture: import('three').Texture | null) => void;
    bakedEnvPreview: string | null;
    setBakedEnvPreview: (preview: string | null) => void;
    isBakingEnv: boolean;
    setIsBakingEnv: (val: boolean) => void;

    threeContext: { gl: any, scene: any, camera: any } | null;
    setThreeContext: (gl: any, scene: any, camera: any) => void;

    activeProjectId: string | null;
    setActiveProjectId: (id: string | null) => void;
    activeSplatUrl: string | null;
    setActiveSplatUrl: (url: string | null) => void;
    activeProxyUrl: string | null;
    setActiveProxyUrl: (url: string | null) => void;

    objBounds: [number, number, number];
    setObjBounds: (bounds: [number, number, number]) => void;

    toasts: Toast[];
    addToast: (title: string, message: string, type: ToastType, id?: string) => string;
    updateToast: (id: string, updates: Partial<Toast>) => void;
    removeToast: (id: string) => void;

    setIsAppLoading: (loading: boolean) => void;
    preExportState: any;
    isExporting: boolean;
    setIsExporting: (exporting: boolean) => void;
    startExportPipeline: () => void;
    exportVideo: () => Promise<void>;

    saveCurrentProject: () => Promise<void>;
    loadProjectSettings: (projectData: Record<string, any>) => void;

    // HISTORY (Undo/Redo)
    lastCommittedState: any | null;
    undoStack: any[];
    redoStack: any[];
    pushToHistory: () => void;
    undo: () => void;
    redo: () => void;
    clearHistory: () => void;

    // SETTINGS
    isSettingsOpen: boolean;
    setIsSettingsOpen: (val: boolean) => void;
    settingsTab: string;
    setSettingsTab: (val: string) => void;
    colorScheme: 'Light' | 'Dark' | 'System';
    setColorScheme: (val: 'Light' | 'Dark' | 'System') => void;
    primaryColor: string;
    setPrimaryColor: (val: string) => void;
    framerateLimit: string;
    setFramerateLimit: (val: string) => void;
    uiScale: string;
    setUiScale: (val: string) => void;
    autosave: boolean;
    setAutosave: (val: boolean) => void;
    maxIterations: number;
    setMaxIterations: (val: number) => void;
    autoCrop: boolean;
    setAutoCrop: (val: boolean) => void;
    backendUrl: string;
    setBackendUrl: (val: string) => void;
    language: string;
    setLanguage: (val: string) => void;
    cameraPreset: string;
    setCameraPreset: (val: string) => void;
}


interface CameraFrame {
    file_path: string;
    transform_matrix?: number[][];
    transform?: number[][];
    matrix?: number[][];
    [key: string]: any;
}


export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
    serverStatus: 'checking',

    checkServerStatus: async () => {
        try {
            const baseUrl = get().backendUrl;
            const response = await fetch(`${baseUrl}/api/status`);
            if (response.ok) {
                set({ serverStatus: 'online' });
            } else {
                set({ serverStatus: 'offline' });
            }
        } catch (error) {
            set({ serverStatus: 'offline' });
        }
    },
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 0,
    fps: 24,
    cameraData: null,
    dataparsedTransform: null,
    cameraEnabled: false,
    showVideo: true,
    showModels: true,
    showGrid: true,
    showSplat: true,
    showCameraPath: true,
    cameraFov: 45,
    toggleVisibility: (key) => set((state) => ({ [key]: !state[key] })),

    videoOpacity: 0.5,
    setVideoOpacity: (videoOpacity) => set({ videoOpacity }),

    transformTarget: 'object',
    setTransformTarget: (transformTarget) => set({ transformTarget }),

    scenePos: [0, 0, 0],
    sceneRot: [0, 0, 0],
    sceneScale: [1, 1, 1],
    setScenePos: (scenePos) => set({ scenePos }),
    setSceneRot: (sceneRot) => set({ sceneRot }),
    setSceneScale: (sceneScale) => set({ sceneScale }),

    videoDimensions: null,
    setVideoDimensions: (width, height) => set({ videoDimensions: { width, height } }),

    activeTool: 'hand',
    setActiveTool: (activeTool) => set({ activeTool }),

    videoElement: null,
    setVideoElement: (videoElement) => set({ videoElement }),

    snapToGrid: false,
    setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
    isCropping: false,
    setIsCropping: (isCropping) => set({ isCropping }),

    splatViewer: null,
    setSplatViewer: (splatViewer) => set({ splatViewer }),

    cropBox: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [2, 2, 2],
    },
    setCropBox: (transform) => set((state) => ({ cropBox: { ...state.cropBox, ...transform } })),

    objPos: [0, 0.5, 0],
    objRot: [0, 0, 0],
    objScale: [1, 1, 1],
    setObjPos: (objPos) => set({ objPos }),
    setObjRot: (objRot) => set({ objRot }),
    setObjScale: (objScale) => set({ objScale }),

    customModelUrl: null,
    setCustomModelUrl: (customModelUrl) => set({ customModelUrl }),
    customModelName: null,
    setCustomModelName: (customModelName) => set({ customModelName }),

    shadowOpacity: 0.4,
    shadowBlur: 0.5,
    shadowColor: '#313133',
    matRoughness: 0.2,
    matMetallic: 0.8,
    setShadowOpacity: (shadowOpacity) => set({ shadowOpacity }),
    setShadowBlur: (shadowBlur) => set({ shadowBlur }),
    setShadowColor: (shadowColor) => set({ shadowColor }),
    setMatRoughness: (matRoughness) => set({ matRoughness }),
    setMatMetallic: (matMetallic) => set({ matMetallic }),

    envIntensity: 1,
    envRotation: 0,
    envTint: '#ffffff',
    setEnvIntensity: (envIntensity) => set({ envIntensity }),
    setEnvRotation: (envRotation) => set({ envRotation }),
    setEnvTint: (envTint) => set({ envTint }),

    bakedEnvTexture: null,
    setBakedEnvTexture: (bakedEnvTexture) => set({ bakedEnvTexture }),
    bakedEnvPreview: null,
    setBakedEnvPreview: (bakedEnvPreview) => set({ bakedEnvPreview }),
    isBakingEnv: false,
    setIsBakingEnv: (isBakingEnv) => set({ isBakingEnv }),

    threeContext: null,
    setThreeContext: (gl, scene, camera) => set({ threeContext: { gl, scene, camera } }),

    activeProjectId: null,
    setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
    activeSplatUrl: null,
    setActiveSplatUrl: (activeSplatUrl) => set({ activeSplatUrl }),
    activeProxyUrl: null,
    setActiveProxyUrl: (activeProxyUrl) => set({ activeProxyUrl }),

    objBounds: [1, 1, 1],
    setObjBounds: (objBounds) => set({ objBounds }),

    setPlaying: (isPlaying) => set({ isPlaying }),
    setCurrentFrame: (currentFrame) => set({ currentFrame }),
    setDataparserTransform: (dataparsedTransform) => set({ dataparsedTransform }),
    setCameraData: (data: any[], fov: number) => set({
        cameraData: data,
        cameraFov: fov,
        totalFrames: data.length,
        currentFrame: 0,
        cameraEnabled: true
    }),

    toasts: [],
    addToast: (title, message, type, id) => {
        const toastId = id || Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { id: toastId, title, message, type, progress: type === 'process' ? 0 : undefined }]
        }));

        if (type !== 'process') {
            setTimeout(() => {
                useStore.getState().removeToast(toastId);
            }, 5000);
        }

        return toastId;
    },
    updateToast: (id, updates) => {
        set((state) => ({
            toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t))
        }));

        if (updates.type && updates.type !== 'process') {
            setTimeout(() => {
                useStore.getState().removeToast(id);
            }, 5000);
        }
    },
    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
    })),

    isAppLoading: true,
    setIsAppLoading: (isAppLoading) => set({ isAppLoading }),

    preExportState: null,
    isExporting: false,
    setIsExporting: (isExporting) => set({ isExporting }),

    startExportPipeline: () => {
        const state = useStore.getState();
        state.exportVideo();
    },

    exportVideo: async () => {
        const state = useStore.getState();
        if (!state.activeProjectId || !state.videoElement || state.totalFrames === 0) return;

        const { gl, scene, camera } = state.threeContext || {};
        if (!gl || !scene || !camera) return;

        const preExportState = {
            cameraEnabled: state.cameraEnabled,
            showGrid: state.showGrid,
            activeTool: state.activeTool,
            isPlaying: state.isPlaying,
            currentFrame: state.currentFrame,
            showSplat: state.showSplat,
        };

        state.setIsExporting(true);
        state.setPlaying(false);

        const toastId = state.addToast('Exporting Video', 'Initializing render pipeline...', 'process', 'export-video');

        const { activeProjectId, totalFrames, videoDimensions, fps, videoElement, cameraData } = state;
        const width = videoDimensions?.width || 1920;
        const height = videoDimensions?.height || 1080;

        let glCanvas = document.querySelector('canvas[data-engine^="three.js"]') as HTMLCanvasElement;

        const tetoCanvas = document.createElement('canvas'); tetoCanvas.width = width; tetoCanvas.height = height;
        const tetoCtx = tetoCanvas.getContext('2d', { willReadFrequently: true })!;

        const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;

        const finalCanvas = document.createElement('canvas'); finalCanvas.width = width; finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d')!;

        // --- СОХРАНЯЕМ СОСТОЯНИЕ WEBGL ---
        const oldAutoClear = gl.autoClear;
        const oldBg = scene.background;
        const oldToneMapping = gl.toneMapping;
        const oldToneMappingExposure = gl.toneMappingExposure;
        const oldOutputColorSpace = gl.outputColorSpace;
        const WORLD_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

        try {
            set({ cameraEnabled: true, showGrid: false, activeTool: 'hand' });

            // --- УЛУЧШЕНИЕ ОСВЕЩЕНИЯ И ЦВЕТА ---
            gl.autoClear = false;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1; // Делаем чуть светлее и контрастнее
            gl.outputColorSpace = THREE.SRGBColorSpace;

            const modelsGroup = scene.getObjectByName('custom-model-group');
            const shadowCatcher = scene.getObjectByName('shadow-catcher');
            const splatViewer = useStore.getState().splatViewer;

            let currentBatch: { blob: Blob, index: number }[] = [];

            for (let i = 0; i < totalFrames; i++) {
                useStore.getState().setCurrentFrame(i);

                // 1. Sync Video
                await new Promise<void>(resolve => {
                    let fired = false;
                    const onSeeked = () => {
                        if (!fired) {
                            fired = true;
                            videoElement.removeEventListener('seeked', onSeeked);
                            resolve();
                        }
                    };
                    videoElement.addEventListener('seeked', onSeeked);
                    videoElement.currentTime = (totalFrames > 1 ? i / (totalFrames - 1) : 0) * videoElement.duration;
                    setTimeout(onSeeked, 200);
                });

                // 2. Sync Camera
                if (cameraData && cameraData[i]) {
                    const raw = cameraData[i].transform || cameraData[i].camera_to_world || cameraData[i].transform_matrix;
                    if (raw) {
                        const f = Array.isArray(raw[0]) ? raw.flat() : raw;
                        const mat = new THREE.Matrix4().set(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[11], 0, 0, 0, 1);
                        const finalMatrix = new THREE.Matrix4().multiplyMatrices(WORLD_ROTATION, mat);
                        const s = useStore.getState();
                        const sceneTransform = new THREE.Matrix4().compose(
                            new THREE.Vector3(...s.scenePos),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.sceneRot)),
                            new THREE.Vector3(...s.sceneScale)
                        );
                        camera.matrixAutoUpdate = false;
                        camera.matrix.copy(new THREE.Matrix4().multiplyMatrices(sceneTransform, finalMatrix));
                        camera.updateMatrixWorld(true);
                        (camera as THREE.PerspectiveCamera).fov = s.cameraFov;
                        (camera as THREE.PerspectiveCamera).aspect = width / height;
                        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
                    }
                }

                // 3. Trigger Splat Worker
                if (splatViewer) splatViewer.visible = true;
                gl.render(scene, camera);
                await new Promise(r => setTimeout(r, 50));

                scene.background = null;
                gl.setClearColor(0x000000, 0);

                // ==========================================
                // PASS 1: 3D MODELS ONLY
                // ==========================================
                if (splatViewer) splatViewer.visible = false;
                if (shadowCatcher) shadowCatcher.visible = true;
                if (modelsGroup) {
                    modelsGroup.visible = true;
                    modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = true; });
                }
                gl.clear(true, true, true);
                gl.render(scene, camera);
                tetoCtx.clearRect(0, 0, width, height);
                tetoCtx.drawImage(glCanvas, 0, 0, width, height);

                // ==========================================
                // PASS 2: THE MASK (WITH DEPTH SHIELD)
                // ==========================================
                if (splatViewer) splatViewer.visible = true;
                if (shadowCatcher) shadowCatcher.visible = false;
                if (modelsGroup) {
                    modelsGroup.visible = true;
                    modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = false; });
                }
                gl.clear(true, true, true);
                gl.render(scene, camera);
                maskCtx.clearRect(0, 0, width, height);
                maskCtx.drawImage(glCanvas, 0, 0, width, height);

                // ==========================================
                // PASS 3: 2D COMPOSITE (PRO TRANSPARENT)
                // ==========================================
                finalCtx.clearRect(0, 0, width, height);

                finalCtx.globalCompositeOperation = 'source-over';
                finalCtx.drawImage(tetoCanvas, 0, 0, width, height);

                finalCtx.globalCompositeOperation = 'destination-out';
                finalCtx.drawImage(maskCanvas, 0, 0, width, height);

                // ВАЖНО: Мы больше НЕ рисуем видео фон здесь! 
                // Мы отправляем прозрачный кадр, чтобы FFmpeg сам наложил его в идеальном качестве.

                // --- BATCH UPLOAD (Быстрый WebP) ---
                const blob = await new Promise<Blob | null>(resolve => finalCanvas.toBlob(resolve, 'image/webp', 0.95));
                if (blob) {
                    currentBatch.push({ blob, index: i });
                }

                if (currentBatch.length >= 30 || i === totalFrames - 1) {
                    if (currentBatch.length > 0) {
                        const formData = new FormData();
                        for (const item of currentBatch) {
                            formData.append('frames', item.blob, `frame_${String(item.index).padStart(5, '0')}.webp`);
                        }
                        await fetch(`${state.backendUrl}/api/projects/${activeProjectId}/export/batch`, { method: 'POST', body: formData });
                        currentBatch = []; // Чистим RAM
                    }
                }

                state.updateToast(toastId, {
                    message: `Rendering frame ${i + 1} of ${totalFrames}...`,
                    progress: Math.floor((i / totalFrames) * 100),
                });
            }

            state.updateToast(toastId, { message: 'Encoding studio-quality video with FFmpeg...', progress: 100 });

            const res = await fetch(`${state.backendUrl}/api/projects/${activeProjectId}/export/finalize?fps=${fps || 24}`, { method: 'POST' });

            if (res.ok) {
                const data = await res.json();
                state.updateToast(toastId, { type: 'success', title: 'Export Complete', message: 'Video downloaded successfully.' });

                const a = document.createElement('a');
                a.href = data.url;
                a.download = data.filename || `impala_render_${activeProjectId}.mp4`;
                a.click();
            } else {
                throw new Error('Finalize failed on backend');
            }

        } catch (error) {
            console.error('[EXPORT]', error);
            state.updateToast(toastId, { type: 'error', title: 'Export Failed', message: 'Check console for errors.' });
        } finally {
            // Restore State
            gl.autoClear = oldAutoClear;
            gl.toneMapping = oldToneMapping;
            gl.toneMappingExposure = oldToneMappingExposure;
            gl.outputColorSpace = oldOutputColorSpace;
            scene.background = oldBg;

            const modelsGroup = scene.getObjectByName('custom-model-group');
            if (modelsGroup) modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = true; });

            camera.matrixAutoUpdate = true;
            set({ ...preExportState, isExporting: false });
        }
    },

    saveCurrentProject: async () => {
        const state = useStore.getState();
        const { activeProjectId, addToast, updateToast } = state;

        if (!activeProjectId) {
            addToast('Save Error', 'No active project to save.', 'error');
            return;
        }

        const toastId = addToast('Saving Project', 'Syncing scene data to server...', 'process', 'save-project');

        const payload = {
            objPos: state.objPos,
            objRot: state.objRot,
            objScale: state.objScale,
            scenePos: state.scenePos,
            sceneRot: state.sceneRot,
            sceneScale: state.sceneScale,
            shadowOpacity: state.shadowOpacity,
            shadowBlur: state.shadowBlur,
            shadowColor: state.shadowColor,
            matRoughness: state.matRoughness,
            matMetallic: state.matMetallic,
            envIntensity: state.envIntensity,
            envRotation: state.envRotation,
            envTint: state.envTint,
            savedSplatUrl: state.activeSplatUrl,
            customModelUrl: state.customModelUrl?.startsWith('blob:') ? null : state.customModelUrl,
            customModelName: state.customModelUrl?.startsWith('blob:') ? null : state.customModelName,
        };

        try {
            const res = await fetch(
                `${state.backendUrl}/api/projects/${activeProjectId}/save`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) throw new Error(`Server responded with ${res.status}`);

            updateToast(toastId, {
                type: 'success',
                title: 'Project Saved',
                message: 'All scene settings have been saved.',
            });
        } catch (err) {
            console.error('[SAVE] Failed:', err);
            updateToast(toastId, {
                type: 'error',
                title: 'Save Failed',
                message: 'Could not save project. Is the server running?',
            });
        }
    },

    loadProjectSettings: (projectData) => {
        const patch: Partial<AppState> = {};

        const arrayProps = ['objPos', 'objRot', 'objScale', 'scenePos', 'sceneRot', 'sceneScale'] as const;
        arrayProps.forEach(key => {
            if (Array.isArray(projectData[key])) {
                patch[key] = projectData[key] as any;
            }
        });

        const primitiveProps = [
            'shadowOpacity', 'shadowBlur', 'shadowColor',
            'matRoughness', 'matMetallic',
            'envIntensity', 'envRotation', 'envTint'
        ] as const;

        primitiveProps.forEach(key => {
            if (projectData[key] != null) {
                patch[key] = projectData[key] as any;
            }
        });

        if (projectData.savedSplatUrl != null) {
            patch.activeSplatUrl = projectData.savedSplatUrl;
        }

        const savedModelUrl = projectData.customModelUrl ?? null;
        if (savedModelUrl && !savedModelUrl.startsWith('blob:')) {
            patch.customModelUrl = savedModelUrl;
            patch.customModelName = projectData.customModelName ?? null;
        } else {
            patch.customModelUrl = null;
            patch.customModelName = null;
        }

        if (Object.keys(patch).length > 0) {
            set(patch);
            // Initialize history reference if not already set (e.g. first load)
            const currentStore = useStore.getState();
            if (!currentStore.lastCommittedState) {
                set({ lastCommittedState: getSnapshot(currentStore) });
            }
        }
    },

    clearHistory: () => set({
        undoStack: [],
        redoStack: [],
        lastCommittedState: getSnapshot(useStore.getState())
    }),

    lastCommittedState: null,
    undoStack: [],
    redoStack: [],

    pushToHistory: () => {
        const state = useStore.getState();
        const currentSnapshot = getSnapshot(state);

        // If we don't have a starting point, initialize it and don't push yet
        if (!state.lastCommittedState) {
            set({ lastCommittedState: currentSnapshot });
            return;
        }

        // Check for equality to avoid useless entries
        if (isSameSnapshot(state.lastCommittedState, currentSnapshot)) return;

        set((state) => {
            const newUndoStack = [...state.undoStack, state.lastCommittedState];
            if (newUndoStack.length > 50) newUndoStack.shift();
            return {
                undoStack: newUndoStack,
                redoStack: [], // branch history
                lastCommittedState: currentSnapshot
            };
        });
    },

    undo: () => {
        const state = useStore.getState();
        if (state.undoStack.length === 0) return;

        const previousState = state.undoStack[state.undoStack.length - 1];
        const newUndoStack = state.undoStack.slice(0, -1);
        const currentSnapshot = getSnapshot(state);

        set({
            ...previousState,
            lastCommittedState: previousState,
            undoStack: newUndoStack,
            redoStack: [currentSnapshot, ...state.redoStack].slice(0, 50)
        });
    },

    redo: () => {
        const state = useStore.getState();
        if (state.redoStack.length === 0) return;

        const nextState = state.redoStack[0];
        const newRedoStack = state.redoStack.slice(1);
        const currentSnapshot = getSnapshot(state);

        set({
            ...nextState,
            lastCommittedState: nextState,
            redoStack: newRedoStack,
            undoStack: [...state.undoStack, currentSnapshot].slice(-50)
        });
    },

    isSettingsOpen: false,
    setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
    settingsTab: 'General',
    setSettingsTab: (settingsTab) => set({ settingsTab }),

    colorScheme: 'System',
    setColorScheme: (colorScheme) => set({ colorScheme }),
    primaryColor: '#FF763B',
    setPrimaryColor: (primaryColor) => set({ primaryColor }),
    framerateLimit: '60 FPS',
    setFramerateLimit: (framerateLimit) => set({ framerateLimit }),
    uiScale: 'Normal',
    setUiScale: (uiScale) => set({ uiScale }),
    autosave: true,
    setAutosave: (autosave) => set({ autosave }),
    maxIterations: 15000,
    setMaxIterations: (maxIterations) => set({ maxIterations }),
    autoCrop: false,
    setAutoCrop: (autoCrop) => set({ autoCrop }),
    backendUrl: 'http://localhost:8000',
    setBackendUrl: (backendUrl) => set({ backendUrl }),
    language: 'English',
    setLanguage: (language) => set({ language }),
    cameraPreset: 'Blender',
    setCameraPreset: (cameraPreset) => set({ cameraPreset }),
}),
{
    name: 'impala-settings',
    partialize: (state) => ({
        colorScheme: state.colorScheme,
        primaryColor: state.primaryColor,
        framerateLimit: state.framerateLimit,
        uiScale: state.uiScale,
        autosave: state.autosave,
        maxIterations: state.maxIterations,
        autoCrop: state.autoCrop,
        backendUrl: state.backendUrl,
        language: state.language,
        cameraPreset: state.cameraPreset,
    }),
}
)
);

// --- Pure Helper functions for History ---

function getSnapshot(state: AppState) {
    return {
        objPos: [...state.objPos],
        objRot: [...state.objRot],
        objScale: [...state.objScale],
        scenePos: [...state.scenePos],
        sceneRot: [...state.sceneRot],
        sceneScale: [...state.sceneScale],
        shadowOpacity: state.shadowOpacity,
        shadowBlur: state.shadowBlur,
        shadowColor: state.shadowColor,
        matRoughness: state.matRoughness,
        matMetallic: state.matMetallic,
        envIntensity: state.envIntensity,
        envRotation: state.envRotation,
        envTint: state.envTint,
    };
}

function isSameSnapshot(a: any, b: any) {
    if (!a || !b) return false;
    for (const key in a) {
        if (Array.isArray(a[key])) {
            const arrA = a[key] as any[];
            const arrB = b[key] as any[];
            if (arrA.length !== arrB.length) return false;
            for (let i = 0; i < arrA.length; i++) {
                if (arrA[i] !== arrB[i]) return false;
            }
        } else {
            if (a[key] !== b[key]) return false;
        }
    }
    return true;
}
