import React from 'react';

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

interface AxisBlobProps {
    axis: keyof Vector3;
    val: number;
    onChange: (axis: keyof Vector3, value: string) => void;
}

const AxisBlob: React.FC<AxisBlobProps> = ({ axis, val, onChange }) => (
    <div className="flex justify-between items-center bg-bg-item rounded-[7px] py-[2px] px-[6px] flex-1">
        <span className="font-sans text-[12px] text-text-main select-none">
            {axis.toUpperCase()}
        </span>
        <div className="flex items-center justify-end w-full ml-2">
            <input
                type="number"
                value={val}
                onChange={(e) => onChange(axis, e.target.value)}
                className="w-full bg-transparent border-none outline-none text-right font-sans text-[12px] text-text-main focus:ring-0 p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="font-sans text-[12px] text-text-main ml-[2px] select-none">
                m
            </span>
        </div>
    </div>
);

interface Vector3InputProps {
    label: string;
    icon?: React.ReactNode;
    x: number;
    y: number;
    z: number;
    onChange: (values: Vector3) => void;
    className?: string;
}

export const Vector3Input: React.FC<Vector3InputProps> = ({
    label,
    icon,
    x,
    y,
    z,
    onChange,
    className = ''
}) => {
    const handleAxisChange = (axis: keyof Vector3, value: string) => {
        const numValue = parseFloat(value) || 0; 
        onChange({ x, y, z, [axis]: numValue });
    };

    return (
        <div className={`flex flex-col gap-[10px] w-full px-[12px] ${className}`}>
            <div className="flex items-center gap-[6px]">
                <span className="font-sans text-[12px] text-text-main">{label}</span>
                {icon && (
                    <div className="w-[16px] h-[16px] text-text-main flex items-center justify-center shrink-0">
                        {icon}
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-[6px] w-full">
                <AxisBlob axis="x" val={x} onChange={handleAxisChange} />
                <AxisBlob axis="y" val={y} onChange={handleAxisChange} />
                <AxisBlob axis="z" val={z} onChange={handleAxisChange} />
            </div>
        </div>
    );
};