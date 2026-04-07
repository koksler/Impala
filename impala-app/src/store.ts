import { create } from 'zustand';

/** The 3x4 applied_transform matrix + scale from nerfstudio's dataparser_transforms.json.
 *  This aligns raw camera poses (transforms.json) with the exported .ply splat space. */
export interface DataparserTransform {
    transform: number[][];  // 3x4 row-major matrix
    scale: number;
}

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
    toggleVisibility: (key: 'showVideo' | 'showModels' | 'showGrid' | 'showSplat') => void;

    videoDimensions: { width: number; height: number } | null;
    setVideoDimensions: (width: number, height: number) => void;

    // Tool Mode
    activeTool: string;
    setActiveTool: (tool: string) => void;
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
    cameraFov: 45,
    toggleVisibility: (key) => set((state) => ({ [key]: !state[key] })),

    videoDimensions: null,
    setVideoDimensions: (width, height) => set({ videoDimensions: { width, height } }),

    activeTool: 'hand',
    setActiveTool: (activeTool) => set({ activeTool }),
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
}));