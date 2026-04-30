import React from 'react';

interface SliderProps {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
    onPointerUp?: () => void;
    /** Show tick marks at each step interval */
    showTicks?: boolean;
    className?: string;
}

export const Slider: React.FC<SliderProps> = ({
    label,
    value,
    min = 0,
    max = 1,
    step = 0.01,
    onChange,
    onPointerUp,
    showTicks = false,
    className = ''
}) => {
    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

    // Generate tick positions (exclude first and last to avoid edge clutter)
    const ticks = React.useMemo(() => {
        if (!showTicks || step <= 0) return [];
        const count = Math.round((max - min) / step);
        const result: number[] = [];
        for (let i = 1; i < count; i++) {
            result.push((i / count) * 100);
        }
        return result;
    }, [showTicks, min, max, step]);

    return (
        <div className={`relative w-full py-0.5 bg-bg-item rounded-[7px] overflow-hidden flex items-center ${className}`}>

            {/* Fill track */}
            <div
                className="absolute left-0 top-0 bottom-0 bg-text-main/15 pointer-events-none"
                style={{ width: `${percentage}%` }}
            />

            {/* Tick marks */}
            {ticks.map((pos) => (
                <div
                    key={pos}
                    className="absolute top-[20%] bottom-[20%] w-px pointer-events-none"
                    style={{
                        left: `${pos}%`,
                        background: pos < percentage
                            ? 'rgba(255,255,255,0.25)'   // inside fill — lighter
                            : 'rgba(255,255,255,0.12)',  // outside fill — subtler
                    }}
                />
            ))}

            {/* Invisible native range input for interaction */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                onPointerUp={onPointerUp}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize m-0 p-0"
            />

            {/* Label + value */}
            <div className="relative z-10 flex justify-between w-full px-[12px] pointer-events-none">
                <span className="font-sans text-[12px] text-text-main select-none">
                    {label}
                </span>
                <span className="font-sans text-[12px] text-text-main select-none">
                    {value}
                </span>
            </div>

        </div>
    );
};