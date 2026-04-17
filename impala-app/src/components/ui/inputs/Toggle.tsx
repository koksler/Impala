import React from 'react';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    activeColor?: 'accent' | 'black';
}

export const Toggle: React.FC<ToggleProps> = ({ 
    checked, 
    onChange, 
    activeColor = 'accent' 
}) => {
    // Thumb color: black when unchecked, activeColor (accent or black) when checked
    const thumbColor = checked 
        ? (activeColor === 'accent' ? 'bg-accent' : 'bg-text-main') 
        : 'bg-text-main';

    return (
        <div 
            onClick={() => onChange(!checked)}
            className="w-[40px] h-[19px] bg-bg-item rounded-[7px] relative cursor-pointer transition-colors group"
        >
            <div 
                className={`absolute top-[2px] left-0 w-[20px] h-[15px] rounded-[5px] transition-transform duration-200 ease-in-out
                    ${checked ? 'translate-x-[17px]' : 'translate-x-[2px]'}
                    ${thumbColor}
                `}
            />
        </div>
    );
};
