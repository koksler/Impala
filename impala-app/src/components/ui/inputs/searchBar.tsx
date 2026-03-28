import React from 'react';
import { SearchIcon } from '../../icons/index';

interface SearchBarProps {
    placeholder?: string;
    value: string;
    onChange: (val: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ placeholder = "Look for them here", value, onChange }) => {
    return (
        <div className="relative w-[90%] m-auto">
            <input 
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-bg-item border border-item-border rounded-lg pl-[16px] pr-[40px] py-[10px] text-[14px] text-text-main placeholder-item-border outline-none focus:border-accent transition-colors"
            />
            <SearchIcon className="absolute right-[12px] top-1/2 -translate-y-1/2 w-5 h-5 text-text-main" />
        </div>
    );
};