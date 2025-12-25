import React, { useEffect, ReactNode } from 'react';
import { useStore } from '@store';
import { ThemeName } from '@store/slices/themeSlice';

// Theme definitions
export const themes: Record<ThemeName, Record<string, string>> = {
    'adnify-dark': {
        '--background': '10 10 12',         // Soft Deep Dark
        '--background-secondary': '18 18 21',
        '--background-tertiary': '24 24 27',

        '--surface': '18 18 21',
        '--surface-hover': '24 24 27',
        '--surface-active': '39 39 42',
        '--surface-muted': '63 63 70',

        '--border': '39 39 42',
        '--border-subtle': '34 34 38',      // Dark subtle border
        '--border-active': '82 82 91',

        '--text-primary': '240 240 242',
        '--text-secondary': '161 161 170',
        '--text-muted': '113 113 122',
        '--text-inverted': '0 0 0',

        '--accent': '124 58 237',           // Violet 600
        '--accent-hover': '109 40 217',     // Violet 700
        '--accent-active': '91 33 182',     // Violet 800
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '139 92 246',    // Violet 500

        '--status-success': '34 197 94',
        '--status-warning': '234 179 8',
        '--status-error': '239 68 68',
        '--status-info': '59 130 246',
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
    'cyberpunk': {
        '--background': '10 10 15',         // Dark Navy
        '--background-secondary': '20 20 35',
        '--background-tertiary': '30 30 45',

        '--surface': '20 20 35',
        '--surface-hover': '40 40 60',
        '--surface-active': '60 60 80',
        '--surface-muted': '80 80 100',

        '--border': '60 60 80',
        '--border-subtle': '255 0 255',     // Neon Pink hint
        '--border-active': '0 255 255',     // Neon Cyan hint

        '--text-primary': '255 255 255',
        '--text-secondary': '200 200 255',
        '--text-muted': '150 150 200',
        '--text-inverted': '0 0 0',

        '--accent': '255 0 128',            // Neon Pink
        '--accent-hover': '255 50 150',
        '--accent-active': '200 0 100',
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '255 100 200',

        '--status-success': '0 255 100',    // Neon Green
        '--status-warning': '255 200 0',    // Neon Yellow
        '--status-error': '255 50 50',      // Neon Red
        '--status-info': '0 200 255',       // Neon Blue
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
