import React, { useState } from 'react';
import { Button } from '../buttons/buttons';
import {
    HandIcon,
    LocateIcon,
    RotateIcon,
    ScaleIcon,
    MagnetSnapIcon,
    LassoIcon,
    BrushIcon,
    EraserIcon,
    CropIcon
} from '../../icons/index';

export const FloatingToolbar: React.FC = () => {
    const [activeTool, setActiveTool] = useState<string>('hand');

    const renderTool = (name: string, Icon: any) => {
        const isActive = activeTool === name;
        return (
            <Button 
                variant="toggle" 
                onClick={() => setActiveTool(name)}
                className={isActive ? 'text-item-neutral' : ''}
            >
                <Icon className="w-6 h-6" />
            </Button>
        );
    };

    return (
        <div className="flex items-center gap-[12px]">
            <div className="flex items-center gap-[6px] bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                {renderTool('hand', HandIcon)}
                {renderTool('translate', LocateIcon)}
                {renderTool('rotate', RotateIcon)}
                {renderTool('scale', ScaleIcon)}
                {renderTool('snap', MagnetSnapIcon)}
            </div>

            <div className="flex items-center gap-[6px] bg-bg p-[6px] rounded-[16px] border border-bg-border mb-3">
                {renderTool('lasso', LassoIcon)}
                {renderTool('brush', BrushIcon)}
                {renderTool('eraser', EraserIcon)}
                {renderTool('crop', CropIcon)}
            </div>
        </div>
    );
};