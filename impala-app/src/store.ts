import { create } from 'zustand';

interface AppState {
    serverStatus: 'online' | 'offline' | 'checking';
    checkServerStatus: () => Promise<void>; 
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
    }
}));