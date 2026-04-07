import React from 'react';
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
        shadowOpacity, setShadowOpacity,
        shadowBlur, setShadowBlur,
        shadowColor, setShadowColor,
        matRoughness, setMatRoughness,
        matMetallic, setMatMetallic,
        customModelName,
        setCustomModelUrl,
        setCustomModelName
    } = useStore();

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
                    <div className="flex flex-col gap-[10px] mt-[10px]">
                        <Vector3Input 
                            label="Location" 
                            icon={<LocateIcon />} 
                            x={objPos[0]} y={objPos[1]} z={objPos[2]}
                            onChange={(v) => setObjPos([v.x, v.y, v.z])} 
                        />
                        <Vector3Input 
                            label="Rotation" 
                            icon={<RotateIcon />} 
                            x={objRot[0]} y={objRot[1]} z={objRot[2]}
                            onChange={(v) => setObjRot([v.x, v.y, v.z])} 
                        />
                        <Vector3Input 
                            label="Scale" 
                            icon={<ScaleIcon />} 
                            x={objScale[0]} y={objScale[1]} z={objScale[2]}
                            onChange={(v) => setObjScale([v.x, v.y, v.z])} 
                        />
                    </div>

                    <div className="flex flex-col gap-[8px] px-[12px] mt-[15px]">
                        <Tooltip content="Reset to original transform" position="top">
                            <Button 
                                variant="full"
                                onClick={() => {
                                    setObjPos([0, 0.5, 0]);
                                    setObjRot([0, 0, 0]);
                                    setObjScale([1, 1, 1]);
                                }}
                            >
                                Reset Transform
                            </Button>
                        </Tooltip>
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
                    </div>

                    <Divider />

                    {/* Shadow and Materials */}
                    <SectionHeader title="Shadow and Materials" />
                    
                    <div className="flex items-center gap-[6px] px-[12px] mt-[10px] mb-[10px]">
                        <span className="font-sans text-[12px] text-text-main">Shadow Settings</span>
                        <ShadowIcon className="w-4 h-4 text-text-main shrink-0" />
                    </div>

                    <div className="flex flex-col gap-[10px] px-[12px]">
                        <Slider label="Opacity" value={shadowOpacity} onChange={setShadowOpacity} />
                        <Slider label="Blur" value={shadowBlur} onChange={setShadowBlur} />
                        <ColorPicker color={shadowColor} onChange={setShadowColor} />
                    </div>

                    <div className="flex items-center gap-[6px] px-[12px] mt-[20px] mb-[10px]">
                        <span className="font-sans text-[12px] text-text-main">Material Settings</span>
                        <PaletteIcon className="w-4 h-4 text-text-main shrink-0" />
                    </div>

                    <div className="flex flex-col gap-[10px] px-[12px]">
                        <Slider label="Roughness" value={matRoughness} onChange={setMatRoughness} />
                        <Slider label="Metallic" value={matMetallic} onChange={setMatMetallic} />
                    </div>

                    <Divider />
                </div>
            )}
        </Panel>
    );
};