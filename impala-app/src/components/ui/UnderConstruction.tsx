import React from 'react';

export const UnderConstruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative group overflow-hidden rounded-[16px]">
        <div className="pointer-events-none opacity-40">
            {children}
        </div>
        <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-auto z-10" />
    </div>
);
