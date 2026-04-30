import { useStore } from '../store';

export const triggerModelImport = (replaceModelId?: string | unknown) => {
    // Button onClick handlers pass a MouseEvent as the first argument — guard against it.
    const targetId = typeof replaceModelId === 'string' ? replaceModelId : undefined;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf';
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            // 1. Immediate preview using blob URL
            const blobUrl = URL.createObjectURL(file);
            const state = useStore.getState();
            const modelId = targetId || Math.random().toString(36).substring(2, 9);
            
            if (targetId) {
                state.updateCustomModel(targetId, {
                    url: blobUrl,
                    name: file.name
                });
            } else {
                state.addCustomModel({
                    id: modelId,
                    url: blobUrl,
                    name: file.name,
                    pos: [0, 0.5, 0],
                    rot: [0, 0, 0],
                    scale: [1, 1, 1]
                });
            }

            // 2. Background upload to backend for persistence
            const projectId = state.activeProjectId;
            if (projectId) {
                const formData = new FormData();
                formData.append('file', file);

                const toastId = state.addToast('Uploading Model', `Uploading ${file.name}...`, 'process');

                fetch(`/api/projects/${projectId}/model`, {
                    method: 'POST',
                    body: formData,
                })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Switch from temporary blob to permanent server URL
                        state.updateCustomModel(modelId, { url: data.url });
                        state.updateToast(toastId, {
                            type: 'success',
                            title: 'Model Uploaded',
                            message: `${file.name} is now persisted to the project.`
                        });
                    }
                })
                .catch(err => {
                    console.error('[UPLOAD] Failed:', err);
                    state.updateToast(toastId, {
                        type: 'error',
                        title: 'Upload Failed',
                        message: 'Model will not be saved. Server error.'
                    });
                });
            }
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
