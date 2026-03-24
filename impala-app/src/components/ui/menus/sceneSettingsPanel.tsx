import React, { useState } from 'react';
import { Panel } from '../panel';
import { Divider } from '../divider';
import { SectionHeader } from '../sectionHeader';
import { ValueInputRow } from '../inputs/valueInputRow';
import { ColorPicker } from '../inputs/colorPicker';
import { ProgressBar } from '../progressBar';
import { Button } from '../buttons/buttons';
import { Slider } from '../inputs/slider'
 
import {
    LightbulbIcon,
    PlanetIcon,
    PaletteIcon
} from '../../icons/index';

interface SceneSettingsPanelProps {
    isMinimized: boolean;
}

export const SceneSettingsPanel: React.FC<SceneSettingsPanelProps> = ({ isMinimized }) => {
    const [intensity, setIntensity] = useState(0.5);
    const [rotation, setRotation] = useState(0);
    const [tintColor, setTintColor] = useState<string>('#FFFFFF');

    const [bakeProgress, setBakeProgress] = useState<number>(35); 

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
                            label="Environment Intensity" 
                            value={intensity} 
                            onChange={setIntensity} 
                            className="flex-1"
                        />
                        <LightbulbIcon className="w-5 h-5 text-text-main shrink-0" />
                    </div>

                    <div className="flex items-center gap-[10px]">
                        <ValueInputRow 
                            label="Environment Rotation" 
                            value={rotation}
                            unit="deg" 
                            onChange={setRotation} 
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
                    <ColorPicker color={tintColor} onChange={setTintColor} />
                </div>

                <div className="px-[12px] mt-[15px]">
                    <Button variant="full">Reset Environment</Button>
                </div>

                <Divider />

                {/* Preview Baking */}
                <SectionHeader title="Preview Baking" />

                <div className="flex flex-col gap-[8px] px-[12px] mt-[10px]">
                    <span className="font-sans text-[12px] text-text-main">
                        Baking status: Unfinished
                    </span>
                    <ProgressBar progress={bakeProgress} />
                </div>

                <div className="flex flex-col gap-[8px] px-[12px] mt-[15px]">
                    <Button variant="full">Bake with current settings</Button>
                    <Button variant="full">Regenerate environment</Button>
                </div>
            </div>
            )}
        </Panel>
    );
};