import React, { useEffect, useState } from 'react';
import { Button } from './buttons/buttons';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'info' | 'warning';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger'
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setIsVisible(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-black/60 transition-opacity duration-300 pointer-events-auto ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={onCancel}
            />

            {/* Modal Body (Based on Toast) */}
            <div 
                className={`
                    relative w-[360px] bg-bg rounded-[15px] shadow-2xl border border-item-border/10 overflow-hidden pointer-events-auto
                    transition-all duration-300 ease-out transform
                    ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
                `}
            >
                <div className="p-5 flex flex-col gap-4">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-[17px] font-bold text-text-main leading-tight">{title}</h4>
                        <p className="text-[14px] text-item-border mt-1 leading-normal">
                            {message}
                        </p>
                    </div>
                    
                    <div className="flex gap-2.5 mt-2">
                        <Button 
                            variant="menu-misc" 
                            onClick={onCancel}
                            className="flex-1 px-4 !h-9"
                        >
                            {cancelLabel}
                        </Button>
                        <Button 
                            variant="accent" 
                            onClick={onConfirm}
                            className={`flex-1 px-4 !h-9 ${
                                variant === 'danger' ? 'bg-fail border-fail text-white' : 
                                variant === 'warning' ? 'bg-process border-process text-white' : ''
                            }`}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>

                {/* Bottom Accent Line (Mirrors Toast Progress Bar) */}
                <div className={`absolute bottom-0 left-0 w-full h-[4px] ${
                    variant === 'danger' ? 'bg-fail' : 
                    variant === 'warning' ? 'bg-process' : 'bg-accent'
                }`} />
            </div>
        </div>
    );
};
