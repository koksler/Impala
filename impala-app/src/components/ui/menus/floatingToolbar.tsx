import React from 'react';
import { Button } from '../buttons/buttons';
import { Tooltip } from '../Tooltip';
import {
    HandIcon,
    LocateIcon,
    RotateIcon,
    ScaleIcon,
    MagnetSnapIcon,
    LassoIcon,
    BrushIcon,
    EraserIcon,
    CropIcon
} from '../../icons/index';
import { useStore } from '../../../store';
import * as THREE from 'three';

export const FloatingToolbar: React.FC = () => {
    const { activeTool, setActiveTool, snapToGrid, setSnapToGrid, isCropping, setIsCropping } = useStore();

    const handleApplyCrop = async () => {
        const { cropBox, activeProjectId, setActiveSplatUrl, addToast, updateToast } = useStore.getState();

        if (!activeProjectId) {
            addToast("Crop Error", "No active project ID.", "error");
            return;
        }

        const toastId = addToast("Cropping Splats", "Filtering vertex data in the backend...", "process");

        try {
            // The crop box is rendered inside a <group position={[0, -1.5, 0]}> in EditorCanvas
            const parentGroupMatrix = new THREE.Matrix4().makeTranslation(0, -1.5, 0);
            const cropLocalMatrix = new THREE.Matrix4().compose(
                new THREE.Vector3(...cropBox.position),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...cropBox.rotation)),
                new THREE.Vector3(...cropBox.scale)
            );
            const cropWorldMatrix = parentGroupMatrix.multiply(cropLocalMatrix);
            const inverseCropWorldMatrix = cropWorldMatrix.invert();

            // Find the splat world matrix
            const splatViewer = useStore.getState().splatViewer;
            const splatWorldMatrix = new THREE.Matrix4();
            
            if (splatViewer) {
                const mesh = splatViewer.splatMeshes?.[0] || splatViewer.splatMesh;
                if (mesh) {
                    mesh.updateMatrixWorld(true);
                    splatWorldMatrix.copy(mesh.matrixWorld);
                } else {
                    splatWorldMatrix.makeRotationX(-Math.PI / 2);
                }
            } else {
                splatWorldMatrix.makeRotationX(-Math.PI / 2);
            }

            // We combine the matrices: P_local = Inverse(CropWorld) * SplatWorld * P_raw
            const finalMatrix = inverseCropWorldMatrix.multiply(splatWorldMatrix);

            updateToast(toastId, { progress: 50, message: "Crunching numbers in NumPy..." });

            const res = await fetch(`/api/projects/${activeProjectId}/crop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inverse_matrix: Array.from(finalMatrix.elements)
                })
            });

            if (!res.ok) throw new Error("Failed to crop: Server returned error");
            const data = await res.json();

            if (data.status === 'success' && data.new_url) {
                setActiveSplatUrl(data.new_url);
                setIsCropping(false);
                updateToast(toastId, { 
                    type: 'success', 
                    title: 'Crop Applied', 
                    message: 'Gaussian data has been updated.',
                    progress: 100 
                });
                
                // Success toasts auto-remove in store, but we can also manual remove after delay if we want
            }
        } catch (err) {
            console.error('Crop failed.', err);
            updateToast(toastId, { 
                type: 'error', 
                title: 'Crop Failed', 
                message: err instanceof Error ? err.message : 'Unknown error' 
            });
        }
    };

    const renderTool = (name: string, Icon: any) => {
        const isActive = name === 'snap' ? snapToGrid : name === 'crop' ? isCropping : activeTool === name;

        let content = '';
        let hotkey = undefined;
        let position: 'top' | 'bottom' | 'left' | 'right' = 'top';

        switch (name) {
            case 'hand': content = 'Pan View'; hotkey = 'H'; break;
            case 'translate': content = 'Translate Object'; hotkey = 'G'; break;
            case 'rotate': content = 'Rotate Object'; hotkey = 'R'; break;
            case 'scale': content = 'Scale Object'; hotkey = 'S'; break;
            case 'snap': content = 'Snap to Grid'; break;
            case 'lasso': content = 'Lasso Select'; break;
            case 'brush': content = 'Brush Tool'; hotkey = 'B'; break;
            case 'eraser': content = 'Eraser'; hotkey = 'E'; break;
            case 'crop': content = 'Crop Area'; hotkey = 'C'; break;
        }

        return (
            <Tooltip content={content} hotkey={hotkey} position={position}>
                <Button
                    variant="toggle"
                    onClick={() => {
                        if (name === 'snap') {
                            setSnapToGrid(!snapToGrid);
                        } else if (name === 'crop') {
                            setIsCropping(!isCropping);
                        } else {
                            setActiveTool(name);
                        }
                    }}
                    className={isActive ? "bg-bg-item border-item-border" : "border-transparent"}
                >
                    <Icon className={`w-6 h-6 ${isActive ? 'text-text-main' : 'text-item-border'}`} />
                </Button>
            </Tooltip>
        );
    };

    return (
        <div className="flex items-center gap-[12px]">
            <div className="flex items-center gap-[6px] bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                {renderTool('hand', HandIcon)}
                {renderTool('translate', LocateIcon)}
                {renderTool('rotate', RotateIcon)}
                {renderTool('scale', ScaleIcon)}
                {renderTool('snap', MagnetSnapIcon)}
            </div>

            <div className="flex items-center gap-[6px] bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                {renderTool('lasso', LassoIcon)}
                {renderTool('brush', BrushIcon)}
                {renderTool('eraser', EraserIcon)}
                {renderTool('crop', CropIcon)}
            </div>

            {isCropping && (
                <div className="flex items-center bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                    <Button
                        onClick={handleApplyCrop}
                        variant="full"
                    >
                        Apply Crop
                    </Button>
                </div>
            )}
        </div>
    );
};