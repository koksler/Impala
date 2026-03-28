import React, { useState } from 'react';
import { Panel } from '../panel';
import { Button } from '../buttons/buttons';
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
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(50);

    return (
        <Panel className="w-full max-w-[900px] p-[16px] flex flex-col gap-[12px]">
            
            <div className="flex items-center justify-center gap-[8px]">
                <Button variant="toggle"><CameraIcon className="w-6 h-6" /></Button>
                <Button variant="toggle"><EyeOpenIcon className="w-6 h-6" /></Button>
                <Button variant="toggle"><NetIcon className="w-6 h-6" /></Button>
                <Button variant="toggle"><GausssplatIcon className="w-6 h-6" /></Button>
                
                <div className="w-[1px] h-[24px] bg-item-border mx-[4px] opacity-50"></div>
                
                <Button variant="icon"><ImportIcon className="w-6 h-6"/></Button>
            </div>

            <div className="w-full h-[1px] bg-bg-border"></div>

            <div className="text-center font-sans text-[12px] text-text-main font-medium">
                Filename.mp4 <span className="ml-2 opacity-70">5:00 / 10:00</span>
            </div>

            <div className="flex items-center gap-[16px]">
                <Button variant="misc" onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </Button>

                <div className="relative flex-1 h-[6px] bg-bg-item rounded-full cursor-pointer flex items-center">
                    <div 
                        className="absolute left-0 h-full bg-item-border rounded-full pointer-events-none"
                        style={{ width: `${progress}%` }}
                    ></div>
                    <input 
                        type="range" 
                        min="0" max="100" 
                        value={progress}
                        onChange={(e) => setProgress(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>
        </Panel>
    );
};