import React, { useEffect, useRef } from 'react';
import { useStore } from '../../../store';
import { SegmentedControl } from '../inputs/SegmentedControl';
import { TextInputRow } from '../inputs/textInputRow';
import { Toggle } from '../inputs/Toggle';
import { Button } from '../buttons/buttons';
import { ProgressBar } from '../progressBar';

export const RenderModal: React.FC = () => {
    const {
        isRenderModalOpen,
        setIsRenderModalOpen,
        isExporting,
        startExportPipeline,
        currentFrame,
        totalFrames,
        fps,
        exportResolution,
        setExportResolution,
        exportFormat,
        setExportFormat,
        exportDirectory,
        setExportDirectory,
        exportIncludeShadows,
        setExportIncludeShadows,
        exportRenderOcclusion,
        setExportRenderOcclusion,
    } = useStore();

    const formatTime = (frame: number) => {
        const totalSeconds = frame / (fps || 24);
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- CANVAS TELEPORTATION ---
    useEffect(() => {
        const mainCanvas = document.querySelector('.main-canvas-wrapper') as HTMLElement;
        const slot = document.getElementById('export-preview-slot');
        
        let originalParent: HTMLElement | null = null;
        let nextSibling: Node | null = null;

        if (mainCanvas && slot) {
            originalParent = mainCanvas.parentElement;
            nextSibling = mainCanvas.nextSibling;
            slot.appendChild(mainCanvas);
            
            // Ensure it fills the slot
            mainCanvas.style.position = 'absolute';
            mainCanvas.style.inset = '0';
            mainCanvas.style.width = '100%';
            mainCanvas.style.height = '100%';
        }

        return () => {
            if (mainCanvas && originalParent) {
                mainCanvas.style.position = '';
                mainCanvas.style.inset = '';
                mainCanvas.style.width = '';
                mainCanvas.style.height = '';
                
                if (nextSibling) {
                    originalParent.insertBefore(mainCanvas, nextSibling);
                } else {
                    originalParent.appendChild(mainCanvas);
                }
            }
        };
    }, []);

    if (!isRenderModalOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 cursor-pointer"
            style={{ backgroundColor: 'color-mix(in oklab, var(--color-black) 60%, transparent)' }}
            onClick={() => setIsRenderModalOpen(false)}
        >
            <div 
                className="flex gap-4 h-[924px] max-w-full max-h-[95vh] cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* LEFT PANEL: Settings */}
                <div className="w-[513px] bg-bg rounded-[15px] px-[20px] py-[10px] flex flex-col overflow-y-auto scrollbar-hide">
                    <h2 className="text-[16px] text-item-border font-bold mb-6 mt-2">Export options</h2>
                    
                    <h3 className="text-[16px] text-text-main font-bold mb-3">Output control</h3>
                    
                    <div className="flex flex-col gap-3">
                        {/* Resolution */}
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Resolution</span>
                                <span className="text-text-main/60 text-[12px]">Scale of original input.</span>
                            </div>
                            <div className="flex justify-end">
                                <SegmentedControl 
                                    options={['720p', '1080p', 'Lossless']} 
                                    value={exportResolution} 
                                    onChange={setExportResolution} 
                                />
                            </div>
                        </div>

                        {/* Output format */}
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Output format</span>
                                <span className="text-text-main/60 text-[12px]">Type of file you get when we're done.</span>
                            </div>
                            <div className="flex justify-end">
                                <SegmentedControl 
                                    options={['.mp4', '.webm', '.wav']} 
                                    value={exportFormat} 
                                    onChange={setExportFormat} 
                                />
                            </div>
                        </div>

                        {/* Output Directory */}
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Output Directory</span>
                                <span className="text-text-main/60 text-[12px]">Location where it would be autosaved.</span>
                            </div>
                            <div className="flex justify-end">
                                <TextInputRow 
                                    label="" 
                                    value={exportDirectory} 
                                    onChange={setExportDirectory} 
                                />
                            </div>
                        </div>
                    </div>

                    <h3 className="text-[16px] text-text-main font-bold mt-6 mb-3">Render Passes</h3>
                    
                    <div className="flex flex-col gap-3">
                        {/* Include Shadows */}
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Include Shadows</span>
                                <span className="text-text-main/60 text-[12px]">Do we render shadows below objects?</span>
                            </div>
                            <div className="flex justify-end">
                                <Toggle checked={exportIncludeShadows} onChange={setExportIncludeShadows} />
                            </div>
                        </div>

                        {/* Render occlusion */}
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Render occlusion</span>
                                <span className="text-text-main/60 text-[12px]">Do we render obstacle behaviour?</span>
                            </div>
                            <div className="flex justify-end">
                                <Toggle checked={exportRenderOcclusion} onChange={setExportRenderOcclusion} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-6">
                        {!isExporting ? (
                            <Button variant="accent" className="w-full py-3" onClick={startExportPipeline}>
                                Begin Export
                            </Button>
                        ) : (
                            <Button className="w-full py-3 bg-bg-item text-text-main" onClick={() => useStore.getState().setIsExporting(false)}>
                                Cancel Export
                            </Button>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Preview */}
                <div className="w-[1375px] bg-bg rounded-[15px] p-[20px] flex flex-col">
                    <h2 className="text-[16px] text-item-border font-bold mb-4">Export preview</h2>
                    
                    <div id="export-preview-slot" className="flex-1 bg-black rounded-[12px] overflow-hidden relative">
                        {/* Canvas will be teleported here */}
                    </div>

                    <ProgressBar 
                        progress={totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0} 
                        className="mt-4" 
                    />

                    <div className="text-[12px] text-text-main mt-4 flex flex-col items-center gap-1">
                        <span>Filename{exportFormat} {formatTime(currentFrame)}/{formatTime(totalFrames)}</span>
                        <span>Total frames: {totalFrames}</span>
                        <span>Rendered frames: {currentFrame}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
