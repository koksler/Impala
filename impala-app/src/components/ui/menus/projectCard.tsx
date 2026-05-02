import React from 'react';
import { TrashIcon } from '../../icons/index';
import { Button } from '../buttons/buttons';

interface ProjectCardProps {
    title: string;
    date: string;
    imageSrc: string;
    onOpen: () => void;
    onDelete: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ title, date, imageSrc, onOpen, onDelete }) => {
    return (
        <div 
            onClick={onOpen}
            className="flex flex-col h-[150px] border border-bg-border rounded-[15px] overflow-hidden cursor-pointer bg-bg select-none transition-all hover:border-accent group"
        >
            <div className="h-full w-full bg-bg-item overflow-hidden">
                <img src={imageSrc} alt={title} className="w-full h-full object-cover pointer-events-none" />
            </div>
            
            <div className="p-[12px] flex justify-between items-start">
                <div className="flex flex-col gap-[4px]">
                    <span className="font-bold text-[12px] text-text-main">{title}</span>
                    <span className="text-[12px] text-item-border">{date}</span>
                </div>
                <Button variant = 'misc' 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className='mt-auto mb-auto mr-2'
                >
                    <TrashIcon className="text-text-main" />
                </Button>

            </div>
        </div>
    );
};