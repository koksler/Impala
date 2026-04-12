import React from 'react';
import { Panel } from '../panel';
import { Divider } from '../divider';
import { SectionHeader } from '../sectionHeader';
import { ValueInputRow } from '../inputs/valueInputRow';
import { ColorPicker } from '../inputs/colorPicker';
import { Slider } from '../inputs/slider';
import { useStore } from '../../../store';

import {
    LightbulbIcon,
    PlanetIcon,
    PaletteIcon,
    CameraIcon
} from '../../icons/index';

interface SceneSettingsPanelProps {
    isMinimized: boolean;
}

export const SceneSettingsPanel: React.FC<SceneSettingsPanelProps> = ({ isMinimized }) => {
    const { envIntensity, setEnvIntensity, envRotation, setEnvRotation, envTint, setEnvTint, videoOpacity, setVideoOpacity } = useStore();

    return (
        <Panel className={isMinimized ? "h-fit w-[280px] pb-[20px]" : "h-full flex flex-col w-[280px] pb-[12px]"}>
            {/* Header */}
            <div className="flex-none px-[16px]">
                <h1 className="font-sans font-bold text-[16px] text-text-accent m-0 tracking-wide">
                    3D Scene Settings
                </h1>
            </div>

            {!isMinimized && (
                <div className="flex-1">
                <Divider className="mt-[22px]" />

                {/* Environment Settings */}
                <SectionHeader title="Environment Settings" />
                
                <div className="flex flex-col gap-[10px] mt-[10px] px-[12px]">
                    <div className="flex items-center gap-[10px]">
                        <Slider 
                            label="Video Opacity" 
                            value={videoOpacity} 
                            onChange={setVideoOpacity} 
                            className="flex-1"
                        />
                        <CameraIcon className="w-5 h-5 text-text-main shrink-0" />
                    </div>

                    <div className="flex items-center gap-[10px]">
                        <Slider 
                            label="Environment Intensity" 
                            value={envIntensity} 
                            onChange={setEnvIntensity} 
                            className="flex-1"
                        />
                        <LightbulbIcon className="w-5 h-5 text-text-main shrink-0" />
                    </div>

                    <div className="flex items-center gap-[10px]">
                        <ValueInputRow 
                            label="Environment Rotation" 
                            value={envRotation}
                            unit="deg" 
                            onChange={(val) => setEnvRotation(Number(val))} 
                            className="flex-1"
                        />
                        <PlanetIcon className="w-5 h-5 text-text-main shrink-0" />
                    </div>
                </div>

                <div className="flex items-center gap-[6px] px-[12px] mt-[15px] mb-[10px]">
                    <span className="font-sans text-[12px] text-text-main">Environment Tint</span>
                    <PaletteIcon className="w-4 h-4 text-text-main shrink-0" />
                </div>

                <div className="px-[12px]">
                    <ColorPicker color={envTint} onChange={setEnvTint} />
                </div>

                <Divider />
            </div>
            )}
        </Panel>
    );
};