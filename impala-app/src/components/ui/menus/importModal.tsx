import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../buttons/buttons';
import { useStore } from '../../../store';
import type { Project } from './homePage';
import { 
    MinimizeIcon, 
    CorrectIcon, 
    NotCorrectIcon 
} from '../../../components/icons';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (project: Project) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [projectName, setProjectName] = useState('Imported Project');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [splatFile, setSplatFile] = useState<File | null>(null);
    const [camerasFile, setCamerasFile] = useState<File | null>(null);
    const [metadataFile, setMetadataFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // dragging states
    const [dragActive, setDragActive] = useState<{ [key: string]: boolean }>({});

    const videoRef = useRef<HTMLInputElement>(null);
    const splatRef = useRef<HTMLInputElement>(null);
    const camerasRef = useRef<HTMLInputElement>(null);
    const metadataRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setVideoFile(null);
            setSplatFile(null);
            setCamerasFile(null);
            setMetadataFile(null);
            setProjectName('Imported Project');
            setDragActive({});
        }
    }, [isOpen]);

    const handleDrag = (e: React.DragEvent, id: string, active: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(prev => ({ ...prev, [id]: active }));
    };

    const handleDrop = (e: React.DragEvent, id: string, setter: (f: File | null) => void) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(prev => ({ ...prev, [id]: false }));
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setter(e.dataTransfer.files[0]);
        }
    };

    const handleImport = async () => {
        const { addToast, backendUrl } = useStore.getState();
        if (!videoFile || !splatFile || !camerasFile) {
            addToast("Missing Files", "Please provide all three required files: Video, PLY, and JSON Cameras.", "error");
            return;
        }

        setIsImporting(true);
        const formData = new FormData();
        formData.append("title", projectName);
        formData.append("video", videoFile);
        formData.append("splat", splatFile);
        formData.append("cameras", camerasFile);
        if (metadataFile) {
            formData.append("dataparser", metadataFile);
        }

        try {
            const res = await fetch(`${backendUrl}/api/projects/import`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.status === 'success') {
                addToast("Import Successful", `Project "${projectName}" is ready to edit.`, "success");
                onSuccess(data.project);
            } else {
                throw new Error(data.detail || "Import failed");
            }
        } catch (error) {
            console.error("Import error:", error);
            addToast("Import Failed", error instanceof Error ? error.message : "Unknown error", "error");
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div 
                className="w-[520px] bg-bg border border-item-border/10 rounded-[15px] p-[24px] shadow-2xl flex flex-col gap-[20px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-[16px] font-bold text-text-accent m-0">Import Existing Project</h2>
                </div>
                
                <div className="flex flex-col gap-[8px]">
                    <label className="text-[14px] text-text-main font-medium">Project Name</label>
                    <input 
                        type="text" 
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Enter project name..."
                        className="w-full bg-bg-item border border-item-border rounded-lg px-[16px] py-[10px] text-text-main outline-none focus:border-accent"
                    />
                </div>

                <div className="flex flex-col gap-[12px]">
                    <div className="flex flex-col gap-[6px]">
                        <span className="text-[12px] text-text-main uppercase tracking-wider opacity-60 font-bold">1. Original Video</span>
                        <div 
                            onClick={() => videoRef.current?.click()} 
                            onDragOver={(e) => handleDrag(e, 'video', true)}
                            onDragLeave={(e) => handleDrag(e, 'video', false)}
                            onDrop={(e) => handleDrop(e, 'video', setVideoFile)}
                            className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all flex items-center gap-3 ${videoFile || dragActive['video'] ? 'border-accent bg-accent/5' : 'border-item-border hover:border-text-main bg-bg-item'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${videoFile ? 'bg-accent text-white' : 'bg-bg-border text-item-border'}`}>
                                {videoFile ? <CorrectIcon className="w-4 h-4" /> : <NotCorrectIcon className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className={videoFile ? "text-text-accent font-medium truncate" : "text-item-border text-[14px]"}>
                                    {videoFile ? videoFile.name : "Select scene video (mp4, mov, webm)"}
                                </span>
                                {videoFile && <span className="text-[10px] opacity-50">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</span>}
                            </div>
                            <input type="file" ref={videoRef} className="hidden" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-[6px]">
                        <span className="text-[12px] text-text-main uppercase tracking-wider opacity-60 font-bold">2. Gaussian Splat (.ply)</span>
                        <div 
                            onClick={() => splatRef.current?.click()} 
                            onDragOver={(e) => handleDrag(e, 'splat', true)}
                            onDragLeave={(e) => handleDrag(e, 'splat', false)}
                            onDrop={(e) => handleDrop(e, 'splat', setSplatFile)}
                            className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all flex items-center gap-3 ${splatFile || dragActive['splat'] ? 'border-accent bg-accent/5' : 'border-item-border hover:border-text-main bg-bg-item'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${splatFile ? 'bg-accent text-white' : 'bg-bg-border text-item-border'}`}>
                                {splatFile ? <CorrectIcon className="w-4 h-4" /> : <NotCorrectIcon className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className={splatFile ? "text-text-accent font-medium truncate" : "text-item-border text-[14px]"}>
                                    {splatFile ? splatFile.name : "Select gaussian splat vertex data"}
                                </span>
                                {splatFile && <span className="text-[10px] opacity-50">{(splatFile.size / 1024 / 1024).toFixed(1)} MB</span>}
                            </div>
                            <input type="file" ref={splatRef} className="hidden" accept=".ply" onChange={(e) => setSplatFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-[6px]">
                        <span className="text-[12px] text-text-main uppercase tracking-wider opacity-60 font-bold">3. Camera Path (.json)</span>
                        <div 
                            onClick={() => camerasRef.current?.click()} 
                            onDragOver={(e) => handleDrag(e, 'cameras', true)}
                            onDragLeave={(e) => handleDrag(e, 'cameras', false)}
                            onDrop={(e) => handleDrop(e, 'cameras', setCamerasFile)}
                            className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all flex items-center gap-3 ${camerasFile || dragActive['cameras'] ? 'border-accent bg-accent/5' : 'border-item-border hover:border-text-main bg-bg-item'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${camerasFile ? 'bg-accent text-white' : 'bg-bg-border text-item-border'}`}>
                                {camerasFile ? <CorrectIcon className="w-4 h-4" /> : <NotCorrectIcon className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className={camerasFile ? "text-text-accent font-medium truncate" : "text-item-border text-[14px]"}>
                                    {camerasFile ? camerasFile.name : "Select cameras/transforms json"}
                                </span>
                                {camerasFile && <span className="text-[10px] opacity-50">{(camerasFile.size / 1024).toFixed(1)} KB</span>}
                            </div>
                            <input type="file" ref={camerasRef} className="hidden" accept=".json" onChange={(e) => setCamerasFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-[6px]">
                        <span className="text-[12px] text-text-main uppercase tracking-wider opacity-60 font-bold">4. Alignment Metadata</span>
                        <div 
                            onClick={() => metadataRef.current?.click()} 
                            onDragOver={(e) => handleDrag(e, 'metadata', true)}
                            onDragLeave={(e) => handleDrag(e, 'metadata', false)}
                            onDrop={(e) => handleDrop(e, 'metadata', setMetadataFile)}
                            className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all flex items-center gap-3 ${metadataFile || dragActive['metadata'] ? 'border-accent bg-accent/5' : 'border-item-border hover:border-text-main bg-bg-item'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${metadataFile ? 'bg-accent text-white' : 'bg-bg-border text-item-border'}`}>
                                {metadataFile ? <CorrectIcon className="w-4 h-4" /> : <NotCorrectIcon className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className={metadataFile ? "text-text-accent font-medium truncate" : "text-item-border text-[14px]"}>
                                    {metadataFile ? metadataFile.name : "Select dataparser_transforms.json"}
                                </span>
                                {metadataFile && <span className="text-[10px] opacity-50">{(metadataFile.size / 1024).toFixed(1)} KB</span>}
                            </div>
                            <input type="file" ref={metadataRef} className="hidden" accept=".json" onChange={(e) => setMetadataFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-[12px] mt-[10px]">
                    <Button variant="menu-misc" onClick={onClose}>Cancel</Button>
                    <Button 
                        variant="accent" 
                        onClick={handleImport} 
                        disabled={isImporting}
                    >
                        {isImporting ? 'Syncing...' : 'Start Editing'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
