import React from 'react';

interface PanelProps {
    children: React.ReactNode;
    className?: string;
}

export const Panel: React.FC<PanelProps> = ({ children, className = '' }) => {
    return (
        <div className={`pt-[12px] pb-[12px] flex flex-col rounded-[15px] bg-bg border border-bg-border overflow-hidden ${className}`}>
            {children}
        </div>
    );
};