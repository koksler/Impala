import React, { useState, useEffect, useRef } from 'react';
import { BannerCard } from './bannerCard';
import { SearchBar } from '../inputs/searchBar';
import { ProjectCard } from './projectCard';
import { Button } from '../buttons/buttons';

export interface Project {
    id: number;
    title: string;
    lastOpened: string;
    img: string;
}

export const HomePage: React.FC<{ onOpenProject: (project: Project) => void }> = ({ onOpenProject }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/projects.json')
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

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (diff === 0) return 'Last opened: Today';
        if (diff === 1) return 'Last opened: Yesterday';
        return `Last opened: ${diff} days ago`;
    };

    const handleProcessVideo = async () => {
        console.log("Sending request to backend");
        
        try {
            const response = await fetch("http://localhost:8000/api/process-video", {
                method: "POST"
            });
            
            const data = await response.json();
            console.log("Backend:", data);
            
            alert(`Success: ${data.message}`);
            
        } catch (error) {
            console.error("Backend has died tragically", error);
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        console.log("File selected:", file.name, "Size:", (file.size / 1024 / 1024).toFixed(2), "MB");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("http://localhost:8000/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            console.log("Ответ сервера:", data);
            
            alert(`Success. File ${data.filename} on backend.`);
            
            // onOpenProject(); 

        } catch (error) {
            console.error("Error on load", error);
            alert("Backend not responding");
        }
    };

    return (
        <div className="w-full h-full flex justify-center items-stretch pt-[20px] px-[20px] gap-[20px] bg-bg pb-[40px] overflow-hidden">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept="video/mp4,video/webm,image/jpeg,image/png" 
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
                            <Button variant="accent" onClick={() => fileInputRef.current?.click()}>
                                Load an image or a video
                            </Button>
                            <Button variant="menu-misc">
                                Link an external asset
                            </Button>
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
                        <Button variant="accent">
                            Load a gaussian splatting scene
                        </Button>
                    }
                />
            </div>

            <div className="w-full max-w-[655px] h-full border border-text-main rounded-[15px] px-[20px] py-[30px] flex flex-col bg-bg shrink-0">

                <h1 className="font-bold text-[36px] text-text-accent text-center m-0 mb-[20px]">
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
