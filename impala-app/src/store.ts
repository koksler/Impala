import { create } from 'zustand';

/** The 3x4 applied_transform matrix + scale from nerfstudio's dataparser_transforms.json.
 *  This aligns raw camera poses (transforms.json) with the exported .ply splat space. */
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

    /** Nerfstudio dataparser applied_transform — aligns camera poses with splat space */
    dataparsedTransform: DataparserTransform | null;
    setDataparserTransform: (t: DataparserTransform) => void;

    /** When false, CameraSync is bypassed and OrbitControls is active */
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

    // Tool Mode
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

    // Object Transform
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

    // Material/Shadows
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

    // Environment
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
    setIsBakingEnv: (isBaking: boolean) => void;

    activeProjectId: string | null;
    setActiveProjectId: (id: string | null) => void;
    activeSplatUrl: string | null;
    setActiveSplatUrl: (url: string | null) => void;

    toasts: Toast[];
    addToast: (title: string, message: string, type: ToastType, id?: string) => string;
    updateToast: (id: string, updates: Partial<Toast>) => void;
    removeToast: (id: string) => void;

    isAppLoading: boolean;
    setIsAppLoading: (loading: boolean) => void;

    saveCurrentProject: () => Promise<void>;
    loadProjectSettings: (projectData: Record<string, any>) => void;
}


interface CameraFrame {
    file_path: string;
    transform_matrix?: number[][];
    transform?: number[][];
    matrix?: number[][];
    [key: string]: any;
}


export const useStore = create<AppState>((set) => ({
    serverStatus: 'checking',

    checkServerStatus: async () => {
        try {
            const response = await fetch("http://localhost:8000/api/status", {
            });

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

    activeProjectId: null,
    setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
    activeSplatUrl: null,
    setActiveSplatUrl: (activeSplatUrl) => set({ activeSplatUrl }),

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
            // Save the active splat URL so cropped splat files are restored
            savedSplatUrl: state.activeSplatUrl,
            // Blob URLs are ephemeral (session-scoped) — never persist them.
            // The user must re-import the model file after reopening the project.
            customModelUrl: state.customModelUrl?.startsWith('blob:') ? null : state.customModelUrl,
            customModelName: state.customModelUrl?.startsWith('blob:') ? null : state.customModelName,
        };

        try {
            const res = await fetch(
                `http://localhost:8000/api/projects/${activeProjectId}/save`,
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

        if (Array.isArray(projectData.objPos))    patch.objPos    = projectData.objPos    as [number,number,number];
        if (Array.isArray(projectData.objRot))    patch.objRot    = projectData.objRot    as [number,number,number];
        if (Array.isArray(projectData.objScale))  patch.objScale  = projectData.objScale  as [number,number,number];
        if (Array.isArray(projectData.scenePos))  patch.scenePos  = projectData.scenePos  as [number,number,number];
        if (Array.isArray(projectData.sceneRot))  patch.sceneRot  = projectData.sceneRot  as [number,number,number];
        if (Array.isArray(projectData.sceneScale))patch.sceneScale= projectData.sceneScale as [number,number,number];

        if (projectData.shadowOpacity  != null) patch.shadowOpacity  = projectData.shadowOpacity;
        if (projectData.shadowBlur     != null) patch.shadowBlur     = projectData.shadowBlur;
        if (projectData.shadowColor    != null) patch.shadowColor    = projectData.shadowColor;
        if (projectData.matRoughness   != null) patch.matRoughness   = projectData.matRoughness;
        if (projectData.matMetallic    != null) patch.matMetallic    = projectData.matMetallic;
        if (projectData.envIntensity   != null) patch.envIntensity   = projectData.envIntensity;
        if (projectData.envRotation    != null) patch.envRotation    = projectData.envRotation;
        if (projectData.envTint        != null) patch.envTint        = projectData.envTint;

        // Restore cropped splat URL if one was saved
        if (projectData.savedSplatUrl  != null) patch.activeSplatUrl = projectData.savedSplatUrl;

        // Blob URLs died with the previous session — never try to restore them.
        // If a non-blob server URL was saved, it's safe to restore.
        const savedModelUrl: string | null = projectData.customModelUrl ?? null;
        if (savedModelUrl && !savedModelUrl.startsWith('blob:')) {
            patch.customModelUrl  = savedModelUrl;
            patch.customModelName = projectData.customModelName ?? null;
        } else {
            // Explicitly null out any stale blob URL that might be in state
            patch.customModelUrl  = null;
            patch.customModelName = null;
        }

        if (Object.keys(patch).length > 0) {
            set(patch);
        }
    },
}));
