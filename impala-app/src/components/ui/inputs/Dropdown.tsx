import React, { useState, useRef, useEffect } from 'react';

interface DropdownProps {
    value: string;
    options?: string[];
    onChange?: (val: string) => void;
}

export const Dropdown: React.FC<DropdownProps> = ({ value, options = [], onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className="relative inline-block">
            <button 
                className="flex items-center justify-between bg-bg-item rounded-[7px] px-[10px] h-[20px] cursor-pointer hover:bg-bg-item/80 transition-colors w-fit min-w-[100px] outline-none border-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="text-text-main text-[12px] font-sans font-medium select-none leading-none">
                    {value}
                </span>
                <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className={`w-[12px] h-[12px] ml-2 text-text-main transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-max min-w-full bg-bg-item border border-bg-border rounded-[7px] overflow-hidden flex flex-col z-[300]">
                    {options.map((option) => (
                        <div 
                            key={option}
                            className={`px-4 py-2 text-[12px] cursor-pointer transition-colors ${
                                option === value 
                                    ? 'text-accent font-bold bg-bg-border/30' 
                                    : 'text-text-main hover:bg-bg-border'
                            }`}
                            onClick={() => {
                                if (onChange) onChange(option);
                                setIsOpen(false);
                            }}
                        >
                            {option}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
