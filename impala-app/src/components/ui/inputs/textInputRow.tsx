import React from 'react';

interface TextInputRowProps {
    label: string;
    value: string;
    onChange?: (val: string) => void;
    className?: string;
    readOnly?: boolean;
}

export const TextInputRow: React.FC<TextInputRowProps> = ({ 
    label, 
    value, 
    onChange, 
    className = '',
    readOnly = false
}) => {
    return (
        <div className={`flex items-center justify-between bg-bg-item rounded-[7px] px-3 h-[20px] ${className}`}>
            <span className="text-[12px] font-medium text-text-main select-none">
                {label}
            </span>
            <input 
                type="text" 
                value={value} 
                onChange={(e) => onChange?.(e.target.value)}
                readOnly={readOnly}
                className="bg-transparent border-none outline-none text-right text-[12px] font-bold text-text-main"
            />
        </div>
    );
};