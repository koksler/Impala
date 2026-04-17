import React from 'react';

interface SegmentedControlProps {
    options: string[];
    value: string;
    onChange: (val: string) => void;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange }) => {
    return (
        <div className="flex items-center h-[20px] bg-bg-item rounded-[7px] px-[10px] py-[2px] w-fit">
            {options.map((option, index) => (
                <React.Fragment key={option}>
                    <button
                        onClick={() => onChange(option)}
                        className={`px-[8px] transition-all cursor-pointer select-none font-sans text-[12px] leading-none h-full flex items-center
                            ${value === option 
                                ? 'text-text-main font-semibold' 
                                : 'text-item-border font-normal hover:text-text-main/60'
                            }`}
                    >
                        {option}
                    </button>
                    {index < options.length - 1 && (
                        <div className="w-[1px] h-[10px] bg-item-border" />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};
