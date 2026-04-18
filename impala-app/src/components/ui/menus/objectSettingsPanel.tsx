import React from 'react';
import * as THREE from 'three';
import { Panel } from '../panel';
import { Divider } from '../divider';
import { SectionHeader } from '../sectionHeader';
import { ObjectListItem } from '../inputs/objectListItem';
import { Vector3Input } from '../inputs/vector3Input';
import { Slider } from '../inputs/slider';
import { ColorPicker } from '../inputs/colorPicker';
import { Button } from '../buttons/buttons';
import { Tooltip } from '../Tooltip';
import { useStore } from '../../../store';
import { triggerModelImport } from '../../../utils/importModel';

import {
    LocateIcon,
    RotateIcon,
    ScaleIcon,
    ShadowIcon,
    PaletteIcon,
    MinimizeIcon,
    MaximizeIcon
} from '../../icons/index';

interface ObjectSettingsPanelProps {
    isMinimized: boolean;
    onToggleMinimize: () => void;
}

export const ObjectSettingsPanel: React.FC<ObjectSettingsPanelProps> = ({isMinimized, onToggleMinimize}) => {

    const { 
        objPos, setObjPos,
        objRot, setObjRot,
        objScale, setObjScale,
        scenePos, setScenePos,
        sceneRot, setSceneRot,
        sceneScale, setSceneScale,
        transformTarget, setTransformTarget,
        shadowOpacity, setShadowOpacity,
        shadowBlur, setShadowBlur,
        shadowColor, setShadowColor,
        matRoughness, setMatRoughness,
        matMetallic, setMatMetallic,
        customModelName,
        setCustomModelUrl,
        setCustomModelName,
        pushToHistory,
        activeProjectId,
        backendUrl,
        setActiveSplatUrl,
        addToast,
        updateToast,
        objBounds,
        splatViewer
    } = useStore();

    const handleClearAroundObject = async () => {
        if (!activeProjectId) return;

        const padding = 1.2;
        // Parent world transform of the object clip - matching the [0, -1.5, 0] offset in EditorCanvas
        const objLocalMatrix = new THREE.Matrix4().compose(
            new THREE.Vector3(...objPos),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...objRot)),
            new THREE.Vector3(
                objScale[0] * objBounds[0] * padding, 
                objScale[1] * objBounds[1] * padding, 
                objScale[2] * objBounds[2] * padding
            )
        );
        const parentTranslation = new THREE.Matrix4().makeTranslation(0, -1.5, 0);
        const objWorldMatrix = parentTranslation.multiply(objLocalMatrix);
        const inverseMatrix = objWorldMatrix.invert();

        // Account for splat's local rotation/transform (the -90deg X rotation in GaussianScene)
        const splatWorldMatrix = new THREE.Matrix4();
        if (splatViewer) {
            // DropInViewer's splat mesh
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

        // Combine: P_local_crop = Inverse(Crop_World) * Splat_World * P_raw_splat
        const finalMatrix = inverseMatrix.multiply(splatWorldMatrix);

        const toastId = addToast("Clearing collisions...", "Processing splat deletion around object...", "process");

        try {
            const res = await fetch(`${backendUrl}/api/projects/${activeProjectId}/crop-inside`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inverse_matrix: Array.from(finalMatrix.elements) })
            });

            if (!res.ok) throw new Error("Failed to clear splats");

            const data = await res.json();
            setActiveSplatUrl(data.new_url);
            updateToast(toastId, { type: 'success', title: 'Collisions Cleared', message: 'Gaussian splats around the object have been removed.' });
        } catch (err) {
            updateToast(toastId, { type: 'error', title: 'Clear Failed', message: 'Could not process reverse crop.' });
        }
    };

    const pos = transformTarget === 'object' ? objPos : scenePos;
    const rot = transformTarget === 'object' ? objRot : sceneRot;
    const scale = transformTarget === 'object' ? objScale : sceneScale;
    const setPos = transformTarget === 'object' ? setObjPos : setScenePos;
    const setRot = transformTarget === 'object' ? setObjRot : setSceneRot;
    const setScale = transformTarget === 'object' ? setObjScale : setSceneScale;

    return (
        <Panel className={isMinimized ? "h-fit w-[280px]" : "h-full flex flex-col w-[280px]"}>
            {/* Header */}
            <div className="flex justify-between items-center px-[16px]">
                <h1 className="font-sans font-bold text-[16px] text-text-accent m-0 tracking-wide">
                    3D Object Settings
                </h1>
                <Tooltip content={isMinimized ? "Maximize panel" : "Minimize panel"} position="left">
                    <Button 
                        variant="toggle" 
                        onClick={onToggleMinimize}
                        aria-label={isMinimized ? "Maximize panel" : "Minimize panel"}
                    >
                        {isMinimized ? <MaximizeIcon className="w-5 h-5" /> : <MinimizeIcon className="w-5 h-5" />}
                    </Button>
                </Tooltip>
            </div>

            {/* Stuff that collapses on minimize */}
            {!isMinimized && (
                <div className="flex flex-col">
                    <Divider />

                    {/* Objects List */}
                    <SectionHeader title="Objects in this project" onAdd={triggerModelImport} />
                    <div className="mt-[10px]">
                        {customModelName ? (
                            <ObjectListItem 
                                name={customModelName.includes('.') ? customModelName.split('.').slice(0, -1).join('.') : customModelName} 
                                extension={customModelName.includes('.') ? customModelName.slice(customModelName.lastIndexOf('.')) : '.glb'} 
                                onSwap={triggerModelImport}
                                onClose={() => {
                                    setCustomModelUrl(null);
                                    setCustomModelName(null);
                                }}
                            />
                        ) : null}
                    </div>

                    <Divider />

                    {/* Transformation */}
                    <SectionHeader title="Transformation" />
                    <div className="flex px-[12px] mt-[10px] gap-[8px]">
                        <Button 
                            variant="toggle" 
                            onClick={() => setTransformTarget('object')}
                            className={`!h-[20px] !rounded-[7px] !text-[12px] flex-1 justify-center ${transformTarget === 'object' ? 'bg-bg-item text-text-accent' : 'border-transparent text-item-border'}`}
                        >
                            3D Object
                        </Button>
                        <Button 
                            variant="toggle" 
                            onClick={() => setTransformTarget('scene')}
                            className={`!h-[20px] !rounded-[7px] !text-[12px] flex-1 justify-center ${transformTarget === 'scene' ? 'bg-bg-item text-text-accent' : 'border-transparent text-item-border'}`}
                        >
                            Entire Scene
                        </Button>
                    </div>
                    <div className="flex flex-col gap-[10px] mt-[10px]">
                        <Vector3Input 
                            label="Location" 
                            icon={<LocateIcon />} 
                            x={pos[0]} y={pos[1]} z={pos[2]}
                            onChange={(v) => setPos([v.x, v.y, v.z])} 
                            onFinishChange={pushToHistory}
                        />
                        <Vector3Input 
                            label="Rotation" 
                            icon={<RotateIcon />} 
                            x={rot[0]} y={rot[1]} z={rot[2]}
                            onChange={(v) => setRot([v.x, v.y, v.z])} 
                            onFinishChange={pushToHistory}
                        />
                        <Vector3Input 
                            label="Scale" 
                            icon={<ScaleIcon />} 
                            x={scale[0]} y={scale[1]} z={scale[2]}
                            onChange={(v) => setScale([v.x, v.y, v.z])} 
                            onFinishChange={pushToHistory}
                        />

                    </div>

                    <div className="flex flex-col gap-[8px] px-[12px] mt-[15px]">
                        <Tooltip content="Reset to original transform" position="top">
                            <Button 
                                variant="full"
                                onClick={() => {
                                    if (transformTarget === 'object') {
                                        setObjPos([0, 0.5, 0]);
                                        setObjRot([0, 0, 0]);
                                        setObjScale([1, 1, 1]);
                                    } else {
                                        setScenePos([0, 0, 0]);
                                        setSceneRot([0, 0, 0]);
                                        setSceneScale([1, 1, 1]);
                                    }
                                }}
                            >
                                Reset Transform
                            </Button>
                        </Tooltip>
                        {transformTarget === 'object' && (
                            <Tooltip content="Move object to floor level" position="top">
                                <Button 
                                    variant="full"
                                    onClick={() => {
                                        // Set floor level as 0.5, assuming 1x1x1 box centered
                                        setObjPos([objPos[0], 0.5, objPos[2]]);
                                    }}
                                >
                                    Snap to Floor
                                </Button>
                            </Tooltip>
                        )}
                        {transformTarget === 'object' && customModelName && (
                            <Tooltip content="Permanently delete splats colliding with the object" position="top">
                                <Button 
                                    variant="full"
                                    onClick={handleClearAroundObject}
                                >
                                    Clear Splats Around Object
                                </Button>
                            </Tooltip>
                        )}
                    </div>

                    <Divider />

                    {/* Shadow and Materials */}
                    <SectionHeader title="Shadow and Materials" />
                    
                    <div className="flex items-center gap-[6px] px-[12px] mt-[10px] mb-[10px]">
                        <span className="font-sans text-[12px] text-text-main">Shadow Settings</span>
                        <ShadowIcon className="w-4 h-4 text-text-main shrink-0" />
                    </div>

                    <div className="flex flex-col gap-[10px] px-[12px]">
                        <Slider label="Opacity" value={shadowOpacity} onChange={setShadowOpacity} onPointerUp={pushToHistory} />
                        <Slider label="Blur" value={shadowBlur} onChange={setShadowBlur} onPointerUp={pushToHistory} />
                        <ColorPicker color={shadowColor} onChange={setShadowColor} />
                    </div>

                    <div className="flex items-center gap-[6px] px-[12px] mt-[20px] mb-[10px]">
                        <span className="font-sans text-[12px] text-text-main">Material Settings</span>
                        <PaletteIcon className="w-4 h-4 text-text-main shrink-0" />
                    </div>

                    <div className="flex flex-col gap-[10px] px-[12px]">
                        <Slider label="Roughness" value={matRoughness} onChange={setMatRoughness} onPointerUp={pushToHistory} />
                        <Slider label="Metallic" value={matMetallic} onChange={setMatMetallic} onPointerUp={pushToHistory} />
                    </div>


                    <Divider />
                </div>
            )}
        </Panel>
    );
};