import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataparserTransform {
    transform: number[][];  // 3x4 row-major matrix
    scale: number;
}

export type ToastType = 'process' | 'error' | 'success';

export interface Toast {
    id: string;
    title: string;
    message: string;
    type: ToastType;
    progress?: number;
}

export interface CameraFrame {
    file_path: string;
    transform_matrix?: number[][];
    transform?: number[][];
    matrix?: number[][];
    [key: string]: any;
}

// ─── State Interface ──────────────────────────────────────────────────────────

interface AppState {
    // Server
    serverStatus: 'online' | 'offline' | 'checking';
    checkServerStatus: () => Promise<void>;

    // Playback
    isPlaying: boolean;
    currentFrame: number;
    currentFrameFractional: number;
    totalFrames: number;
    fps: number;
    setPlaying: (playing: boolean) => void;
    setCurrentFrame: (frame: number) => void;
    setCurrentFrameFractional: (frame: number) => void;
    setFps: (fps: number) => void;

    // Camera
    cameraData: CameraFrame[] | null;
    cameraFov: number;
    cameraEnabled: boolean;
    setCameraData: (data: CameraFrame[], fov: number) => void;
    dataparsedTransform: DataparserTransform | null;
    setDataparserTransform: (t: DataparserTransform) => void;

    // Visibility
    showVideo: boolean;
    showModels: boolean;
    showGrid: boolean;
    showSplat: boolean;
    showCameraPath: boolean;
    toggleVisibility: (key: 'showVideo' | 'showModels' | 'showGrid' | 'showSplat' | 'showCameraPath') => void;

    // Video
    videoOpacity: number;
    setVideoOpacity: (v: number) => void;
    videoDimensions: { width: number; height: number } | null;
    setVideoDimensions: (width: number, height: number) => void;
    videoElement: HTMLVideoElement | null;
    setVideoElement: (el: HTMLVideoElement | null) => void;

    // Transform
    transformTarget: 'object' | 'scene';
    setTransformTarget: (t: 'object' | 'scene') => void;

    // Scene transform
    scenePos: [number, number, number];
    sceneRot: [number, number, number];
    sceneScale: [number, number, number];
    setScenePos: (pos: [number, number, number]) => void;
    setSceneRot: (rot: [number, number, number]) => void;
    setSceneScale: (scale: [number, number, number]) => void;

    // Object transform
    objPos: [number, number, number];
    objRot: [number, number, number];
    objScale: [number, number, number];
    setObjPos: (pos: [number, number, number]) => void;
    setObjRot: (rot: [number, number, number]) => void;
    setObjScale: (scale: [number, number, number]) => void;
    objBounds: [number, number, number];
    setObjBounds: (bounds: [number, number, number]) => void;

    // Tools
    activeTool: string;
    setActiveTool: (tool: string) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    splatSelectionMask: Set<number>;
    updateSplatSelection: (indices: number[], operation: 'add' | 'remove') => void;
    clearSplatSelection: () => void;
    applyEraserToSelection: () => void;
    snapToGrid: boolean;
    setSnapToGrid: (val: boolean) => void;

    // Crop
    isCropping: boolean;
    setIsCropping: (val: boolean) => void;
    cropBox: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    };
    setCropBox: (transform: Partial<{
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    }>) => void;

    // Splat
    splatViewer: any | null; // Keep any for splat viewer as it's often a custom class, but we could use a specific type if known
    setSplatViewer: (viewer: any) => void;

    // Custom model
    customModelUrl: string | null;
    setCustomModelUrl: (url: string | null) => void;
    customModelName: string | null;
    setCustomModelName: (name: string | null) => void;

    // Multi-model
    customModels: { id: string; url: string; name: string; pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] }[];
    activeModelId: string | null;
    addCustomModel: (model: { id: string; url: string; name: string; pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] }) => void;
    removeCustomModel: (id: string) => void;
    setActiveModelId: (id: string | null) => void;
    updateCustomModel: (id: string, updates: Partial<{ url: string; name: string; pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] }>) => void;

    // Shadow & material
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
    lightElevation: number;
    setEnvIntensity: (val: number) => void;
    setEnvRotation: (val: number) => void;
    setEnvTint: (val: string) => void;
    setLightElevation: (val: number) => void;

    // Baked env
    bakedEnvTexture: THREE.Texture | null;
    setBakedEnvTexture: (texture: THREE.Texture | null) => void;
    bakedEnvPreview: string | null;
    setBakedEnvPreview: (preview: string | null) => void;
    isBakingEnv: boolean;
    setIsBakingEnv: (val: boolean) => void;

    // Three.js context
    threeContext: { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null;
    setThreeContext: (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;

    // Project
    activeProjectId: string | null;
    setActiveProjectId: (id: string | null) => void;
    activeSplatUrl: string | null;
    setActiveSplatUrl: (url: string | null) => void;
    activeProxyUrl: string | null;
    setActiveProxyUrl: (url: string | null) => void;

    // Toasts
    toasts: Toast[];
    addToast: (title: string, message: string, type: ToastType, id?: string) => string;
    updateToast: (id: string, updates: Partial<Toast>) => void;
    removeToast: (id: string) => void;

    // App loading
    isAppLoading: boolean;
    setIsAppLoading: (loading: boolean) => void;

    // Export
    isExporting: boolean;
    setIsExporting: (exporting: boolean) => void;
    startExportPipeline: () => void;
    exportVideo: () => Promise<void>;

    // Project persistence
    saveCurrentProject: () => Promise<void>;
    loadProjectSettings: (projectData: Record<string, any>) => void;

    // History (undo/redo)
    lastCommittedState: any | null;
    undoStack: any[];
    redoStack: any[];
    pushToHistory: () => void;
    undo: () => void;
    redo: () => void;
    clearHistory: () => void;

    // Settings
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

    // Export settings
    exportResolution: string;
    setExportResolution: (val: string) => void;
    exportFormat: string;
    setExportFormat: (val: string) => void;
    exportFilename: string;
    setExportFilename: (val: string) => void;
    exportDirectory: string;
    setExportDirectory: (val: string) => void;
    exportIncludeShadows: boolean;
    setExportIncludeShadows: (val: boolean) => void;
    exportRenderOcclusion: boolean;
    setExportRenderOcclusion: (val: boolean) => void;
    exportEngine: 'realtime' | 'eevee' | 'cycles';
    setExportEngine: (val: 'realtime' | 'eevee' | 'cycles') => void;
    isRenderModalOpen: boolean;
    setIsRenderModalOpen: (val: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSnapshot(state: AppState) {
    return {
        customModels: state.customModels.map(m => ({ ...m })),
        activeModelId: state.activeModelId,
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
        lightElevation: state.lightElevation,
    };
}

function isSameSnapshot(a: any, b: any): boolean {
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

// ─── Store ────────────────────────────────────────────────────────────────────

const storeCreator: StateCreator<AppState, [['zustand/persist', unknown]], []> = (set, get) => ({
    // ── Server ──────────────────────────────────────────────────────────────

    serverStatus: 'checking',

    checkServerStatus: async () => {
        try {
            const response = await fetch(`${get().backendUrl}/api/status`);
            set({ serverStatus: response.ok ? 'online' : 'offline' });
        } catch {
            set({ serverStatus: 'offline' });
        }
    },

    // ── Playback ─────────────────────────────────────────────────────────────

    isPlaying: false,
    currentFrame: 0,
    currentFrameFractional: 0,
    totalFrames: 0,
    fps: 24,

    setPlaying: (isPlaying) => set({ isPlaying }),
    setCurrentFrame: (currentFrame) => {
        if (get().currentFrame !== currentFrame) {
            set({ currentFrame, currentFrameFractional: currentFrame });
        }
    },
    setCurrentFrameFractional: (currentFrameFractional) => {
        if (get().currentFrameFractional !== currentFrameFractional) {
            set({ currentFrameFractional });
        }
    },
    setFps: (fps) => set({ fps }),

    // ── Camera ───────────────────────────────────────────────────────────────

    cameraData: null,
    cameraFov: 45,
    cameraEnabled: false,
    dataparsedTransform: null,

    setCameraData: (data, fov) => set({
        cameraData: data,
        cameraFov: fov,
        totalFrames: data.length,
        currentFrame: 0,
        cameraEnabled: true,
    }),
    setDataparserTransform: (dataparsedTransform) => set({ dataparsedTransform }),

    // ── Visibility ───────────────────────────────────────────────────────────

    showVideo: true,
    showModels: true,
    showGrid: true,
    showSplat: true,
    showCameraPath: true,

    toggleVisibility: (key) => set((state) => ({ [key]: !state[key] })),

    // ── Video ────────────────────────────────────────────────────────────────

    videoOpacity: 0.5,
    videoDimensions: null,
    videoElement: null,

    setVideoOpacity: (videoOpacity) => set({ videoOpacity }),
    setVideoDimensions: (width, height) => set({ videoDimensions: { width, height } }),
    setVideoElement: (videoElement) => set({ videoElement }),

    // ── Transform ────────────────────────────────────────────────────────────

    transformTarget: 'object',
    setTransformTarget: (transformTarget) => set({ transformTarget }),

    // ── Scene transform ──────────────────────────────────────────────────────

    scenePos: [0, 0, 0],
    sceneRot: [0, 0, 0],
    sceneScale: [1, 1, 1],

    setScenePos: (scenePos) => set({ scenePos }),
    setSceneRot: (sceneRot) => set({ sceneRot }),
    setSceneScale: (sceneScale) => set({ sceneScale }),

    // ── Object transform ─────────────────────────────────────────────────────

    objPos: [0, 0.5, 0],
    objRot: [0, 0, 0],
    objScale: [1, 1, 1],
    objBounds: [1, 1, 1],

    setObjPos: (objPos) => set((state) => {
        if (state.activeModelId) {
            return { objPos, customModels: state.customModels.map(m => m.id === state.activeModelId ? { ...m, pos: objPos } : m) };
        }
        return { objPos };
    }),
    setObjRot: (objRot) => set((state) => {
        if (state.activeModelId) {
            return { objRot, customModels: state.customModels.map(m => m.id === state.activeModelId ? { ...m, rot: objRot } : m) };
        }
        return { objRot };
    }),
    setObjScale: (objScale) => set((state) => {
        if (state.activeModelId) {
            return { objScale, customModels: state.customModels.map(m => m.id === state.activeModelId ? { ...m, scale: objScale } : m) };
        }
        return { objScale };
    }),
    setObjBounds: (objBounds) => set({ objBounds }),

    activeTool: 'hand',
    brushSize: 20,
    splatSelectionMask: new Set(),
    snapToGrid: false,

    setActiveTool: (activeTool) => set({ activeTool }),
    setBrushSize: (brushSize) => set({ brushSize }),

    updateSplatSelection: (indices, operation) => set((state) => {
        const newMask = new Set(state.splatSelectionMask);
        for (const idx of indices) {
            if (operation === 'add') newMask.add(idx);
            else newMask.delete(idx);
        }
        return { splatSelectionMask: newMask };
    }),

    clearSplatSelection: () => set({ splatSelectionMask: new Set() }),

    applyEraserToSelection: () => {
        const state = get();
        if (!state.splatViewer) return;

        // Safely extract splat meshes using the updated structure
        const meshes = state.splatViewer.splatMeshes?.length
            ? state.splatViewer.splatMeshes
            : (state.splatViewer.splatMesh ? [state.splatViewer.splatMesh] : []);

        const selected = Array.from(state.splatSelectionMask);

        for (const splatIndex of selected) {
            meshes.forEach((mesh: any) => {
                if (typeof mesh.updateSplatOpacity === 'function') {
                    mesh.updateSplatOpacity(splatIndex, 0.0);
                }
            });
        }
        state.clearSplatSelection();
    },

    setSnapToGrid: (snapToGrid) => set({ snapToGrid }),

    // ── Crop ─────────────────────────────────────────────────────────────────

    isCropping: false,
    cropBox: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [2, 2, 2],
    },

    setIsCropping: (isCropping) => set({ isCropping }),
    setCropBox: (transform) => set((state) => ({ cropBox: { ...state.cropBox, ...transform } })),

    // ── Splat ────────────────────────────────────────────────────────────────

    splatViewer: null,
    setSplatViewer: (splatViewer) => set({ splatViewer }),

    // ── Custom model ─────────────────────────────────────────────────────────

    customModelUrl: null,
    customModelName: null,

    setCustomModelUrl: (customModelUrl) => set({ customModelUrl }),
    setCustomModelName: (customModelName) => set({ customModelName }),

    customModels: [],
    activeModelId: null,

    addCustomModel: (model) => set((state) => {
        const newModels = [...state.customModels, model];
        return {
            customModels: newModels,
            activeModelId: model.id,
            objPos: model.pos,
            objRot: model.rot,
            objScale: model.scale,
            customModelUrl: model.url,
            customModelName: model.name
        };
    }),

    removeCustomModel: (id) => set((state) => {
        const newModels = state.customModels.filter(m => m.id !== id);
        const newActiveId = newModels.length > 0 ? newModels[0].id : null;
        const newActive = newModels.find(m => m.id === newActiveId);
        return {
            customModels: newModels,
            activeModelId: newActiveId,
            objPos: newActive ? newActive.pos : [0, 0.5, 0],
            objRot: newActive ? newActive.rot : [0, 0, 0],
            objScale: newActive ? newActive.scale : [1, 1, 1],
            customModelUrl: newActive ? newActive.url : null,
            customModelName: newActive ? newActive.name : null
        };
    }),

    setActiveModelId: (id) => set((state) => {
        const model = state.customModels.find(m => m.id === id);
        if (model) {
            return {
                activeModelId: id,
                objPos: model.pos,
                objRot: model.rot,
                objScale: model.scale,
                customModelUrl: model.url,
                customModelName: model.name
            };
        }
        return { activeModelId: id };
    }),

    updateCustomModel: (id, updates) => set((state) => {
        const newModels = state.customModels.map(m => m.id === id ? { ...m, ...updates } : m);
        const isActive = state.activeModelId === id;
        return {
            customModels: newModels,
            ...(isActive && updates.pos ? { objPos: updates.pos } : {}),
            ...(isActive && updates.rot ? { objRot: updates.rot } : {}),
            ...(isActive && updates.scale ? { objScale: updates.scale } : {}),
            ...(isActive && updates.url ? { customModelUrl: updates.url } : {}),
            ...(isActive && updates.name ? { customModelName: updates.name } : {})
        };
    }),

    // ── Shadow & material ────────────────────────────────────────────────────

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

    // ── Environment ──────────────────────────────────────────────────────────

    envIntensity: 1,
    envRotation: 0,
    envTint: '#ffffff',
    lightElevation: 45,

    setEnvIntensity: (envIntensity) => set({ envIntensity }),
    setEnvRotation: (envRotation) => set({ envRotation }),
    setEnvTint: (envTint) => set({ envTint }),
    setLightElevation: (lightElevation) => set({ lightElevation }),

    // ── Baked env ────────────────────────────────────────────────────────────

    bakedEnvTexture: null,
    bakedEnvPreview: null,
    isBakingEnv: false,

    setBakedEnvTexture: (bakedEnvTexture) => set({ bakedEnvTexture }),
    setBakedEnvPreview: (bakedEnvPreview) => set({ bakedEnvPreview }),
    setIsBakingEnv: (isBakingEnv) => set({ isBakingEnv }),

    // ── Three.js context ─────────────────────────────────────────────────────

    threeContext: null,
    setThreeContext: (gl, scene, camera) => set({ threeContext: { gl, scene, camera } }),

    // ── Project ──────────────────────────────────────────────────────────────

    activeProjectId: null,
    activeSplatUrl: null,
    activeProxyUrl: null,

    setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
    setActiveSplatUrl: (activeSplatUrl) => set({ activeSplatUrl }),
    setActiveProxyUrl: (activeProxyUrl) => set({ activeProxyUrl }),

    // ── Toasts ───────────────────────────────────────────────────────────────

    toasts: [],

    addToast: (title, message, type, id) => {
        const toastId = id ?? Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, {
                id: toastId,
                title,
                message,
                type,
                progress: type === 'process' ? 0 : undefined,
            }],
        }));

        if (type !== 'process') {
            window.setTimeout(() => get().removeToast(toastId), 5000);
        }

        return toastId;
    },

    updateToast: (id, updates) => {
        set((state) => ({
            toasts: state.toasts.map((t) => t.id === id ? { ...t, ...updates } : t),
        }));

        if (updates.type && updates.type !== 'process') {
            window.setTimeout(() => get().removeToast(id), 5000);
        }
    },

    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
    })),

    // ── App loading ──────────────────────────────────────────────────────────

    isAppLoading: false,
    setIsAppLoading: (isAppLoading) => set({ isAppLoading }),

    // ── Export ───────────────────────────────────────────────────────────────

    isExporting: false,

    setIsExporting: (isExporting) => set({ isExporting }),

    startExportPipeline: () => {
        get().exportVideo();
    },

    exportVideo: async () => {
        const state = useStore.getState();
        if (!state.activeProjectId || !state.videoElement || state.totalFrames === 0) return;

        const { gl, scene, camera } = state.threeContext ?? {};
        if (!gl || !scene || !camera) return;

        const preExportStoreState = {
            cameraEnabled: state.cameraEnabled,
            showGrid: state.showGrid,
            activeTool: state.activeTool,
            isPlaying: state.isPlaying,
            currentFrame: state.currentFrame,
            showSplat: state.showSplat,
        };

        const preExportCameraState = {
            position: camera.position.clone(),
            quaternion: camera.quaternion.clone(),
            up: camera.up.clone(),
            fov: camera.fov,
            aspect: camera.aspect,
        };

        state.setIsExporting(true);
        get().setPlaying(false);

        const toastId = state.addToast('Exporting Video', 'Initializing render pipeline...', 'process', 'export-video');

        const { activeProjectId, totalFrames, videoDimensions, fps, videoElement, cameraData } = state;
        const width = videoDimensions?.width ?? 1920;
        const height = videoDimensions?.height ?? 1080;

        const glCanvas = gl.domElement;

        // Ensure canvases are created ONCE outside the loop to prevent massive GC memory leaks
        const tetoCanvas = document.createElement('canvas');
        tetoCanvas.width = width;
        tetoCanvas.height = height;
        const tetoCtx = tetoCanvas.getContext('2d', { willReadFrequently: true })!;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;

        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = width;
        shadowCanvas.height = height;
        const shadowCtx = shadowCanvas.getContext('2d', { willReadFrequently: true })!;

        const fgFrameCanvas = document.createElement('canvas');
        fgFrameCanvas.width = width;
        fgFrameCanvas.height = height;
        const fgCtx = fgFrameCanvas.getContext('2d', { willReadFrequently: true })!;

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d')!;

        // Save WebGL state
        const oldSize = new THREE.Vector2();
        gl.getSize(oldSize);
        const oldDPR = gl.getPixelRatio();
        const oldAutoClear = gl.autoClear;
        const oldBg = scene.background;
        const oldToneMapping = gl.toneMapping;
        const oldToneMappingExposure = gl.toneMappingExposure;
        const oldOutputColorSpace = gl.outputColorSpace;

        gl.setSize(width, height, false);
        gl.setPixelRatio(2);

        const WORLD_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

        const modelsGroup = scene.getObjectByName('custom-models-container') || scene.getObjectByName('custom-model-group');
        const shadowCatcher = scene.getObjectByName('shadow-catcher');
        const proxyGroup = scene.getObjectByName('proxy-occluder-group');
        const splatViewer = get().splatViewer;

        // Snapshot original colorWrite state for every material in modelsGroup
        const originalColorWrite = new Map<THREE.Material, boolean>();
        if (modelsGroup) {
            modelsGroup.traverse((c: any) => {
                if (c.material) originalColorWrite.set(c.material, c.material.colorWrite ?? true);
            });
        }

        // Create a lookup map for cameras by their true video frame index
        const cameraMap = new Map<number, any>();
        const cameras = cameraData ?? [];
        cameras.forEach((cam: any) => {
            if (typeof cam.frameIndex === 'number') {
                cameraMap.set(cam.frameIndex, cam);
            }
        });

        // Snapshot splatViewer colorWrite (safely avoiding raycast spheres)
        const originalSplatColorWrite = new Map<THREE.Material, boolean>();
        if (splatViewer) {
            const splatMeshes = splatViewer.splatMeshes?.length ? splatViewer.splatMeshes : (splatViewer.splatMesh ? [splatViewer.splatMesh] : []);
            splatMeshes.forEach((mesh: any) => {
                if (mesh.material) originalSplatColorWrite.set(mesh.material, mesh.material.colorWrite ?? true);
            });
        }

        const originalShadowCatcherVisible = shadowCatcher?.visible ?? true;
        const originalSplatViewerVisible = splatViewer?.visible ?? true;
        const originalProxyGroupVisible = proxyGroup?.visible ?? true;

        try {
            set({ cameraEnabled: true, showGrid: false, activeTool: 'hand' });

            gl.autoClear = false;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFShadowMap;

            let dirLight: THREE.DirectionalLight | null = null;
            scene.traverse((obj: THREE.Object3D) => {
                if (obj instanceof THREE.DirectionalLight && obj.castShadow) dirLight = obj;
            });

            let currentBatch: { blob: Blob; index: number }[] = [];

            for (let i = 0; i < totalFrames; i++) {
                get().setCurrentFrame(i);

                if (!get().isExporting) {
                    state.updateToast(toastId, { type: 'error', title: 'Export Cancelled', message: 'Render aborted by user.' });
                    break;
                }

                // 1. Sync video
                await new Promise<void>((resolve) => {
                    let fired = false;
                    const onSeeked = () => {
                        if (!fired) {
                            fired = true;
                            videoElement.removeEventListener('seeked', onSeeked);
                            resolve();
                        }
                    };
                    videoElement.addEventListener('seeked', onSeeked);
                    const targetTime = (totalFrames > 1 ? i / (totalFrames - 1) : 0) * videoElement.duration;
                    videoElement.currentTime = Math.min(targetTime, videoElement.duration - 0.001);
                    window.setTimeout(onSeeked, 200);
                });

                // 2. Sync camera
                const frame = cameraMap.get(i);
                if (frame) {
                    const raw = frame.transform ?? frame.camera_to_world ?? frame.transform_matrix;
                    if (raw) {
                        const f = Array.isArray(raw[0]) ? raw.flat() : raw;
                        const mat = new THREE.Matrix4().set(
                            f[0], f[1], f[2], f[3],
                            f[4], f[5], f[6], f[7],
                            f[8], f[9], f[10], f[11],
                            0, 0, 0, 1,
                        );
                        const finalMatrix = new THREE.Matrix4().multiplyMatrices(WORLD_ROTATION, mat);
                        const s = useStore.getState();
                        const sceneTransform = new THREE.Matrix4().compose(
                            new THREE.Vector3(...s.scenePos),
                            new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.sceneRot)),
                            new THREE.Vector3(...s.sceneScale),
                        );
                        camera.matrixAutoUpdate = false;
                        camera.matrix.copy(new THREE.Matrix4().multiplyMatrices(sceneTransform, finalMatrix));
                        camera.updateMatrixWorld(true);
                        (camera as THREE.PerspectiveCamera).fov = s.cameraFov;
                        (camera as THREE.PerspectiveCamera).aspect = width / height;
                        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
                    }
                }

                // 2.5 Imperative scene physics update
                if (modelsGroup) {
                    modelsGroup.updateMatrixWorld(true);
                    const box = new THREE.Box3().setFromObject(modelsGroup);

                    if (shadowCatcher && shadowCatcher.parent) {
                        // Position stabilization is normally handled in useFrame, but during export
                        // we imperatively push it to ensure it matches the current frame perfectly.
                        shadowCatcher.parent.position.set(
                            (box.min.x + box.max.x) / 2,
                            box.min.y + 0.005,
                            (box.min.z + box.max.z) / 2,
                        );
                        shadowCatcher.parent.updateMatrixWorld(true);
                    }

                    if (dirLight) {
                        (dirLight as any).intensity = Math.max(state.envIntensity, 1.0);
                        (dirLight as any).shadow.camera.updateProjectionMatrix();
                        (dirLight as any).shadow.needsUpdate = true;
                    }
                }

                // 3. Trigger splat worker — warm-up render with full scene visible
                if (splatViewer) splatViewer.visible = true;
                if (shadowCatcher) shadowCatcher.visible = true;
                if (modelsGroup) {
                    modelsGroup.visible = true;
                    modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = true; });
                }
                gl.render(scene, camera);
                await new Promise((r) => setTimeout(r, 50));

                scene.background = null;
                gl.setClearColor(0x000000, 0);

                // Pass 1: Isolated Models (colorWrite on, splat + shadow hidden)
                if (splatViewer) splatViewer.visible = false;
                if (shadowCatcher) shadowCatcher.visible = false;
                if (proxyGroup) proxyGroup.visible = true;
                if (modelsGroup) {
                    modelsGroup.visible = true;
                    modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = true; });
                }
                gl.setClearColor(0x000000, 0);
                gl.clear(true, true, true);
                gl.render(scene, camera);
                tetoCtx.clearRect(0, 0, width, height);
                tetoCtx.drawImage(glCanvas, 0, 0, width, height);

                // Pass 1.5: Isolated Shadows
                if (state.exportIncludeShadows) {
                    // Make splats visible but colorWrite=false, so they silently occlude the shadow
                    if (splatViewer) {
                        splatViewer.visible = true;
                        const splatMeshes = splatViewer.splatMeshes?.length ? splatViewer.splatMeshes : (splatViewer.splatMesh ? [splatViewer.splatMesh] : []);
                        splatMeshes.forEach((mesh: any) => {
                            if (mesh.material) mesh.material.colorWrite = false;
                        });
                    }
                    if (shadowCatcher) shadowCatcher.visible = true;
                    if (proxyGroup) proxyGroup.visible = true;
                    if (modelsGroup) {
                        modelsGroup.visible = true;
                        modelsGroup.traverse((c: any) => {
                            if (c.material) {
                                c.material.colorWrite = false;
                                c.material.depthWrite = true;
                            }
                        });
                    }
                    gl.setClearColor(0x000000, 0);
                    gl.clear(true, true, true);
                    gl.render(scene, camera);
                    shadowCtx.clearRect(0, 0, width, height);
                    shadowCtx.drawImage(glCanvas, 0, 0, width, height);

                    // Restore colorWrites immediately for the subsequent passes
                    if (modelsGroup) {
                        modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = true; });
                    }
                    if (splatViewer) {
                        const splatMeshes = splatViewer.splatMeshes?.length ? splatViewer.splatMeshes : (splatViewer.splatMesh ? [splatViewer.splatMesh] : []);
                        splatMeshes.forEach((mesh: any) => {
                            if (mesh.material) mesh.material.colorWrite = true;
                        });
                    }
                } else {
                    shadowCtx.clearRect(0, 0, width, height);
                }

                // Pass 2: Mask (occlusion)
                if (state.exportRenderOcclusion) {
                    if (splatViewer) splatViewer.visible = true;
                    if (shadowCatcher) shadowCatcher.visible = false;
                    if (proxyGroup) proxyGroup.visible = true;
                    if (modelsGroup) {
                        modelsGroup.visible = true;
                        modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = false; });
                    }
                    gl.clear(true, true, true);
                    gl.render(scene, camera);
                    maskCtx.clearRect(0, 0, width, height);
                    maskCtx.drawImage(glCanvas, 0, 0, width, height);

                    if (modelsGroup) {
                        modelsGroup.traverse((c: any) => { if (c.material) c.material.colorWrite = true; });
                    }
                } else {
                    maskCtx.clearRect(0, 0, width, height);
                }

                // Pass 3: 2D composite
                finalCtx.clearRect(0, 0, width, height);

                if (state.exportIncludeShadows) {
                    finalCtx.globalCompositeOperation = 'source-over';
                    finalCtx.drawImage(shadowCanvas, 0, 0, width, height);
                }

                // Draw model and cut out splat occlusion mask using the re-used fgFrameCanvas
                fgCtx.clearRect(0, 0, width, height);
                fgCtx.globalCompositeOperation = 'source-over';
                fgCtx.drawImage(tetoCanvas, 0, 0, width, height);

                if (state.exportRenderOcclusion) {
                    fgCtx.globalCompositeOperation = 'destination-out';
                    fgCtx.drawImage(maskCanvas, 0, 0, width, height);
                }

                finalCtx.globalCompositeOperation = 'source-over';
                finalCtx.drawImage(fgFrameCanvas, 0, 0, width, height);

                // Batch upload
                const blob = await new Promise<Blob | null>((resolve) =>
                    finalCanvas.toBlob(resolve, 'image/webp', 0.95)
                );
                if (blob) currentBatch.push({ blob, index: i });

                if (currentBatch.length >= 30 || i === totalFrames - 1) {
                    if (currentBatch.length > 0) {
                        const formData = new FormData();
                        for (const item of currentBatch) {
                            formData.append('frames', item.blob, `frame_${String(item.index).padStart(5, '0')}.webp`);
                        }
                        await fetch(
                            `${state.backendUrl}/api/projects/${activeProjectId}/export/batch`,
                            { method: 'POST', body: formData },
                        );
                        currentBatch = [];
                    }
                }

                state.updateToast(toastId, {
                    message: `Rendering frame ${i + 1} of ${totalFrames}...`,
                    progress: Math.floor((i / totalFrames) * 100),
                });
            }

            state.updateToast(toastId, { message: 'Encoding video with FFmpeg...', progress: 100 });

            const payload = {
                fps: fps ?? 24,
                format: state.exportFormat,
                filename: state.exportFilename,
                directory: state.exportDirectory,
            };

            const res = await fetch(
                `${state.backendUrl}/api/projects/${activeProjectId}/export/finalize`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            );

            if (res.ok) {
                const data = await res.json();
                state.updateToast(toastId, { type: 'success', title: 'Export Complete', message: 'Video saved successfully.' });

                if (data.url) {
                    const a = document.createElement('a');
                    a.href = data.url;
                    a.download = data.filename ?? `impala_render_${activeProjectId}${state.exportFormat || '.mp4'}`;
                    a.click();
                } else if (state.exportDirectory) {
                    state.updateToast(toastId, { type: 'success', title: 'Export Complete', message: `Saved to ${state.exportDirectory}` });
                }
            } else {
                throw new Error('Finalize failed on backend');
            }

        } catch (error) {
            console.error('[EXPORT]', error);
            state.updateToast(toastId, { type: 'error', title: 'Export Failed', message: 'Check console for errors.' });
        } finally {
            // ── Restore WebGL renderer state ─────────────────────────────────
            gl.setSize(oldSize.x, oldSize.y, true);
            gl.setPixelRatio(oldDPR);
            gl.autoClear = oldAutoClear;
            gl.toneMapping = oldToneMapping;
            gl.toneMappingExposure = oldToneMappingExposure;
            gl.outputColorSpace = oldOutputColorSpace;
            scene.background = oldBg;

            // Restore material state
            if (modelsGroup) {
                modelsGroup.traverse((c: any) => {
                    if (c.material && originalColorWrite.has(c.material)) {
                        c.material.colorWrite = originalColorWrite.get(c.material)!;
                    }
                });
            }

            // Restore splat material state
            if (splatViewer) {
                const splatMeshes = splatViewer.splatMeshes?.length ? splatViewer.splatMeshes : (splatViewer.splatMesh ? [splatViewer.splatMesh] : []);
                splatMeshes.forEach((mesh: any) => {
                    if (mesh.material && originalSplatColorWrite.has(mesh.material)) {
                        mesh.material.colorWrite = originalSplatColorWrite.get(mesh.material)!;
                    }
                });
                splatViewer.visible = originalSplatViewerVisible;
            }

            // Restore shadow catcher visibility
            if (shadowCatcher) shadowCatcher.visible = originalShadowCatcherVisible;

            // Restore proxy group visibility
            if (proxyGroup) proxyGroup.visible = originalProxyGroupVisible;

            // Restore camera transform
            camera.position.copy(preExportCameraState.position);
            camera.quaternion.copy(preExportCameraState.quaternion);
            camera.up.copy(preExportCameraState.up);
            camera.fov = preExportCameraState.fov;
            camera.aspect = preExportCameraState.aspect;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);

            // Restore video time synchronously to prevent flicker
            if (state.videoElement) {
                const targetTime = (totalFrames > 1 ? preExportStoreState.currentFrame / (totalFrames - 1) : 0) * state.videoElement.duration;
                state.videoElement.currentTime = Math.min(targetTime, state.videoElement.duration - 0.001);
            }

            // Restore camera auto-update
            camera.matrixAutoUpdate = true;

            // Restore Zustand state flags
            set({ ...preExportStoreState, isExporting: false });
        }
    },

    // ── Project persistence ──────────────────────────────────────────────────

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
            lightElevation: state.lightElevation,
            savedSplatUrl: state.activeSplatUrl,
            customModelUrl: state.customModelUrl?.startsWith('blob:') ? null : state.customModelUrl,
            customModelName: state.customModelUrl?.startsWith('blob:') ? null : state.customModelName,
            customModels: state.customModels.filter(m => !m.url.startsWith('blob:')).map(m => ({ ...m })),
            activeModelId: state.activeModelId,
        };

        try {
            const res = await fetch(`${state.backendUrl}/api/projects/${activeProjectId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

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
        arrayProps.forEach((key) => {
            if (Array.isArray(projectData[key])) patch[key] = projectData[key] as any;
        });

        const primitiveProps = [
            'shadowOpacity', 'shadowBlur', 'shadowColor',
            'matRoughness', 'matMetallic',
            'envIntensity', 'envRotation', 'envTint', 'lightElevation',
        ] as const;
        primitiveProps.forEach((key) => {
            if (projectData[key] != null) patch[key] = projectData[key] as any;
        });

        if (projectData.savedSplatUrl != null) patch.activeSplatUrl = projectData.savedSplatUrl;

        const savedModelUrl = projectData.customModelUrl ?? null;
        if (savedModelUrl && !savedModelUrl.startsWith('blob:')) {
            patch.customModelUrl = savedModelUrl;
            patch.customModelName = projectData.customModelName ?? null;
        } else {
            patch.customModelUrl = null;
            patch.customModelName = null;
        }

        let loadedCustomModels = projectData.customModels || [];
        if (loadedCustomModels.length === 0 && savedModelUrl && !savedModelUrl.startsWith('blob:')) {
            loadedCustomModels = [{
                id: 'legacy-model',
                url: savedModelUrl,
                name: projectData.customModelName || 'Model',
                pos: projectData.objPos || [0, 0.5, 0],
                rot: projectData.objRot || [0, 0, 0],
                scale: projectData.objScale || [1, 1, 1]
            }];
        }
        patch.customModels = loadedCustomModels;
        patch.activeModelId = projectData.activeModelId || (loadedCustomModels.length > 0 ? loadedCustomModels[0].id : null);

        if (Object.keys(patch).length > 0) {
            set(patch);
            if (!get().lastCommittedState) {
                set({ lastCommittedState: getSnapshot(get()) });
            }
        }
    },

    // ── History (undo/redo) ──────────────────────────────────────────────────

    lastCommittedState: null,
    undoStack: [],
    redoStack: [],

    pushToHistory: () => {
        const state = get();
        const currentSnapshot = getSnapshot(state);

        if (!state.lastCommittedState) {
            set({ lastCommittedState: currentSnapshot });
            return;
        }

        if (isSameSnapshot(state.lastCommittedState, currentSnapshot)) return;

        set((state) => {
            const newUndoStack = [...state.undoStack, state.lastCommittedState];
            if (newUndoStack.length > 50) newUndoStack.shift();
            return {
                undoStack: newUndoStack,
                redoStack: [],
                lastCommittedState: currentSnapshot,
            };
        });
    },

    undo: () => {
        const state = get();
        if (state.undoStack.length === 0) return;

        const previousState = state.undoStack[state.undoStack.length - 1];
        const currentSnapshot = getSnapshot(state);

        set({
            ...previousState,
            lastCommittedState: previousState,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [currentSnapshot, ...state.redoStack].slice(0, 50),
        });
    },

    redo: () => {
        const state = get();
        if (state.redoStack.length === 0) return;

        const nextState = state.redoStack[0];
        const currentSnapshot = getSnapshot(state);

        set({
            ...nextState,
            lastCommittedState: nextState,
            redoStack: state.redoStack.slice(1),
            undoStack: [...state.undoStack, currentSnapshot].slice(-50),
        });
    },

    clearHistory: () => set({
        undoStack: [],
        redoStack: [],
        lastCommittedState: getSnapshot(get()),
    }),

    // ── Settings ─────────────────────────────────────────────────────────────

    isSettingsOpen: false,
    settingsTab: 'General',
    colorScheme: 'System',
    primaryColor: '#FF763B',
    framerateLimit: '60 FPS',
    uiScale: 'Normal',
    autosave: true,
    maxIterations: 15000,
    autoCrop: false,
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
    language: 'English',
    cameraPreset: 'Blender',

    setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
    setSettingsTab: (settingsTab) => set({ settingsTab }),
    setColorScheme: (colorScheme) => set({ colorScheme }),
    setPrimaryColor: (primaryColor) => set({ primaryColor }),
    setFramerateLimit: (framerateLimit) => set({ framerateLimit }),
    setUiScale: (uiScale) => set({ uiScale }),
    setAutosave: (autosave) => set({ autosave }),
    setMaxIterations: (maxIterations) => set({ maxIterations }),
    setAutoCrop: (autoCrop) => set({ autoCrop }),
    setBackendUrl: (backendUrl) => set({ backendUrl }),
    setLanguage: (language) => set({ language }),
    setCameraPreset: (cameraPreset) => set({ cameraPreset }),

    // ── Export settings ──────────────────────────────────────────────────────

    exportResolution: '1080p',
    exportFormat: '.mp4',
    exportFilename: 'impala_render',
    exportDirectory: 'C:/exports/',
    exportIncludeShadows: true,
    exportRenderOcclusion: true,
    exportEngine: 'realtime',
    isRenderModalOpen: false,

    setExportResolution: (exportResolution) => set({ exportResolution }),
    setExportFormat: (exportFormat) => set({ exportFormat }),
    setExportFilename: (exportFilename) => set({ exportFilename }),
    setExportDirectory: (exportDirectory) => set({ exportDirectory }),
    setExportIncludeShadows: (exportIncludeShadows) => set({ exportIncludeShadows }),
    setExportRenderOcclusion: (exportRenderOcclusion) => set({ exportRenderOcclusion }),
    setExportEngine: (exportEngine) => set({ exportEngine }),
    setIsRenderModalOpen: (isRenderModalOpen) => set({ isRenderModalOpen }),
});

// ─── Persisted store ──────────────────────────────────────────────────────────

export const useStore = create<AppState>()(
    persist(storeCreator, {
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
            exportResolution: state.exportResolution,
            exportFormat: state.exportFormat,
            exportFilename: state.exportFilename,
            exportDirectory: state.exportDirectory,
            exportIncludeShadows: state.exportIncludeShadows,
            exportRenderOcclusion: state.exportRenderOcclusion,
            exportEngine: state.exportEngine,
        }),
    }),
);