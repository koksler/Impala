import React from 'react';

export const Divider: React.FC<{ className?: string }> = ({ className = '' }) => {
    return (
        <div className={`mx-[12px] my-[15px] border-t border-bg-border ${className}`} />
    );
};