import React from 'react';
import { useStore } from '../../store';
import { Toast } from './Toast';

export const ToastContainer: React.FC = () => {
    const { toasts } = useStore();

    return (
        <div className="fixed top-[75px] left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} />
            ))}
        </div>
    );
};
