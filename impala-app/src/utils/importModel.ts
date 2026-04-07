import { useStore } from '../store';

export const triggerModelImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf';
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            useStore.getState().setCustomModelUrl(url);
            useStore.getState().setCustomModelName(file.name);
        }
        document.body.focus();
    };
    input.click();
    
    // In many browsers, clicking a dynamically created input steals focus
    // and holds onto it even after the dialog closes, breaking global hotkeys.
    // We forcefully remove it from focus here.
    if (document.activeElement === input) {
        input.blur();
    }
    // Also explicitly refocus the body just in case
    document.body.focus();
};
