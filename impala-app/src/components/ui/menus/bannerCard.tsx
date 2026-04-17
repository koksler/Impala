import React from 'react';

interface BannerCardProps {
    title: React.ReactNode;
    subtitle: string;
    imageSrc: string;
    buttons: React.ReactNode;
}

export const BannerCard: React.FC<BannerCardProps> = ({ title, subtitle, imageSrc, buttons }) => {
    return (
        <div className="flex flex-1 w-full border border-text-main rounded-[15px] bg-bg overflow-hidden">            
            <div className="flex-1 flex flex-col justify-center px-[60px]">
                <h2 className="text-[clamp(1.75rem,2.5vw,3rem)] text-text-accent font-bold leading-[1.1] tracking-tight m-0">
                    {title}
                </h2>
                
                <p className="text-[1rem] text-item-border mt-[20px] mb-[40px] max-w-[400px]">
                    {subtitle}
                </p>
                
                <div className="flex flex-wrap items-center gap-[10px]">
                    {buttons}
                </div>
            </div>

            <div className="flex items-center justify-center w-[40%] h-full bg-[#161616]">
                <img src={imageSrc} alt="Banner graphic" className="w-full h-full object-none object-center" />
            </div>
        </div>
    );
};