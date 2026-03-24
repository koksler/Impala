import React, { useState } from 'react';
import { Panel } from '../panel';
import { Divider } from '../divider';
import { SectionHeader } from '../sectionHeader';
import { ObjectListItem } from '../inputs/objectListItem';
import { Vector3Input } from '../inputs/vector3Input';
import { Slider } from '../inputs/slider';
import { ColorPicker } from '../inputs/colorPicker';
import { Button } from '../buttons/buttons';

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

    // Transformation States
    const [location, setLocation] = useState({ x: 0, y: 0, z: 0 });
    const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
    const [scale, setScale] = useState({ x: 0, y: 0, z: 0 });

    // Shadow and Material States
    const [opacity, setOpacity] = useState(0.5);
    const [blur, setBlur] = useState(0.5);
    const [color, setColor] = useState('#313133');
    const [roughness, setRoughness] = useState(0.5);
    const [metallic, setMetallic] = useState(0.5);

    return (
        <Panel className={isMinimized ? "h-fit w-[280px]" : "h-full flex flex-col w-[280px]"}>
            {/* Header */}
            <div className="flex justify-between items-center px-[16px]">
                <h1 className="font-sans font-bold text-[16px] text-text-accent m-0 tracking-wide">
                    3D Object Settings
                </h1>
                <Button 
                    variant="toggle" 
                    onClick={onToggleMinimize}
                    aria-label={isMinimized ? "Maximize panel" : "Minimize panel"}
                >
                    {isMinimized ? <MaximizeIcon className="w-5 h-5" /> : <MinimizeIcon className="w-5 h-5" />}
                </Button>
            </div>

            {/* Stuff that collapses on minimize */}
            {!isMinimized && (
                <div className="flex flex-col">
                    <Divider />

                    {/* Objects List */}
                    <SectionHeader title="Objects in this project" onAdd={() => console.log('Add object')} />
                    <div className="mt-[10px]">
                        <ObjectListItem name="Object_Name" extension=".fbx" />
                    </div>

                    <Divider />

                    {/* Transformation */}
                    <SectionHeader title="Transformation" />
                    <div className="flex flex-col gap-[10px] mt-[10px]">
                        <Vector3Input 
                            label="Location" 
                            icon={<LocateIcon />} 
                            {...location} 
                            onChange={setLocation} 
                        />
                        <Vector3Input 
                            label="Rotation" 
                            icon={<RotateIcon />} 
                            {...rotation} 
                            onChange={setRotation} 
                        />
                        <Vector3Input 
                            label="Scale" 
                            icon={<ScaleIcon />} 
                            {...scale} 
                            onChange={setScale} 
                        />
                    </div>

                    <div className="flex flex-col gap-[8px] px-[12px] mt-[15px]">
                        <Button variant="full">Reset Transform</Button>
                        <Button variant="full">Snap to Floor</Button>
                    </div>

                    <Divider />

                    {/* Shadow and Materials */}
                    <SectionHeader title="Shadow and Materials" />
                    
                    <div className="flex items-center gap-[6px] px-[12px] mt-[10px] mb-[10px]">
                        <span className="font-sans text-[12px] text-text-main">Shadow Settings</span>
                        <ShadowIcon className="w-4 h-4 text-text-main shrink-0" />
                    </div>

                    <div className="flex flex-col gap-[10px] px-[12px]">
                        <Slider label="Opacity" value={opacity} onChange={setOpacity} />
                        <Slider label="Blur" value={blur} onChange={setBlur} />
                        <ColorPicker color={color} onChange={setColor} />
                    </div>

                    <div className="flex items-center gap-[6px] px-[12px] mt-[20px] mb-[10px]">
                        <span className="font-sans text-[12px] text-text-main">Material Settings</span>
                        <PaletteIcon className="w-4 h-4 text-text-main shrink-0" />
                    </div>

                    <div className="flex flex-col gap-[10px] px-[12px]">
                        <Slider label="Roughness" value={roughness} onChange={setRoughness} />
                        <Slider label="Metallic" value={metallic} onChange={setMetallic} />
                    </div>

                    <Divider />
                </div>
            )}
        </Panel>
    );
};