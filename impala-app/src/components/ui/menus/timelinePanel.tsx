import React from 'react';
import { useStore } from '../../../store';
import { triggerModelImport } from '../../../utils/importModel';
import { Panel } from '../panel';
import { Button } from '../buttons/buttons';
import { Tooltip } from '../Tooltip';
import {
    CameraIcon,
    EyeOpenIcon,
    NetIcon,
    GausssplatIcon,
    ImportIcon,
    PlayIcon,
    PauseIcon
} from '../../icons/index';

export const TimelinePanel: React.FC = () => {
    const { isPlaying, setPlaying, currentFrame, setCurrentFrame, totalFrames } = useStore();
    const { showModels, showGrid, showSplat, toggleVisibility, cameraEnabled } = useStore();

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentFrame(parseInt(e.target.value));
    };

    const renderToggle = (isActive: boolean, Icon: any, onClick: () => void, tooltip: string) => (
        <Tooltip content={tooltip} position="top">
            <Button 
                variant="toggle" 
                className={isActive ? "bg-bg-item border-item-border" : "border-transparent"} 
                onClick={onClick}
            >
                <Icon className={`w-6 h-6 ${isActive ? 'text-text-main' : 'text-item-border'}`} />
            </Button>
        </Tooltip>
    );

    return (
        <Panel className="w-full min-w-[442px] p-[16px] flex flex-col gap-[12px] pointer-events-auto">
            <div className="flex items-center justify-center gap-[8px]">

                {/* Camera track: follow nerfstudio path + show video overlay together */}
                {renderToggle(cameraEnabled, CameraIcon, () => {
                    useStore.setState(s => ({
                        cameraEnabled: !s.cameraEnabled,
                        showVideo: !s.cameraEnabled, 
                    }));
                }, "Toggle Camera Track")}

                {/* Eye: toggle 3D virtual objects (cube, etc.) */}
                {renderToggle(showModels, EyeOpenIcon, () => toggleVisibility('showModels'), "Toggle 3D Objects")}

                {renderToggle(showGrid, NetIcon, () => toggleVisibility('showGrid'), "Toggle Grid")}
                {renderToggle(showSplat, GausssplatIcon, () => toggleVisibility('showSplat'), "Toggle Gaussian Splat")}
                
                <div className="w-[1px] h-[24px] bg-item-border mx-[4px] opacity-50"></div>
        
                <Tooltip content="Import Assets" position="top">
                    <Button variant="toggle" className="border-transparent" onClick={triggerModelImport}>
                        <ImportIcon className="w-6 h-6 text-item-border" />
                    </Button>
                </Tooltip>
            </div>


            <div className="w-full h-[1px] bg-bg-border" />

            {/* Time Info */}
            <div className="text-center font-sans text-[12px] text-text-main font-medium lowercase">
                frame: {currentFrame} / {totalFrames > 0 ? totalFrames - 1 : 0}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-[16px]">
                <Tooltip content={isPlaying ? "Pause" : "Play"} position="top">
                    <Button variant="icon" onClick={() => setPlaying(!isPlaying)}>
                        {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                    </Button>
                </Tooltip>

                {/* Timeline Slider */}
                <div className="relative flex-1 h-[6px] bg-bg-item rounded-full flex items-center">
                    <div
                        className="absolute left-0 h-full bg-accent rounded-full pointer-events-none"
                        style={{ width: `${(currentFrame / (totalFrames || 1)) * 100}%` }}
                    />
                    <input
                        type="range"
                        min="0"
                        max={totalFrames > 0 ? totalFrames - 1 : 0}
                        value={currentFrame}
                        onChange={handleSliderChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>
        </Panel>
    );
};