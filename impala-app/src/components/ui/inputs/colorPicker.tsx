import React, { useState, useEffect, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';

/* I'll rewrite it, sometime 

TODO: Weird behavior with hue-selector when
color is set to #FFFFFF or #000000

*/

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    className?: string;
}

const getHSV = (hex: string) => {
    let r = parseInt(hex.slice(1, 3) || '0', 16) / 255;
    let g = parseInt(hex.slice(3, 5) || '0', 16) / 255;
    let b = parseInt(hex.slice(5, 7) || '0', 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    
    if (max !== min) {
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else if (max === b) h = (r - g) / d + 4;
        h /= 6;
    }
    return { h: h * 360, s, v };
};

const hsvToHex = (h: number, s: number, v: number) => {
    h /= 360;
    let r = 0, g = 0, b = 0;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
    color, 
    onChange, 
    className = '' 
}) => {
    const [inputValue, setInputValue] = useState(color);
    const hueTrackRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(color); }, [color]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        if (/^#?[0-9A-Fa-f]{6}$/.test(val)) {
            onChange(val.startsWith('#') ? val : `#${val}`);
        }
    };

    const updateHue = (clientY: number) => {
        if (!hueTrackRef.current) return;
        const rect = hueTrackRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
        const newHue = (y / rect.height) * 360;
        
        const { s, v } = getHSV(color);
        onChange(hsvToHex(newHue, s, v));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!hueTrackRef.current) return;
        hueTrackRef.current.setPointerCapture(e.pointerId);
        updateHue(e.clientY);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (e.buttons !== 1) return;
        updateHue(e.clientY);
    };

    const currentHue = getHSV(color).h;

    return (
        <div className={`w-full flex flex-col gap-[10px] ${className}`}>
            <div className="flex items-center gap-[10px]">
                <div className="flex-1 py-0.5 bg-bg-item rounded-[7px] flex items-center justify-between px-[12px]">
                    <span className="font-sans text-[12px] text-text-main select-none shrink-0">Color</span>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onBlur={() => setInputValue(color)}
                        className="w-[60px] bg-transparent border-none outline-none text-right font-sans text-[12px] text-text-main uppercase focus:ring-0 p-0 m-0"
                    />
                </div>
                
                <div 
                    className="w-[28px] h-[28px] rounded-full shrink-0 shadow-sm border border-black/5"
                    style={{ backgroundColor: color }}
                />
            </div>

            <div className="w-full h-[120px] flex gap-[10px]">
                <div className="flex-1 h-full customized-saturation-only rounded-[7px] overflow-hidden">
                    <HexColorPicker color={color} onChange={onChange} style={{ width: '100%', height: '100%' }} />
                </div>

                <div 
                    ref={hueTrackRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={(e) => hueTrackRef.current?.releasePointerCapture(e.pointerId)}
                    className="relative w-[28px] h-full rounded-[7px] cursor-ns-resize touch-none"
                    style={{
                        background: 'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
                    }}
                >
                    {/* Draggable Thumb */}
                    <div 
                        className="absolute left-1/2 w-[24px] h-[12px] bg-transparent border-2 border-item-border rounded-[4px] shadow-sm pointer-events-none"
                        style={{ 
                            top: `${(currentHue / 360) * 100}%`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};