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
import { Tooltip } from './ui/Tooltip';
import { useStore } from '../store';

interface HeaderProps {
    variant?: 'project' | 'home';
    projectName?: string;
    serverStatus?: 'online' | 'offline' | 'checking';
    onGoHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    variant = 'project',
    projectName,
    serverStatus = 'online',
    onGoHome
}) => {
    const saveCurrentProject = useStore(s => s.saveCurrentProject);
    const startExportPipeline = useStore(s => s.startExportPipeline);
    const isExporting = useStore(s => s.isExporting);

    return (
        <header className={`relative w-full h-[60px] px-[16px] py-[10px] flex items-center justify-between bg-bg border-b border-bg-border text-base text-text-main transition-all duration-300 ${isExporting ? 'pointer-events-none opacity-50 shadow-none' : ''}`}>
            
            {/* Left Section, Logo plus Status */}
            <div className="flex items-center gap-6">
                
                <div className="flex items-center gap-2 cursor-pointer">
                    <ImpalaLogoIcon className="w-[8em] h-8"/>
                </div>

                {variant === 'project' && (
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span>Server Status: {serverStatus.charAt(0).toUpperCase() + serverStatus.slice(1)}</span>
                        <div className={`w-3 h-3 rounded-full ${
                            serverStatus === 'online' ? 'bg-done' : 
                            serverStatus === 'offline' ? 'bg-fail' : 
                            'bg-process animate-pulse'
                        }`} />
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
                        <Tooltip content="Undo" hotkey="Ctrl+Z" position="bottom">
                            <Button variant="icon">
                                <UndoIcon className="w-6 h-6" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Redo" hotkey="Ctrl+Shift+Z" position="bottom">
                            <Button variant="icon">
                                <RedoIcon className="w-6 h-6" />
                            </Button>
                        </Tooltip>

                        {/* Export Action */}
                        <Tooltip content="Export Project" position="bottom">
                            <Button variant="accent" onClick={startExportPipeline} disabled={isExporting}>
                                {isExporting ? 'Rendering...' : 'Export'}
                            </Button>
                        </Tooltip>

                        {/* Document Controls */}
                        <Tooltip content="Save Project" hotkey="Ctrl+S" position="bottom">
                            <Button variant="icon" onClick={saveCurrentProject}>
                                <SaveIcon className="w-6 h-6" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Home Page" position="bottom">
                            <Button variant="icon" onClick={onGoHome}>
                                <HomeIcon className="w-6 h-6" />
                            </Button>
                        </Tooltip>
                    </>
                )}

                <Tooltip content="Settings" position="bottom">
                    <Button variant="icon">
                        <OptionsIcon className="w-6 h-6" />
                    </Button>
                </Tooltip>
            </div>
        </header>
    );
};