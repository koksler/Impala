import React, { useEffect, useState } from 'react';
import { useStore, type Toast as ToastInterface } from '../../store';
import { TrashIcon } from '../icons';
import { Button } from './buttons/buttons';

export const Toast: React.FC<{ toast: ToastInterface }> = ({ toast }) => {
    const { removeToast } = useStore();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger entry animation
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleRemove = () => {
        setIsVisible(false);
        setTimeout(() => removeToast(toast.id), 300); // Wait for exit animation
    };

    const getBarColor = () => {
        switch (toast.type) {
            case 'process': return 'bg-accent'; // Orange/Accent
            case 'error': return 'bg-fail';   // Red
            case 'success': return 'bg-done';   // Green
            default: return 'bg-accent';
        }
    };

    return (
        <div 
            className={`
                relative w-[360px] bg-bg rounded-[15px] border border-bg-border overflow-hidden pointer-events-auto
                transition-all duration-300 ease-out transform
                ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
            `}
        >
            <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="text-[16px] font-bold text-text-main truncate">{toast.title}</h4>
                    <p className="text-[14px] text-text-main/60 mt-0.5 line-clamp-2 leading-tight">
                        {toast.message}
                    </p>
                </div>
                
                {toast.type === 'process' && (
                    <Button 
                        variant='icon'
                        onClick={handleRemove}
                    >
                        <TrashIcon className="w-5 h-5" />
                    </Button>
                )}
            </div>

            {/* Bottom Progress Bar */}
            <div className="absolute bottom-0 left-0 w-full h-[4px] bg-gray-100/50">
                <div 
                    className={`h-full transition-all duration-300 ease-in-out ${getBarColor()}`}
                    style={{ 
                        width: toast.type === 'process' ? `${toast.progress || 0}%` : '100%' 
                    }}
                />
            </div>
        </div>
    );
};
