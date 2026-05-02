import React from 'react';
import { useStore } from '../../store';
import { ImpalaLogoIcon } from '../icons';


export const InitialLoader: React.FC = () => {
    const { isAppLoading } = useStore();

    if (!isAppLoading) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-bg flex flex-col items-center justify-center p-8 transition-opacity duration-500">
            <div className="w-full max-w-[400px] flex flex-col items-center gap-8">
                <div className="w-[120px] h-[120px] text-text-main">
                    <ImpalaLogoIcon className="w-full h-full" />
                </div>

                <div className="w-full space-y-3">
                    <div className="flex justify-between text-[14px] text-text-main font-medium">
                        <span>Loading...</span>
                        <span>Please wait up</span>
                    </div>
                    <div className="w-full h-[6px] bg-bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-accent animate-load-slow" style={{ width: '100%' }} />
                    </div>
                    <p className="text-[12px] text-item-border text-center">
                        Checking on the backend and saved stuff
                    </p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes load-slow {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0); }
                    100% { transform: translateX(100%); }
                }
                .animate-load-slow {
                    animation: load-slow 2s infinite ease-in-out;
                }
            `}} />
        </div>
    );
};
