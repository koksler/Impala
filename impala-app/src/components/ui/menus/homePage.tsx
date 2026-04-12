import React, { useState, useEffect } from 'react';
import { BannerCard } from './bannerCard';
import { SearchBar } from '../inputs/searchBar';
import { ProjectCard } from './projectCard';
import { Button } from '../buttons/buttons';
import { UploadModal } from './uploadModal';
import { Tooltip } from '../Tooltip';

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

     useEffect(() => {
        fetch('/api/projects')
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

    return (
        <div className="w-full h-full flex justify-center items-stretch p-[20px] gap-[20px] bg-bg pb-[40px] overflow-hidden">

            <UploadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleProjectSuccess}
            />

            <div className="flex flex-col gap-[20px] flex-1 max-w-[1208px]">
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
                                <Button variant="menu-misc">
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
                            <Button variant="accent">
                                Load a gaussian splatting scene
                            </Button>
                        </Tooltip>
                    }
                />
            </div>

            <div className="flex-[0.35] h-full border border-text-main rounded-[15px] px-[20px] py-[30px] flex flex-col bg-bg">

                <h1 className="font-bold text-[24px] text-text-accent text-center m-0 mb-[20px]">
                    Your previous projects
                </h1>

                <div className="mb-[20px]">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>

                <div className="grid grid-cols-2 gap-[16px] overflow-y-auto flex-1 min-h-0 pr-2 pb-4 content-start">
                    {loading ? (
                        <p className="col-span-2 text-center text-text-main opacity-50">Loading projects…</p>
                    ) : (
                        projects
                            .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(project => (
                                <ProjectCard
                                    key={project.id}
                                    title={project.title}
                                    date={formatDate(project.lastOpened)}
                                    imageSrc={project.img}
                                    onOpen={() => onOpenProject(project)}
                                    onDelete={() => console.log('Delete', project.id)}
                                />
                            ))
                    )}
                </div>
            </div>
        </div>
    );
};