import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../../store';
import { SegmentedControl } from '../inputs/SegmentedControl';
import { TextInputRow } from '../inputs/textInputRow';
import { Toggle } from '../inputs/Toggle';
import { Button } from '../buttons/buttons';
import { ProgressBar } from '../progressBar';
import { UnderConstruction } from '../UnderConstruction';


// ─── Types ────────────────────────────────────────────────────────────────────

type BlenderStatus = {
    available: boolean;
    path: string | null;
    version: string | null;
};

type JobStatus = 'queued' | 'rendering' | 'compositing' | 'done' | 'error' | 'cancelled';

// ─── Component ────────────────────────────────────────────────────────────────

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
        exportFilename,
        setExportFilename,
        exportIncludeShadows,
        setExportIncludeShadows,
        exportRenderOcclusion,
        setExportRenderOcclusion,
        exportEngine,
        setExportEngine,
        backendUrl,
        activeProjectId,
        // Scene state for Blender render
        objPos, objRot, objScale,
        scenePos, sceneRot, sceneScale,
        envIntensity, envRotation, lightElevation, envTint,
        shadowBlur, shadowOpacity,
    } = useStore();

    // ── Blender availability ──────────────────────────────────────────────────
    const [blenderStatus, setBlenderStatus] = useState<BlenderStatus | null>(null);
    const [blenderChecking, setBlenderChecking] = useState(false);

    const checkBlender = useCallback(async () => {
        setBlenderChecking(true);
        try {
            const res = await fetch(`${backendUrl}/api/blender/available`);
            const data: BlenderStatus = await res.json();
            setBlenderStatus(data);
        } catch {
            setBlenderStatus({ available: false, path: null, version: null });
        } finally {
            setBlenderChecking(false);
        }
    }, [backendUrl]);

    // Check Blender availability when modal opens
    useEffect(() => {
        if (isRenderModalOpen) checkBlender();
    }, [isRenderModalOpen, checkBlender]);

    // ── Blender job polling ───────────────────────────────────────────────────
    const [blenderJobId, setBlenderJobId] = useState<string | null>(null);
    const [blenderJobStatus, setBlenderJobStatus] = useState<JobStatus | null>(null);
    const [blenderProgress, setBlenderProgress] = useState(0);
    const [blenderError, setBlenderError] = useState<string | null>(null);
    const [blenderOutputUrl, setBlenderOutputUrl] = useState<string | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const startPolling = useCallback((jobId: string) => {
        stopPolling();
        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(
                    `${backendUrl}/api/projects/${activeProjectId}/render/blender/${jobId}/status`
                );
                const data = await res.json();
                setBlenderJobStatus(data.status as JobStatus);
                setBlenderProgress(data.progress ?? 0);
                if (data.url) setBlenderOutputUrl(data.url);
                if (data.error) setBlenderError(data.error);
                if (['done', 'error', 'cancelled'].includes(data.status)) {
                    stopPolling();
                }
            } catch {
                stopPolling();
            }
        }, 1500);
    }, [backendUrl, activeProjectId, stopPolling]);

    useEffect(() => () => stopPolling(), [stopPolling]);

    const handleStartBlenderRender = async () => {
        if (!activeProjectId) return;
        setBlenderJobStatus('queued');
        setBlenderProgress(0);
        setBlenderError(null);
        setBlenderOutputUrl(null);

        const resMap: Record<string, [number, number]> = {
            '720p': [1280, 720],
            '1080p': [1920, 1080],
            'Lossless': [3840, 2160],
        };
        const [width, height] = resMap[exportResolution] ?? [1920, 1080];

        const payload = {
            engine: exportEngine,
            samples: exportEngine === 'cycles' ? 128 : 64,
            width,
            height,
            format: exportFormat,
            include_shadows: exportIncludeShadows,
            render_occlusion: exportRenderOcclusion,
            proxy_url: useStore.getState().activeProxyUrl,
            obj_pos: objPos,
            obj_rot: objRot,
            obj_scale: objScale,
            scene_pos: scenePos,
            scene_rot: sceneRot,
            scene_scale: sceneScale,
            env_intensity: envIntensity,
            env_rotation: envRotation,
            light_elevation: lightElevation,
            env_tint: envTint,
            shadow_blur: shadowBlur,
            shadow_opacity: shadowOpacity,
        };

        try {
            const res = await fetch(
                `${backendUrl}/api/projects/${activeProjectId}/render/blender`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setBlenderJobId(data.job_id);
            startPolling(data.job_id);
        } catch (err) {
            setBlenderJobStatus('error');
            setBlenderError(String(err));
        }
    };

    const handleCancelBlender = async () => {
        if (!blenderJobId || !activeProjectId) return;
        stopPolling();
        await fetch(
            `${backendUrl}/api/projects/${activeProjectId}/render/blender/${blenderJobId}/cancel`,
            { method: 'POST' }
        );
        setBlenderJobStatus('cancelled');
    };

    // ── Canvas teleportation ──────────────────────────────────────────────────
    useEffect(() => {
        const mainCanvas = document.querySelector('.main-canvas-wrapper') as HTMLElement;
        const slot = document.getElementById('export-preview-slot');

        let originalParent: HTMLElement | null = null;
        let nextSibling: Node | null = null;

        if (mainCanvas && slot) {
            originalParent = mainCanvas.parentElement;
            nextSibling = mainCanvas.nextSibling;
            slot.appendChild(mainCanvas);
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

    // ── Derived state ─────────────────────────────────────────────────────────
    const isBlenderEngine = exportEngine !== 'realtime';
    const isBlenderRunning = isBlenderEngine && blenderJobStatus !== null &&
        !['done', 'error', 'cancelled'].includes(blenderJobStatus ?? '');

    const formatTime = (frame: number) => {
        const totalSeconds = frame / (fps || 24);
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const blenderStatusLabel = () => {
        if (!blenderJobStatus) return null;
        const labels: Record<string, string> = {
            queued: 'Queued…',
            rendering: 'Rendering frames in Blender…',
            compositing: 'Compositing with FFmpeg…',
            done: 'Done! Export ready.',
            error: `Error: ${blenderError ?? 'Unknown'}`,
            cancelled: 'Cancelled.',
        };
        return labels[blenderJobStatus] ?? blenderJobStatus;
    };

    if (!isRenderModalOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center py-4 px-[15px] cursor-pointer bg-black/60"
            onClick={() => {
                if (!isExporting && !isBlenderRunning) {
                    setIsRenderModalOpen(false);
                }
            }}
        >
            <div
                className="flex gap-4 w-full h-[924px] max-h-[95vh] cursor-default"
                onClick={e => e.stopPropagation()}
            >

                {/* LEFT PANEL: Settings */}
                <div className="flex-[35] bg-bg border border-bg-border rounded-[15px] px-[20px] py-[10px] flex flex-col overflow-hidden scrollbar-hide">
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
                                    options={['.mp4', '.webm']}
                                    value={exportFormat}
                                    onChange={setExportFormat}
                                />
                            </div>
                        </div>

                        {/* Custom Filename */}
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Filename</span>
                                <span className="text-text-main/60 text-[12px]">Designate the target file output name.</span>
                            </div>
                            <div className="flex justify-end">
                                <TextInputRow
                                    label=""
                                    value={exportFilename}
                                    onChange={setExportFilename}
                                />
                            </div>
                        </div>

                    </div>


                    {/* Render passes — realtime only */}
                    {!isBlenderEngine && (
                        <>
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
                                    <Toggle checked={exportRenderOcclusion} onChange={setExportRenderOcclusion} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Blender progress details */}
                    {isBlenderEngine && blenderJobStatus && (
                        <div className="mt-4 bg-bg-item/30 rounded-[12px] px-4 py-3 text-[12px] text-text-muted flex flex-col gap-1">
                            <span className={blenderJobStatus === 'error' ? 'text-red-400' : blenderJobStatus === 'done' ? 'text-green-400' : 'text-text-main'}>
                                {blenderStatusLabel()}
                            </span>
                            {blenderOutputUrl && blenderJobStatus === 'done' && (
                                <a
                                    href={`${backendUrl}${blenderOutputUrl}`}
                                    download
                                    className="text-accent underline mt-1"
                                >
                                    Download output
                                </a>
                            )}
                        </div>
                    )}

                    {/* ── Render Engine ── */}
                    <UnderConstruction>
                        <h3 className="text-[16px] text-text-main font-bold mb-3 mt-6">Render Engine</h3>
                        <div className="flex flex-col gap-3 mb-6">
                            <div className="bg-bg-item/50 rounded-[16px] px-5 py-4 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-bold text-[16px] text-text-main">Engine</span>
                                        <span className="text-text-main/60 text-[12px]">Realtime uses Three.js. Eevee & Cycles use Blender.</span>
                                    </div>
                                    <div className="flex justify-end">
                                        <SegmentedControl
                                            options={['Realtime', 'Eevee', 'Cycles']}
                                            value={exportEngine.charAt(0).toUpperCase() + exportEngine.slice(1)}
                                            onChange={(val) => setExportEngine(val.toLowerCase() as any)}
                                        />
                                    </div>
                                </div>

                                {/* Blender availability indicator */}
                                <div className="flex items-center gap-2 text-[11px]">
                                    {blenderChecking ? (
                                        <span className="text-text-muted">Detecting Blender…</span>
                                    ) : blenderStatus?.available ? (
                                        <>
                                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                            <span className="text-text-muted truncate">
                                                {blenderStatus.version} — {blenderStatus.path}
                                            </span>
                                            <button
                                                onClick={checkBlender}
                                                className="ml-auto text-text-muted hover:text-text-main shrink-0"
                                            >
                                                ↻
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                            <span className="text-text-muted">
                                                Blender not found — install Blender 4.x/5.x (Steam or standalone)
                                            </span>
                                            <button
                                                onClick={checkBlender}
                                                className="ml-auto text-text-muted hover:text-text-main shrink-0"
                                            >
                                                ↻
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </UnderConstruction>

                    <div className="mt-auto pt-6">
                        {isBlenderEngine ? (
                            isBlenderRunning ? (
                                <Button variant="accent" className="w-full py-3 bg-bg-item border-bg-border text-text-main" onClick={handleCancelBlender}>
                                    Cancel Blender Render
                                </Button>
                            ) : (
                                <Button
                                    variant="accent"
                                    className="w-full py-3"
                                    onClick={handleStartBlenderRender}
                                    disabled={!blenderStatus?.available || !activeProjectId}
                                >
                                    {blenderJobStatus === 'done' ? 'Re-render with Blender' : 'Render with Blender'}
                                </Button>
                            )
                        ) : isExporting ? (
                            <Button variant="accent" className="w-full py-3 bg-bg-item border-bg-border text-text-main" onClick={() => useStore.getState().setIsExporting(false)}>
                                Cancel Export
                            </Button>
                        ) : (
                            <Button variant="accent" className="w-full py-3" onClick={startExportPipeline}>
                                Begin Export
                            </Button>)}
                    </div>
                </div>

                {/* RIGHT PANEL: Preview */}
                <div className="flex-[75] bg-bg border border-bg-border rounded-[15px] p-[20px] flex flex-col">
                    <h2 className="text-[16px] text-item-border font-bold mb-4">Export preview</h2>

                    <div id="export-preview-slot" className="flex-1 bg-black rounded-[12px] overflow-hidden relative">
                        {/* Canvas will be teleported here */}
                    </div>

                    <ProgressBar
                        progress={
                            isBlenderEngine
                                ? blenderProgress
                                : totalFrames > 0
                                    ? (currentFrame / totalFrames) * 100
                                    : 0
                        }
                        className="mt-4"
                    />

                    <div className="text-[12px] text-text-main mt-4 flex flex-col items-center gap-1">
                        {isBlenderEngine ? (
                            <>
                                <span>{blenderStatusLabel() ?? 'Ready'}</span>
                                <span>Engine: {exportEngine.charAt(0).toUpperCase() + exportEngine.slice(1)}</span>
                            </>
                        ) : (
                            <>
                                <span>{exportFilename || 'export'}{exportFormat} - {formatTime(currentFrame)}/{formatTime(totalFrames)}</span>
                                <span>Total frames: {totalFrames}</span>
                                <span>Rendered frames: {isExporting || currentFrame > 0 ? currentFrame + 1 : 0}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
