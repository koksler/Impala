import React, { useState, useEffect } from 'react';
import { BannerCard } from './bannerCard';
import { SearchBar } from '../inputs/searchBar';
import { ProjectCard } from './projectCard';
import { Button } from '../buttons/buttons';
import { UploadModal } from './uploadModal';
import { Tooltip } from '../Tooltip';
import { ConfirmationModal } from '../ConfirmationModal';
import { ImportModal } from './importModal';
import { LinkAssetModal } from './linkAssetModal';
import { useStore } from '../../../store';

export interface Project {
    id: string;
    title: string;
    lastOpened: string;
    img: string;
    splat_url: string;
    transforms_url: string;
    proxy_url?: string;
    dataparser_transforms_url?: string;
    video_url?: string;
    cameras_url?: string;
}

export const HomePage: React.FC<{ onOpenProject: (project: Project) => void }> = ({ onOpenProject }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [projectToOpen, setProjectToOpen] = useState<Project | null>(null);

    const { addToast, backendUrl } = useStore();

    useEffect(() => {
        fetch(`${backendUrl}/api/projects`)
            .then(res => res.json())
            .then((data: Project[]) => {
                setProjects(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load projects:', err);
                setLoading(false);
            });
    }, []);

    const handleProjectSuccess = (newProject: Project) => {
        setIsModalOpen(false);
        setIsImportModalOpen(false);
        setIsLinkModalOpen(false);
        setProjects(prev => [newProject, ...prev]);
        onOpenProject(newProject);
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (diff === 0) return 'Last opened: Today';
        if (diff === 1) return 'Last opened: Yesterday';
        return `Last opened: ${diff} days ago`;
    };

    const handleDelete = async () => {
        if (!projectToDelete) return;

        try {
            const res = await fetch(`${backendUrl}/api/projects/${projectToDelete.id}`, { method: 'DELETE' });
            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
                addToast('Project Deleted', `Successfully removed "${projectToDelete.title}"`, 'success');
            } else {
                throw new Error('Failed to delete');
            }
        } catch (err) {
            console.error(err);
            addToast('Delete Failed', 'Could not delete the project. Is the server running?', 'error');
        } finally {
            setProjectToDelete(null);
        }
    };


    return (
        <div className="relative w-full h-full flex items-stretch p-[20px] gap-[20px] bg-bg overflow-hidden">
            {/* Background Darkening Layer */}
            <div className="absolute inset-0 bg-black/8 pointer-events-none z-0" />


            <UploadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleProjectSuccess}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={handleProjectSuccess}
            />

            <LinkAssetModal
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                onSuccess={handleProjectSuccess}
            />

            <ConfirmationModal
                isOpen={!!projectToDelete || !!projectToOpen}
                title={projectToDelete ? "Delete Project" : "Open Project"}
                message={projectToDelete
                    ? `Are you sure you want to permanently delete "${projectToDelete?.title}"? This cannot be undone.`
                    : `Do you want to open "${projectToOpen?.title}" and continue editing?`
                }
                confirmLabel={projectToDelete ? "Delete" : "Open"}
                onConfirm={() => {
                    if (projectToDelete) {
                        handleDelete();
                    } else if (projectToOpen) {
                        onOpenProject(projectToOpen);
                        setProjectToOpen(null);
                    }
                }}
                onCancel={() => {
                    setProjectToDelete(null);
                    setProjectToOpen(null);
                }}
                variant={projectToDelete ? "danger" : "warning"}
            />


            <div className="relative z-10 flex flex-col gap-[20px] flex-1">
                <BannerCard
                    title={
                        <>Generate a <span className="text-accent">new scene</span><br />from image or video</>
                    }
                    subtitle="A local model will render a gaussian splatting scene for your 3D objects."
                    imageSrc="/banners/coil.png"
                    buttons={
                        <>
                            <Tooltip content="Upload media file" position="top">
                                <Button variant="accent" onClick={() => setIsModalOpen(true)}>
                                    Load an image or a video
                                </Button>
                            </Tooltip>
                            <Tooltip content="Provide URL or external link" position="top">
                                <Button variant="menu-misc" onClick={() => setIsLinkModalOpen(true)}>
                                    Link an external asset
                                </Button>
                            </Tooltip>
                        </>
                    }
                />

                <BannerCard
                    title={
                        <>Create from <span className="text-accent">existing</span><br />gaussian splatting file</>
                    }
                    subtitle="A new project with the prerendered scene will be created."
                    imageSrc="/banners/abstract.png"
                    buttons={
                        <Tooltip content="Upload .ply file" position="top">
                            <Button variant="accent" onClick={() => setIsImportModalOpen(true)}>
                                Load a gaussian splatting scene
                            </Button>
                        </Tooltip>
                    }
                />
            </div>

            <div className="relative z-10 flex-[0.35] h-full border border-bg-border rounded-[15px] px-[20px] py-[30px] flex flex-col bg-bg">

                <h1 className="font-bold text-[1.5rem] text-text-accent text-center m-0 mb-5">
                    Recent Projects
                </h1>

                <div className="mb-5">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>

                <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-1 min-h-0 pr-2 pb-4 content-start">
                    {loading ? (
                        <p className="col-span-2 text-center text-text-main opacity-50 text-[12px] py-10">Loading projects…</p>
                    ) : (() => {
                        const filtered = projects.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

                        if (projects.length === 0) {
                            return <p className="col-span-2 text-center text-text-main opacity-40 text-[12px] py-10">No projects yet.</p>;
                        }

                        if (filtered.length === 0) {
                            return <p className="col-span-2 text-center text-text-main opacity-40 text-[12px] py-10">No projects match your search.</p>;
                        }

                        return filtered.map(project => (
                            <ProjectCard
                                key={project.id}
                                title={project.title}
                                date={formatDate(project.lastOpened)}
                                imageSrc={project.img}
                                onOpen={() => setProjectToOpen(project)}
                                onDelete={() => setProjectToDelete(project)}
                            />
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};