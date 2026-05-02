import React, { useState, useEffect } from 'react';
import { Button } from '../buttons/buttons';
import { ProgressBar } from '../progressBar';
import type { Project } from './homePage';
import { useStore } from '../../../store';

interface LinkAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (project: Project) => void;
}

export const LinkAssetModal: React.FC<LinkAssetModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [projectName, setProjectName] = useState('External 3D Scene');
    const [assetUrl, setAssetUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'downloading' | 'processing'>('idle');
    const [progress, setProgress] = useState(0);

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
            setAssetUrl('');
        }
    }, [isOpen, status, onClose]);

    const handleStart = async () => {
        const { addToast, backendUrl } = useStore.getState();
        
        if (!assetUrl.trim()) {
            addToast("URL Missing", "Please provide a direct media link!", "error");
            return;
        }

        setStatus('downloading');

        try {
            const res = await fetch(`${backendUrl}/api/link-asset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: assetUrl,
                    title: projectName
                }),
            });
            const data = await res.json();

            if (data.status === 'success') {
                const interval = setInterval(async () => {
                    const statusRes = await fetch(`${backendUrl}/api/projects/${data.project_id}/status`);
                    const statusData = await statusRes.json();

                    setProgress(statusData.progress || 0);

                    if (statusData.status === 'downloading') {
                        setStatus('downloading');
                    } else if (statusData.status === 'processing' || statusData.status === 'starting') {
                        setStatus('processing');
                    }

                    if (statusData.status === 'done') {
                        clearInterval(interval);
                        onSuccess(statusData.project);
                    } else if (statusData.status === 'error') {
                        clearInterval(interval);
                        addToast("Processing Failed", "Could not download or bake the asset.", "error");
                        onClose();
                    }
                }, 3000);
            } else {
                 addToast("Request Failed", data.detail || "Server error.", "error");
                 onClose();
            }
        } catch (error) {
            console.error("Link error:", error);
            addToast("Server Error", "Could not connect to the backend.", "error");
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
                <h2 className="text-[16px] font-bold text-text-accent m-0">Link External Asset</h2>

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
                            <label className="text-[14px] text-text-main font-medium">Direct Video URL</label>
                            <input
                                type="url"
                                value={assetUrl}
                                placeholder="https://example.com/video.mp4"
                                onChange={(e) => setAssetUrl(e.target.value)}
                                className="w-full bg-bg-item border border-item-border rounded-lg px-[16px] py-[10px] text-text-main outline-none focus:border-accent"
                            />
                            <p className="text-[11px] text-item-border mt-1">
                                Must be a direct link to .mp4, .webm or other media file.
                            </p>
                        </div>

                        <div className="flex justify-end gap-[12px] mt-[10px]">
                            <Button variant="menu-misc" onClick={onClose}>Cancel</Button>
                            <Button variant="accent" onClick={handleStart}>
                                Link & Bake
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-[12px] py-[20px]">
                        <div className="flex justify-between text-[14px] text-text-main font-medium">
                            <span>{status === 'downloading' ? 'Downloading remote asset...' : 'Baking Gaussian Splats...'}</span>
                            <span>{progress}%</span>
                        </div>
                        <ProgressBar progress={progress} />
                        <span className="text-[12px] text-item-border text-center mt-[10px]">
                            {status === 'downloading' ? 'Fetching media from external server...' : 'GPU is heating up. This takes a few minutes.'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
