import React from 'react';

interface ValueInputRowProps {
    label: string;
    value: string | number;
    unit?: string;
    onChange: (value: string) => void;
    className?: string;
}

export const ValueInputRow: React.FC<ValueInputRowProps> = ({
    label,
    value,
    unit = '',
    onChange,
    className = ''
}) => {
    return (
        <div className={`w-full py-0.5 bg-bg-item rounded-[7px] flex items-center justify-between px-[12px] ${className}`}>
            <span className="font-sans text-[12px] text-text-main select-none shrink-0">
                {label}
            </span>
            <div className="flex items-center justify-end w-full ml-4">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-right font-sans text-[12px] text-text-main focus:ring-0 p-0 m-0"
                />
                {unit && (
                    <span className="font-sans text-[12px] text-text-main ml-[2px] select-none shrink-0">
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
};