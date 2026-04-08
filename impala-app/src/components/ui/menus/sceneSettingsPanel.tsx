import React, { useState } from 'react';
import { Panel } from '../panel';
import { Divider } from '../divider';
import { SectionHeader } from '../sectionHeader';
import { ValueInputRow } from '../inputs/valueInputRow';
import { ColorPicker } from '../inputs/colorPicker';
import { ProgressBar } from '../progressBar';
import { Button } from '../buttons/buttons';
import { Slider } from '../inputs/slider';
import { Tooltip } from '../Tooltip';
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
    const { envIntensity, setEnvIntensity, envRotation, setEnvRotation, envTint, setEnvTint, setIsBakingEnv, setBakedEnvTexture, setBakedEnvPreview, bakedEnvPreview, videoOpacity, setVideoOpacity } = useStore();
    const [bakeProgress, setBakeProgress] = useState<number>(0); 

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

                <div className="px-[12px] mt-[15px]">
                    <Tooltip content="Revert to default environment" position="top">
                        <Button variant="full" onClick={() => {
                            setBakedEnvTexture(null);
                            setBakedEnvPreview(null);
                        }}>Reset Environment</Button>
                    </Tooltip>
                </div>

                <Divider />

                {/* Preview Baking */}
                <SectionHeader title="Preview Baking" />

                <div className="flex flex-col gap-[8px] px-[12px] mt-[10px]">
                    <span className="font-sans text-[12px] text-text-main">
                        Baking status: {bakeProgress === 100 ? "Finished" : bakeProgress > 0 ? "Baking..." : "Unfinished"}
                    </span>
                    <ProgressBar progress={bakeProgress} />
                </div>

                <div className="flex flex-col gap-[8px] px-[12px] mt-[15px]">
                    <Tooltip content="Apply and bake changes" position="top">
                        <Button variant="full" onClick={() => {
                            setBakeProgress(0);
                            const interval = setInterval(() => {
                                setBakeProgress(p => {
                                    if (p >= 100) {
                                        clearInterval(interval);
                                        setIsBakingEnv(true);
                                        return 100;
                                    }
                                    return p + 20;
                                });
                            }, 100);
                        }}>Bake with current settings</Button>
                    </Tooltip>
                    <Tooltip content="Generate a new environment map" position="top">
                        <Button variant="full" onClick={() => setIsBakingEnv(true)}>Regenerate environment</Button>
                    </Tooltip>
                </div>
                
                <div className="px-[12px] mt-[15px]">
                    <span className="font-sans text-[12px] text-text-main mb-[8px] block">HDRI Preview</span>
                    {bakedEnvPreview ? (
                        <div className="w-full h-[120px] rounded-[6px] overflow-hidden border border-border-secondary bg-bg-surface">
                            <img src={bakedEnvPreview} alt="HDRI Preview" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-full h-[120px] rounded-[6px] overflow-hidden border border-border-secondary bg-bg-surface flex items-center justify-center">
                            <span className="text-[12px] text-text-muted">No baked map</span>
                        </div>
                    )}
                </div>
            </div>
            )}
        </Panel>
    );
};