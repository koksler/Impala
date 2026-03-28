import React from 'react';
import { Button } from './ui/buttons/buttons';
import { 
  UndoIcon, 
  RedoIcon, 
  SaveIcon, 
  HomeIcon, 
  OptionsIcon,
  ImpalaLogoIcon
} from './icons/index';

interface HeaderProps {
    variant?: 'project' | 'home';
    projectName?: string;
    serverStatus?: 'online' | 'offline';
    onGoHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    variant = 'project',
    projectName,
    serverStatus = 'online',
    onGoHome
}) => {
    return (
        <header className="relative w-full h-[60px] px-[16px] py-[10px] flex items-center justify-between bg-bg border-b border-bg-border text-base text-text-main">
            
            {/* Left Section, Logo plus Status */}
            <div className="flex items-center gap-6">
                
                <div className="flex items-center gap-2 cursor-pointer">
                    <ImpalaLogoIcon className="w-auto h-8"/>
                </div>

                {variant === 'project' && (
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span className='font-semibold text-base'>Server Status: {serverStatus.charAt(0).toUpperCase() + serverStatus.slice(1)}</span>
                        <div className={`w-3 h-3 rounded-full ${serverStatus === 'online' ? 'bg-done' : 'bg-fail'}`} />
                    </div>
                )}
            </div>

            {/* Thats center, only title */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-semibold text-base">
                {variant === 'project' ? projectName : 'Home Page'}
            </div>

            {/* Right Section, Tool Buttons */}
            <div className="flex items-center gap-[10px]">
                {variant === 'project' && (
                    <>
                        {/* Thats History Controls */}
                        <Button variant="icon">
                            <UndoIcon className="w-6 h-6" />
                        </Button>
                        <Button variant="icon">
                            <RedoIcon className="w-6 h-6" />
                        </Button>

                        {/* Export Action */}
                        <Button variant="accent">
                            Export
                        </Button>

                        {/* Document Controls */}
                        <Button variant="icon">
                            <SaveIcon className="w-6 h-6" />
                        </Button>
                        <Button variant="icon" onClick={onGoHome}>
                            <HomeIcon className="w-6 h-6" />
                        </Button>
                    </>
                )}

                {/* Settings is visible on both variants */}
                <Button variant="icon">
                    <OptionsIcon className="w-6 h-6" />
                </Button>
            </div>
        </header>
    );
};