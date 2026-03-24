import React from 'react';

interface ProgressBarProps {
    progress: number;
    className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
    progress, 
    className = '' 
}) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));

    return (
        <div className={`w-full h-[4px] bg-item-border/40 rounded-full overflow-hidden ${className}`}>
            <div 
                className="h-full bg-accent transition-all duration-300 ease-in-out rounded-full"
                style={{ width: `${clampedProgress}%` }}
            />
        </div>
    );
};