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

export const ObjectSettingsPanel: React.FC<ObjectSettingsPanelProps> = ({ isMinimized, onToggleMinimize }) => {

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
        customModels,
        activeModelId,
        setActiveModelId,
        removeCustomModel,
        pushToHistory,
        activeProjectId,
        backendUrl,
        setActiveSplatUrl,
        addToast,
        updateToast,
        splatViewer
    } = useStore();

    const handleClearAroundObject = async () => {
        if (!activeProjectId || !activeModelId) return;

        pushToHistory();

        // ── Get the model's ACTUAL world-space AABB from the Three.js scene ──
        // DO NOT use objBounds * objScale — objBounds stores LOCAL-space extents
        // (e.g. 100 model units) and multiplying by a tiny scale like 0.05 still
        // produces world-space radii of ~5 units, eating the whole scene.
        const { threeContext } = useStore.getState();
        if (!threeContext?.scene) {
            addToast('Error', 'Scene not ready.', 'error');
            return;
        }

        const modelNode = threeContext.scene.getObjectByName(`custom-model-${activeModelId}`);
        if (!modelNode) {
            addToast('Error', 'Model not found in scene.', 'error');
            return;
        }

        modelNode.updateMatrixWorld(true);
        const worldBox = new THREE.Box3().setFromObject(modelNode);
        if (worldBox.isEmpty()) {
            addToast('Error', 'Could not compute model bounds.', 'error');
            return;
        }

        // Extend the AABB downward by the object's own height so splats hiding
        // under the shadow catcher plane (which sits at model floor level) are
        // also removed. The shadow plane is very thin but sits right at min.y.
        const objectHeight = worldBox.max.y - worldBox.min.y;
        worldBox.min.y -= objectHeight;

        // ── Build the splat world matrix ─────────────────────────────────────
        // Force a full scene matrix update so every object's matrixWorld is
        // current (including the sceneGroupWrapper, GaussianScene group, and
        // any dataparsedTransform applied by the viewer internally).
        threeContext.scene.updateMatrixWorld(true);

        const splatMatrix = new THREE.Matrix4();
        const splatMesh = splatViewer?.splatMeshes?.[0] ?? splatViewer?.splatMesh ?? null;
        if (splatMesh) {
            splatMatrix.copy(splatMesh.matrixWorld);
        } else {
            // Fallback: reconstruct from store values + the standard -π/2 X rotation
            const { scenePos, sceneRot, sceneScale } = useStore.getState();
            const sceneGroupMatrix = new THREE.Matrix4().compose(
                new THREE.Vector3(...scenePos),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...sceneRot)),
                new THREE.Vector3(...sceneScale),
            );
            splatMatrix.copy(sceneGroupMatrix).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        }

        console.log('[clear-splats] AABB:', worldBox.min, '→', worldBox.max);
        console.log('[clear-splats] splatMesh found:', !!splatMesh);
        console.log('[clear-splats] splatMatrix translation:', splatMatrix.elements[12].toFixed(3), splatMatrix.elements[13].toFixed(3), splatMatrix.elements[14].toFixed(3));

        const { activeSplatUrl } = useStore.getState();
        const currentSplatFilename = activeSplatUrl?.split('/').pop() ?? '';

        const toastId = addToast('Clearing collisions...', 'Removing splats inside the model bounds...', 'process');

        try {
            const res = await fetch(
                `${backendUrl}/api/projects/${activeProjectId}/crop-inside`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        aabb_min: [worldBox.min.x, worldBox.min.y, worldBox.min.z],
                        aabb_max: [worldBox.max.x, worldBox.max.y, worldBox.max.z],
                        splat_matrix: Array.from(splatMatrix.elements),
                        current_splat_filename: currentSplatFilename,
                    }),
                },
            );
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setActiveSplatUrl(data.new_url);
            pushToHistory();
            updateToast(toastId, {
                type: 'success',
                title: 'Collisions Cleared',
                message: `Removed ${data.removed ?? 'some'} splats inside the object. Ctrl+Z to undo.`,
            });
        } catch {
            updateToast(toastId, { type: 'error', title: 'Clear Failed', message: 'Could not process crop.' });
        }
    };

    const handleRestoreSplat = async () => {
        if (!activeProjectId) return;
        pushToHistory();
        const toastId = addToast('Restoring...', 'Reverting to original splat data...', 'process');
        try {
            const res = await fetch(`${backendUrl}/api/projects/${activeProjectId}/splat/restore`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setActiveSplatUrl(data.new_url);
            pushToHistory();
            updateToast(toastId, { type: 'success', title: 'Splat Restored', message: 'Reverted to original splat.ply. Ctrl+Z to undo.' });
        } catch {
            updateToast(toastId, { type: 'error', title: 'Restore Failed', message: 'Could not restore original splat.' });
        }
    };


    const pos = transformTarget === 'object' ? objPos : scenePos;
    const rot = transformTarget === 'object' ? objRot : sceneRot;
    const scale = transformTarget === 'object' ? objScale : sceneScale;
    const setPos = transformTarget === 'object' ? setObjPos : setScenePos;
    const setRot = transformTarget === 'object' ? setObjRot : setSceneRot;
    const setScale = transformTarget === 'object' ? setObjScale : setSceneScale;

    return (
        <Panel className={`pointer-events-auto ${isMinimized ? "h-fit w-[280px]" : "h-full flex flex-col w-[280px]"}`}>
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
                        {isMinimized ? <MaximizeIcon /> : <MinimizeIcon />}
                    </Button>
                </Tooltip>
            </div>

            {!isMinimized && (
                <div className="flex flex-col">
                    <Divider />

                    {/* Objects List */}
                    <SectionHeader title="Objects in this project" onAdd={triggerModelImport} />
                    <div className="mt-[10px] flex flex-col gap-[6px] px-[12px]">
                        {customModels.length === 0 && (
                            <span className="text-[0.75rem] text-item-border px-[2px]">There're no objects for now :(</span>
                        )}
                        {customModels.map(model => (
                            <div
                                key={model.id}
                                className={`relative cursor-pointer py-[4px] transition-colors ${activeModelId === model.id ? 'bg-accent/20 rounded-[7px]' : 'bg-transparent'}`}
                                onClick={() => setActiveModelId(model.id)}
                            >
                                <ObjectListItem
                                    name={model.name.includes('.') ? model.name.split('.').slice(0, -1).join('.') : model.name}
                                    extension={model.name.includes('.') ? model.name.slice(model.name.lastIndexOf('.')) : '.glb'}
                                    onSwap={(e) => {
                                        if (e && e.stopPropagation) e.stopPropagation();
                                        triggerModelImport(model.id);
                                    }}
                                    onClose={(e) => {
                                        if (e && e.stopPropagation) e.stopPropagation();
                                        removeCustomModel(model.id);
                                    }}
                                />
                            </div>
                        ))}
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
                                        setObjPos([objPos[0], 0.5, objPos[2]]);
                                    }}
                                >
                                    Snap to Floor
                                </Button>
                            </Tooltip>
                        )}
                        {transformTarget === 'object' && activeModelId && (
                            <Tooltip content="Remove splats inside the selected object's bounds (including shadow area)" position="top">
                                <Button variant="full" onClick={handleClearAroundObject}>
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
                        <Slider label="Blur" value={shadowBlur} step={0.1} showTicks onChange={(v) => setShadowBlur(Math.round(v * 10) / 10)} onPointerUp={pushToHistory} />
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