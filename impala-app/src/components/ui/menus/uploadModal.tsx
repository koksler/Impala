import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../buttons/buttons';
import { ProgressBar } from '../progressBar';
import type { Project } from './homePage';
import { useStore } from '../../../store';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (project: Project) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [projectName, setProjectName] = useState('New 3D Scene');
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing'>('idle');
    const [progress, setProgress] = useState(0);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // НОВЫЙ СТЕЙТ ДЛЯ DRAG & DROP
    const [isDragging, setIsDragging] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setIsVisible(true), 10);
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && isOpen && status === 'idle') {
                    onClose();
                }
            };
            window.addEventListener('keydown', handleEsc);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('keydown', handleEsc);
            };
        } else {
            setIsVisible(false);
            setStatus('idle');
            setProgress(0);
            setFile(null);
            setIsDragging(false);
        }
    }, [isOpen, status, onClose]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleStart = async () => {
        const { addToast, backendUrl } = useStore.getState();
        if (!file) {
            addToast("Upload Missing", "Please select a file first!", "error");
            return;
        }

        setStatus('uploading');

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", projectName);

        try {
            const uploadRes = await fetch(`${backendUrl}/api/upload`, {
                method: "POST",
                body: formData,
            });
            const data = await uploadRes.json();

            if (data.status === 'success') {
                setStatus('processing');

                const interval = setInterval(async () => {
                    const statusRes = await fetch(`${backendUrl}/api/projects/${data.project_id}/status`);
                    const statusData = await statusRes.json();

                    setProgress(statusData.progress || 0);

                    if (statusData.status === 'done') {
                        clearInterval(interval);
                        onSuccess(statusData.project);
                    } else if (statusData.status === 'error') {
                        clearInterval(interval);
                        addToast("Processing Failed", "The server encountered an error while baking splats.", "error");
                        onClose();
                    }
                }, 3000);
            }
        } catch (error) {
            console.error("Upload error:", error);
            addToast("Server Error", "Could not connect to the upload service.", "error");
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={(e) => {
                if (e.target === e.currentTarget && status === 'idle') onClose();
            }}
        >
            <div className={`w-[480px] bg-bg border border-bg-border rounded-[15px] p-[24px] flex flex-col gap-[20px] transition-all duration-100 ease-out transform ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <h2 className="text-[16px] font-bold text-text-accent m-0">Create New Project</h2>

                {status === 'idle' ? (
                    <>
                        <div className="flex flex-col gap-[8px]">
                            <label className="text-[14px] text-text-main font-medium">Project Name</label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="w-full bg-bg-item border border-item-border rounded-lg px-[16px] py-[10px] text-text-main outline-none focus:border-accent"
                            />
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <label className="text-[14px] text-text-main font-medium">Media Source</label>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    flex flex-col items-center justify-center border-2 border-dashed rounded-[12px] p-[24px] cursor-pointer transition-colors
                                    ${isDragging ? 'border-accent bg-accent/10' : 'border-item-border bg-bg-item hover:bg-bg-border'}
                                `}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="video/*,image/*"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                                {file ? (
                                    <div className="text-center">
                                        <span className="text-text-accent font-medium">{file.name}</span>
                                        <p className="text-[12px] text-item-border mt-1">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center text-text-main">
                                        <span className="font-medium">Click or drag file here</span>
                                        <p className="text-[12px] text-item-border mt-1">Supports MP4, WEBM, JPG, PNG</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-[12px] mt-[10px]">
                            <Button variant="menu-misc" onClick={onClose}>Cancel</Button>
                            <Button variant="accent" onClick={handleStart}>
                                Upload & Bake
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-[12px] py-[20px]">
                        <div className="flex justify-between text-[14px] text-text-main font-medium">
                            <span>{status === 'uploading' ? 'Uploading file...' : 'Baking Gaussian Splats...'}</span>
                            <span>{progress}%</span>
                        </div>
                        <ProgressBar progress={progress} />
                        <span className="text-[12px] text-item-border text-center mt-[10px]">
                            COLMAP could take eternity. Relax and wait :)
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};