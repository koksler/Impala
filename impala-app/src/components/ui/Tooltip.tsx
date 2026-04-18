import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  hotkey?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ 
    children, 
    content, 
    hotkey, 
    position = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div className={`absolute z-50 flex items-center gap-2 px-2 py-1 bg-neutral-800 text-white text-[12px] font-sans rounded-md pointer-events-none whitespace-nowrap animate-in fade-in zoom-in duration-200 ${positionClasses[position]}`}>
          <span>{content}</span>
          {hotkey && (
            <span className="text-neutral-400 bg-neutral-700 px-1.5 py-0.5 rounded text-[10px] font-mono leading-none">
              {hotkey}
            </span>
          )}
        </div>
      )}
    </div>
  );
};