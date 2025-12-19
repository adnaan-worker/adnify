import React, { useEffect, ReactNode } from 'react';
import { useStore } from '../store';
import { ThemeName } from '../store/slices/themeSlice';

// Theme definitions
export const themes: Record<ThemeName, Record<string, string>> = {
    'adnify-dark': {
        '--background': '9 9 11',           // #09090b
        '--background-secondary': '24 24 27', // #18181b
        '--background-tertiary': '39 39 42',  // #27272a

        '--surface': '24 24 27',            // #18181b
        '--surface-hover': '39 39 42',      // #27272a
        '--surface-active': '63 63 70',     // #3f3f46
        '--surface-muted': '82 82 91',      // #52525b

        '--border': '63 63 70',             // #3f3f46
        '--border-subtle': '39 39 42',      // #27272a
        '--border-active': '113 113 122',   // #71717a

        '--text-primary': '244 244 245',    // #f4f4f5
        '--text-secondary': '161 161 170',  // #a1a1aa
        '--text-muted': '113 113 122',      // #71717a
        '--text-inverted': '9 9 11',        // #09090b

        '--accent': '139 92 246',           // #8b5cf6
        '--accent-hover': '124 58 237',     // #7c3aed
        '--accent-active': '109 40 217',    // #6d28d9
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '139 92 246',

        '--status-success': '34 197 94',    // #22c55e
        '--status-warning': '234 179 8',    // #eab308
        '--status-error': '239 68 68',      // #ef4444
        '--status-info': '59 130 246',      // #3b82f6
    },
    'midnight': {
        '--background': '2 6 23',           // Slate 950
        '--background-secondary': '15 23 42', // Slate 900
        '--background-tertiary': '30 41 59',  // Slate 800

        '--surface': '15 23 42',            // Slate 900
        '--surface-hover': '30 41 59',      // Slate 800
        '--surface-active': '51 65 85',     // Slate 700
        '--surface-muted': '71 85 105',     // Slate 600

        '--border': '30 41 59',             // Slate 800
        '--border-subtle': '15 23 42',      // Slate 900
        '--border-active': '51 65 85',      // Slate 700

        '--text-primary': '248 250 252',    // Slate 50
        '--text-secondary': '148 163 184',  // Slate 400
        '--text-muted': '100 116 139',      // Slate 500
        '--text-inverted': '2 6 23',        // Slate 950

        '--accent': '56 189 248',           // Sky 400
        '--accent-hover': '14 165 233',     // Sky 500
        '--accent-active': '2 132 199',     // Sky 600
        '--accent-foreground': '15 23 42',  // Slate 900
        '--accent-subtle': '56 189 248',

        '--status-success': '34 197 94',
        '--status-warning': '234 179 8',
        '--status-error': '239 68 68',
        '--status-info': '59 130 246',
    },
    'dawn': {
        '--background': '255 255 255',      // White
        '--background-secondary': '248 250 252', // Slate 50
        '--background-tertiary': '241 245 249',  // Slate 100

        '--surface': '255 255 255',         // White
        '--surface-hover': '241 245 249',   // Slate 100
        '--surface-active': '226 232 240',  // Slate 200
        '--surface-muted': '203 213 225',   // Slate 300

        '--border': '226 232 240',          // Slate 200
        '--border-subtle': '241 245 249',   // Slate 100
        '--border-active': '203 213 225',   // Slate 300

        '--text-primary': '15 23 42',       // Slate 900
        '--text-secondary': '71 85 105',    // Slate 600
        '--text-muted': '148 163 184',      // Slate 400
        '--text-inverted': '255 255 255',   // White

        '--accent': '79 70 229',            // Indigo 600
        '--accent-hover': '67 56 202',      // Indigo 700
        '--accent-active': '55 48 163',     // Indigo 800
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '79 70 229',

        '--status-success': '22 163 74',
        '--status-warning': '202 138 4',
        '--status-error': '220 38 38',
        '--status-info': '37 99 235',
    }
};

interface ThemeManagerProps {
    children: ReactNode;
}

export const ThemeManager: React.FC<ThemeManagerProps> = ({ children }) => {
    const currentTheme = useStore((state) => state.currentTheme) as ThemeName;

    useEffect(() => {
        const root = document.documentElement;
        const themeVars = themes[currentTheme] || themes['adnify-dark'];

        Object.entries(themeVars).forEach(([key, value]: [string, string]) => {
            root.style.setProperty(key, value);
        });

        // Set color-scheme for browser UI (scrollbars etc)
        root.style.colorScheme = currentTheme === 'dawn' ? 'light' : 'dark';

    }, [currentTheme]);

    return <>{children}</>;
};
