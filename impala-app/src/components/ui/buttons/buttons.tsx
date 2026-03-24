import React from 'react';

    /* Generic button component. Has 5 variants:
    1. full: Black 20px hug button
    2. icon: Icon-only 40x40 with gray BG
    3. toggle: Stroked gray 40x40
    4. misc: 20x20 Icon-only with no BG
    5. accent: 40px Orange button */

type ButtonVariant = 'full' | 'icon' | 'toggle' | 'misc' | 'accent';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'full', 
    className = '', 
    children, 
    ...props}) => {

    const variants: Record<ButtonVariant, string> = {
        full: 'w-full px-4 py-1.5 bg-text-main text-bg rounded-full text-base hover:opacity-80',
        icon: 'w-10 h-10 bg-bg-item border border-item-border text-text-main rounded-2xl hover:brightness-95 shrink-0',
        toggle: 'w-10 h-10 bg-transparent border border-item-border text-text-main rounded-2xl hover:bg-bg-item shrink-0',
        misc: 'w-5 h-5 text-text-main hover:text-text-main bg-transparent shrink-0',
        accent: 'px-10 py-2.5 h-10 bg-accent border border-accent-border text-bg rounded-2xl font-bold shadow-sm hover:brightness-105 shrink-0'
    };

    const baseClasses = 'inline-flex items-center justify-center font-medium disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variantClasses = variants[variant];

    return (
        <button
            className={`${baseClasses} ${variantClasses} ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
}