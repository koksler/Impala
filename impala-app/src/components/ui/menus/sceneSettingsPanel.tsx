import React from 'react';
import { Panel } from '../panel';
import { Divider } from '../divider';
import { SectionHeader } from '../sectionHeader';
import { ValueInputRow } from '../inputs/valueInputRow';
import { ColorPicker } from '../inputs/colorPicker';
import { Slider } from '../inputs/slider';
import { Button } from '../buttons/buttons';
import { Tooltip } from '../Tooltip';
import { useStore } from '../../../store';

import {
    LightbulbIcon,
    PlanetIcon,
    PaletteIcon,
    CameraIcon,
    RotateIcon
} from '../../icons/index';

interface SceneSettingsPanelProps {
    isMinimized: boolean;
}

export const SceneSettingsPanel: React.FC<SceneSettingsPanelProps> = ({ isMinimized }) => {
    const { envIntensity, setEnvIntensity, envRotation, setEnvRotation, envTint, setEnvTint, videoOpacity, setVideoOpacity, setIsBakingEnv, bakedEnvPreview, pushToHistory, lightElevation, setLightElevation } = useStore();

    return (
        <Panel className={`pointer-events-auto ${isMinimized ? "h-fit w-[280px]" : "h-full flex flex-col w-[280px]"}`}>
            {/* Header */}
            <div className="flex justify-between items-center px-[16px] h-10">
                <h1 className="font-sans font-bold text-[16px] text-text-accent m-0 tracking-wide">
                    3D Scene Settings
                </h1>
            </div>

            {!isMinimized && (
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <Divider />

                    {/* Environment Settings */}
                    <SectionHeader title="Environment Settings" />

                    <div className="flex flex-col gap-[10px] mt-[10px] px-[12px]">
                        <div className="flex items-center gap-[10px]">
                            <Slider
                                label="Video Opacity"
                                value={videoOpacity}
                                onChange={setVideoOpacity}
                                onPointerUp={pushToHistory}
                                className="flex-1"
                            />
                            <CameraIcon className="w-5 h-5 text-text-main shrink-0" />
                        </div>

                        <div className="flex items-center gap-[10px]">
                            <Slider
                                label="Environment Intensity"
                                value={envIntensity}
                                onChange={setEnvIntensity}
                                onPointerUp={pushToHistory}
                                className="flex-1"
                            />
                            <LightbulbIcon className="w-5 h-5 text-text-main shrink-0" />
                        </div>


                        <div className="flex items-center gap-[10px]">
                            <ValueInputRow
                                label="Environment Rotation"
                                value={envRotation}
                                onChange={(val) => setEnvRotation(parseFloat(val) || 0)}
                                onFinishChange={pushToHistory}
                                unit="°"
                                className="flex-1"
                            />
                            <PlanetIcon className="w-5 h-5 text-text-main shrink-0" />
                        </div>

                        <div className="flex items-center gap-[10px]">
                            <ValueInputRow
                                label="Light Elevation"
                                value={lightElevation}
                                onChange={(val) => setLightElevation(Math.min(90, Math.max(0, parseFloat(val) || 0)))}
                                onFinishChange={pushToHistory}
                                unit="°"
                                className="flex-1"
                            />
                            <RotateIcon className="w-5 h-5 text-text-main shrink-0" />
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

                    <div className="flex flex-col gap-[8px] px-[12px] mt-[15px]">
                        <Tooltip content="Extracts HDRI-sample from splat" position="bottom">
                            <Button variant="full" onClick={() => setIsBakingEnv(true)}>Make HDRI preview</Button>
                        </Tooltip>
                    </div>
                </div>
            )}
        </Panel>
    );
};