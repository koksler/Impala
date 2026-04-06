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
    const { activeTool, setActiveTool, snapToGrid, setSnapToGrid, isCropping, setIsCropping, splatViewer, cropBox } = useStore();

    const handleApplyCrop = () => {
        if (!splatViewer || !splatViewer.splatMesh) {
            console.warn("[Crop] SplatViewer or mesh not ready");
            return;
        }

        const splatMesh = splatViewer.splatMesh;
        
        // 1. Compute Crop Box World Matrix
        const cropWorldMatrix = new THREE.Matrix4().makeTranslation(0, -1.5, 0).multiply(
            new THREE.Matrix4().compose(
                new THREE.Vector3(...cropBox.position),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...cropBox.rotation)),
                new THREE.Vector3(...cropBox.scale)
            )
        );
        const inverseCropMatrix = cropWorldMatrix.invert();
        const splatWorldMatrix = splatMesh.matrixWorld;

        let centers;
        let splatCount = 0;

        try {
            if (typeof splatMesh.getCenters === 'function') {
                centers = splatMesh.getCenters(); // fallback naming
            } else {
                centers = splatMesh.getSplatCenters();
            }
            splatCount = splatMesh.getSplatCount();
        } catch(e) {
            console.error("Failed to get bounds from splatMesh", e);
            return;
        }

        const point = new THREE.Vector3();
        let deletedCount = 0;

        for (let i = 0; i < splatCount; i++) {
            point.set(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]);
            point.applyMatrix4(splatWorldMatrix);
            point.applyMatrix4(inverseCropMatrix);

            if (Math.abs(point.x) > 0.5 || Math.abs(point.y) > 0.5 || Math.abs(point.z) > 0.5) {
                if (typeof splatMesh.updateSplatDeleted === 'function') {
                    splatMesh.updateSplatDeleted(i, true);
                    deletedCount++;
                } else if (typeof splatViewer.updateSplatDeleted === 'function') {
                    splatViewer.updateSplatDeleted(i, true);
                    deletedCount++;
                }
            }
        }
        console.log(`[Crop] Deleted ${deletedCount} outside box`);
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