import React from 'react';

interface LabelProps {
    text: string;
    className?: string;
}

export const Label: React.FC<LabelProps> = ({ text, className = '' }) => {
    return (
        <div className={`w-[40px] h-[20px] flex items-center justify-center rounded-[7px] bg-bg-item font-sans text-[12px] text-text-main shrink-0 ${className}`}>
            {text}
        </div>
    );
};