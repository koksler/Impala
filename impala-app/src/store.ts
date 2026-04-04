import { create } from 'zustand';

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
    setCameraData: (data: CameraFrame[]) => void;

    showVideo: boolean;
    showModels: boolean;
    showGrid: boolean;
    showSplat: boolean;
    toggleVisibility: (key: 'showVideo' | 'showModels' | 'showGrid' | 'showSplat') => void;
}

interface CameraFrame {
    file_path: string;
    transform_matrix: number[][];
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
    showVideo: true,
    showModels: true,
    showGrid: true,
    showSplat: true,
    toggleVisibility: (key) => set((state) => ({ [key]: !state[key] })),
  
    setPlaying: (isPlaying) => set({ isPlaying }),
    setCurrentFrame: (currentFrame) => set({ currentFrame }),
    setCameraData: (cameraData) => set({ 
      cameraData, 
      totalFrames: cameraData.length 
    }),
}));