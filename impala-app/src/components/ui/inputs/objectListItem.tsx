import React from 'react';
import { BoxIcon, SwitchIcon, CloseIcon } from '../../icons/index';
import { Button } from '../buttons/buttons';
import { Label } from '../label';

/* Not really an input, but I classify it as such */

interface ObjectListItemProps {
    name?: string;
    extension?: string;
    onSwap?: () => void;
    onClose?: () => void;
    className?: string;
}

export const ObjectListItem: React.FC<ObjectListItemProps> = ({
    name = "Object_Name",
    extension = ".fbx",
    onSwap = () => console.log('Swap object triggered'),
    onClose = () => console.log('Close object triggered'),
    className = ''
}) => {
    return (
        <div className={`flex justify-between items-center w-full px-[12px] ${className}`}>
            
            {/* Left Side. Icon, Name, and Label */}
            <div className="flex items-center gap-[10px] min-w-0 flex-1 pr-4">
                <div className="w-6 h-6 shrink-0 text-text-main flex items-center justify-center">
                    <BoxIcon className="w-full h-full" />
                </div>
                
                <span className="font-sans text-[12px] text-text-main truncate">
                    {name}
                </span>
                
                <Label text={extension} />
            </div>

            {/* Right Side. Actions */}
            <div className="flex items-center gap-[8px] shrink-0">
                <Button variant="misc" onClick={onSwap} aria-label="Swap object">
                    <SwitchIcon className="w-full h-full" />
                </Button>
                
                <Button variant="misc" onClick={onClose} aria-label="Remove object">
                    <CloseIcon className="w-full h-full" />
                </Button>
            </div>
            
        </div>
    );
};