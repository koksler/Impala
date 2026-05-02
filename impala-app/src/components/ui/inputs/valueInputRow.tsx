import React from 'react';

interface ValueInputRowProps {
    label: string;
    value: string | number;
    unit?: string;
    step?: number;
    onChange: (value: string) => void;
    onFinishChange?: () => void;
    className?: string;
}

export const ValueInputRow: React.FC<ValueInputRowProps> = ({
    label,
    value,
    unit = '',
    step = 1,
    onChange,
    onFinishChange,
    className = ''
}) => {
    return (
        <div className={`w-full py-0.5 bg-bg-item rounded-[7px] flex items-center justify-between px-[12px] ${className}`}>
            <span className="font-sans text-[12px] text-text-main select-none shrink-0">
                {label}
            </span>
            <div className="flex items-center justify-end w-full ml-4">
                <input
                    type="number"
                    step={step}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onFinishChange}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    className="w-full bg-transparent border-none outline-none text-right font-sans text-[12px] text-text-main focus:ring-0 p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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