import React, { useEffect } from 'react';
import { useStore } from '../../../store';
import { SegmentedControl } from '../inputs/SegmentedControl';
import { Dropdown } from '../inputs/Dropdown';
import { Toggle } from '../inputs/Toggle';
import { Slider } from '../inputs/slider';
import { Button } from '../buttons/buttons';
import { TextInputRow } from '../inputs/textInputRow';
import { UnderConstruction } from '../UnderConstruction';


import {
    TrashIcon,
    LightThemeIcon,
    DarkThemeIcon,
    SystemThemeIcon,
    MinimizeIcon,
    UndoIcon
} from '../../icons/index';

export const SettingsModal: React.FC = () => {
    const {
        setIsSettingsOpen,
        isSettingsOpen,
        settingsTab,
        setSettingsTab,
        colorScheme,
        setColorScheme,
        primaryColor,
        setPrimaryColor,
        framerateLimit,
        setFramerateLimit,
        uiScale,
        setUiScale,
        shadowResolution,
        setShadowResolution,
        autosave,
        setAutosave,
        maxIterations,
        setMaxIterations,
        autoCrop,
        setAutoCrop,
        backendUrl,
        setBackendUrl,
        language,
        setLanguage,
        cameraPreset,
        setCameraPreset,
        addToast,
        updateToast,
    } = useStore();

    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        if (isSettingsOpen) {
            const timer = setTimeout(() => setIsVisible(true), 10);
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setIsSettingsOpen(false);
            };
            window.addEventListener('keydown', handleEsc);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('keydown', handleEsc);
            };
        } else {
            setIsVisible(false);
        }
    }, [isSettingsOpen, setIsSettingsOpen]);

    if (!isSettingsOpen) return null;

    const handleCleanCache = async () => {
        const toastId = addToast('Cleaning Cache', 'Removing temporary files...', 'process');
        try {
            const res = await fetch(`${backendUrl}/api/cache/clear`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to clean cache');
            const data = await res.json();
            updateToast(toastId, {
                type: 'success',
                title: 'Cache Cleaned',
                message: `Removed ${data.deleted_files} files (${(data.deleted_bytes / 1024 / 1024).toFixed(2)} MB)`,
            });
        } catch (err) {
            updateToast(toastId, { type: 'error', title: 'Cleanup Failed', message: 'Could not connect to server.' });
        }
    };

    const handlePurgeOrphans = async () => {
        const toastId = addToast('Purging Orphans', 'Scanning for abandoned projects...', 'process');
        try {
            const res = await fetch(`${backendUrl}/api/projects/cleanup`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to purge orphans');
            const data = await res.json();
            updateToast(toastId, {
                type: 'success',
                title: 'Orphans Purged',
                message: `Successfully deleted ${data.deleted_files} orphaned folders.`,
            });
        } catch (err) {
            updateToast(toastId, { type: 'error', title: 'Purge Failed', message: 'Could not connect to server.' });
        }
    };

    const tabs = ['General', 'Generation', 'Remote Server', 'Cache settings', 'Language and Input'];

    const renderTabContent = () => {
        switch (settingsTab) {
            case 'General':
                return (
                    <div className="flex flex-col gap-4">
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center gap-4">
                            <div className="flex flex-col gap-1 min-w-[140px]">
                                <span className="font-bold text-[16px] text-text-main whitespace-nowrap">Color Scheme</span>
                                <span className="text-text-main/60 text-[12px]">Overall colors of the application.</span>
                            </div>

                            <div className="flex gap-3 sm:gap-4">
                                <div className={`flex flex-col items-center gap-2 cursor-pointer transition-opacity ${colorScheme === 'Light' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`} onClick={() => setColorScheme('Light')}>
                                    <div className="w-[135px] aspect-[171/97]">
                                        <LightThemeIcon className="w-full h-full block" />
                                    </div>
                                    <span className="text-[12px] text-text-main">Light</span>
                                </div>

                                <div className={`flex flex-col items-center gap-2 cursor-pointer transition-opacity ${colorScheme === 'Dark' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`} onClick={() => setColorScheme('Dark')}>
                                    <div className="w-[135px] aspect-[171/97]">
                                        <DarkThemeIcon className="w-full h-full block" />
                                    </div>
                                    <span className="text-[12px] text-text-main">Dark</span>
                                </div>

                                <div className={`flex flex-col items-center gap-2 cursor-pointer transition-opacity ${colorScheme === 'System' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`} onClick={() => setColorScheme('System')}>
                                    <div className="w-[135px] aspect-[171/97]">
                                        <SystemThemeIcon className="w-full h-full block" />
                                    </div>
                                    <span className="text-[12px] text-text-main">System</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Primary Color</span>
                                <span className="text-text-main/60 text-[12px]">Accent color throughout whole UI.</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    variant="misc"
                                    onClick={() => setPrimaryColor('#FF763B')}
                                    title="Revert to default"
                                    className="opacity-60 hover:opacity-100"
                                >
                                    <UndoIcon className="text-text-main" />
                                </Button>

                                <div className="bg-accent rounded-[12px] flex items-center justify-center w-[250px] px-1.5 py-4">
                                    <TextInputRow
                                        label="Color"
                                        value={primaryColor}
                                        onChange={(v) => {
                                            let val = v.startsWith('#') ? v : '#' + v;
                                            if (val.length <= 7) setPrimaryColor(val);
                                        }}
                                        className='w-full'
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Viewport Framerate Limit</span>
                                <span className="text-text-main/60 text-[12px]">Choose lower framerate if you care about your battery.</span>
                            </div>
                            <div className="flex justify-end">
                                <SegmentedControl
                                    options={['30 FPS', '60 FPS', 'Unlimited']}
                                    value={framerateLimit}
                                    onChange={setFramerateLimit}
                                />
                            </div>
                        </div>



                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Shadow Resolution</span>
                                <span className="text-text-main/60 text-[12px]">Adjust shadow quality. Higher values may reduce performance.</span>
                            </div>
                            <div className="w-[200px] flex justify-end">
                                <Dropdown
                                    options={['256', '512', '1024', '2048', '4096']}
                                    value={String(shadowResolution)}
                                    onChange={(v) => setShadowResolution(Number(v))}
                                />
                            </div>
                        </div>

                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Autosave</span>
                                <span className="text-text-main/60 text-[12px]">If on that'll save it every 5 minutes.</span>
                            </div>
                            <div className="flex justify-end">
                                <Toggle checked={autosave} onChange={setAutosave} activeColor="accent" />
                            </div>
                        </div>
                    </div>
                );
            case 'Generation':
                return (
                    <div className="flex flex-col gap-4">
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Max Iterations</span>
                                <span className="text-text-main/60 text-[12px]">Higher values produce sharper splats but take longer to bake.</span>
                            </div>
                            <div className="w-[340px] flex justify-end">
                                <Slider
                                    label="Splat Iterations"
                                    value={maxIterations}
                                    min={5000}
                                    max={30000}
                                    step={1000}
                                    onChange={setMaxIterations}
                                />
                            </div>
                        </div>

                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Auto-Crop distant splat parts</span>
                                <span className="text-text-main/60 text-[12px]">Experimental, could affect occlusion effects.</span>
                            </div>
                            <div className="flex justify-end">
                                <Toggle checked={autoCrop} onChange={setAutoCrop} activeColor="black" />
                            </div>
                        </div>
                    </div>
                );
            case 'Remote Server':
                return (
                    <div className="flex flex-col gap-4">
                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Backend URL</span>
                                <span className="text-text-main/60 text-[12px]">Ensure you have connection to said URL.</span>
                            </div>
                            <div className="flex justify-end">
                                <TextInputRow
                                    label="URL"
                                    value={backendUrl}
                                    onChange={setBackendUrl}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-2 mt-2">
                            <span className="font-bold text-[16px] text-text-main">Server Status: Online</span>
                            <div className="w-3 h-3 rounded-full bg-done" />
                        </div>
                    </div>
                );
            case 'Cache settings':
                return (
                    <div className="flex flex-col gap-4">
                        <div className="bg-bg-item/50 rounded-[16px] pl-5 pr-5 pt-3 pb-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Clear Temporary Files</span>
                                <span className="text-text-main/60 text-[12px]">Clear up space by removing unnecessary files.</span>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleCleanCache} variant="full" className="bg-text-main text-bg h-[40px] px-6 !rounded-[15px] flex items-center gap-2">
                                    <TrashIcon className="w-5 h-5" />
                                    <span>Clean Cache</span>
                                </Button>
                            </div>
                        </div>

                        <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-[16px] text-text-main">Delete Orphaned Projects</span>
                                <span className="text-text-main/60 text-[12px]">Purge projects that are not in projects.json.</span>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handlePurgeOrphans} variant="full" className="bg-text-main text-bg h-[40px] px-6 !rounded-[15px] flex items-center gap-2">
                                    <TrashIcon className="w-5 h-5" />
                                    <span>Purge orphans {'>'}:)</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            case 'Language and Input':
                return (
                    <div className="flex flex-col gap-4">
                        <UnderConstruction>
                            <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                    <span className="font-bold text-[16px] text-text-main">Language</span>
                                    <span className="text-text-main/60 text-[12px]">Just select a language, nothing special.</span>
                                </div>
                                <div className="w-[200px] flex justify-end">
                                    <Dropdown
                                        options={['English', 'Russian']}
                                        value={language}
                                        onChange={setLanguage}
                                    />
                                </div>
                            </div>
                        </UnderConstruction>

                        <UnderConstruction>
                            <div className="bg-bg-item/50 rounded-[16px] px-5 py-3 flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                    <span className="font-bold text-[16px] text-text-main">Camera Controls Preset</span>
                                    <span className="text-text-main/60 text-[12px]">If you fancy different controls.</span>
                                </div>
                                <div className="w-[200px] flex justify-end">
                                    <Dropdown
                                        options={['Impala Default', 'Blender', 'Maya']}
                                        value={cameraPreset}
                                        onChange={setCameraPreset}
                                    />
                                </div>
                            </div>
                        </UnderConstruction>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div
            className={`fixed inset-0 z-[100] bg-black/60 flex items-center justify-center transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsSettingsOpen(false)}
        >
            <div
                className={`bg-bg border border-bg-border rounded-[15px] overflow-hidden flex w-[1100px] h-[700px] transition-all duration-100 ease-out transform ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* LEFT SIDEBAR */}
                <div className="w-[250px] bg-bg-item flex flex-col h-full border-r border-item-border/10">
                    <header className="p-6 pb-4">
                        <h1 className="text-item-border font-bold text-[16px] select-none">Settings</h1>
                    </header>

                    <nav className="flex-1 flex flex-col gap-1 px-2">
                        {tabs.map((tab) => (
                            <div
                                key={tab}
                                onClick={() => setSettingsTab(tab)}
                                className={`px-4 py-2.5 rounded-xl cursor-pointer select-none transition-colors text-[16px]
                                    ${settingsTab === tab
                                        ? 'bg-black/10 text-text-main font-normal'
                                        : 'text-text-main/70 font-normal hover:bg-bg-item/50'
                                    }`}
                            >
                                {tab}
                            </div>
                        ))}
                    </nav>
                </div>

                {/* RIGHT CONTENT */}
                <div className="flex-1 flex flex-col h-full bg-bg">
                    <header className="p-6 flex justify-between items-center shrink-0">
                        <h2 className="font-bold text-[16px] text-text-main">
                            {settingsTab === 'Language and Input' ? 'Language and Input settings' :
                                settingsTab === 'Remote Server' ? 'Remote Server settings [EXPERIMENTAL]' :
                                    settingsTab === 'Generation' ? 'Generation settings' :
                                        settingsTab}
                        </h2>
                        <Button
                            variant="icon"
                            onClick={() => setIsSettingsOpen(false)}
                        >
                            <MinimizeIcon className="text-text-main" />
                        </Button>
                    </header>

                    <main className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-hide">
                        {renderTabContent()}
                    </main>
                </div>
            </div>
        </div>
    );
};