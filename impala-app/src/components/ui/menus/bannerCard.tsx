import React from 'react';

interface BannerCardProps {
    title: React.ReactNode;
    subtitle: string;
    imageSrc: string;
    buttons: React.ReactNode;
}

export const BannerCard: React.FC<BannerCardProps> = ({ title, subtitle, imageSrc, buttons }) => {
    return (
        <div className="flex flex-1 w-full border border-bg-border rounded-[15px] bg-bg overflow-hidden">            
            <div className="flex-1 flex flex-col justify-center px-[clamp(1.5rem,4vw,3.75rem)]">
                <h2 className="text-[clamp(1.75rem,2.5vw,3rem)] text-text-accent font-bold leading-[1.1] tracking-tight m-0">
                    {title}
                </h2>
                
                <p className="text-base text-item-border mt-5 mb-10 max-w-[25rem]">
                    {subtitle}
                </p>
                
                <div className="flex flex-wrap items-center gap-2.5">
                    {buttons}
                </div>
            </div>

            <div className="flex-none aspect-square h-full bg-[#161616]">
                <img src={imageSrc} alt="Banner graphic" className="w-full h-full object-cover object-center select-none" draggable="false" />
            </div>
        </div>
    );
};