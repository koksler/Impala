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