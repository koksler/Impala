import React from 'react';
import { PlusIcon } from '../icons/index';

interface SectionHeaderProps {
    title: string;
    onAdd?: () => void;
    className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ 
    title,
    onAdd,
    className = ''
}) => {
    return (
        <div className={`flex justify-between items-center w-full px-[12px] ${className}`}>
            <h2 className="font-sans font-bold text-[12px] text-text-main m-0 tracking-wide">
                {title}
            </h2>
            {onAdd && (
                <button 
                    onClick={onAdd}
                    className="w-5 h-5 flex items-center justify-center text-text-main bg-transparent hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                    aria-label="Add object"
                >
                    <PlusIcon className="w-full h-full" />
                </button>
            )}
        </div>
    );
};