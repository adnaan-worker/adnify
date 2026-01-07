import React, { useEffect, ReactNode } from 'react';
import { useStore } from '@store';
import { ThemeName } from '@store/slices/themeSlice';

// Theme definitions
export const themes: Record<ThemeName, Record<string, string>> = {
    'adnify-dark': {
        // Deep Zinc/Slate base - Professional & Modern
        '--background': '9 9 11',           // #09090b (Level 1)
        '--background-secondary': '9 9 11', // #09090b (Unified)
        '--background-tertiary': '20 20 23',  // #141417

        '--surface': '39 39 42',            // #27272a (Level 3)
        '--surface-hover': '63 63 70',      // #3f3f46
        '--surface-active': '82 82 91',     // #52525b
        '--surface-muted': '113 113 122',   // #71717a

        '--border': '39 39 42',             // #27272a
        '--border-subtle': '39 39 42',      // #27272a
        '--border-active': '82 82 91',      // #52525b

        '--text-primary': '250 250 250',    // #fafafa
        '--text-secondary': '161 161 170',  // #a1a1aa
        '--text-muted': '113 113 122',      // #71717a
        '--text-inverted': '9 9 11',        // #09090b

        '--accent': '139 92 246',           // Violet 500
        '--accent-hover': '124 58 237',     // Violet 600
        '--accent-active': '109 40 217',    // Violet 700
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '167 139 250',   // Violet 400

        '--status-success': '34 197 94',    // Green 500
        '--status-warning': '234 179 8',    // Yellow 500
        '--status-error': '239 68 68',      // Red 500
        '--status-info': '59 130 246',      // Blue 500

        // Modern Radius
        '--radius-sm': '0.25rem',
        '--radius-md': '0.375rem',
        '--radius-lg': '0.5rem',
        '--radius-full': '9999px',
    },
    'midnight': {
        // Deep Ocean Blue - Calm & Focused
        '--background': '2 6 23',           // Slate 950
        '--background-secondary': '15 23 42', // Slate 900
        '--background-tertiary': '30 41 59',  // Slate 800

        '--surface': '15 23 42',            // Slate 900
        '--surface-hover': '30 41 59',      // Slate 800
        '--surface-active': '51 65 85',     // Slate 700
        '--surface-muted': '71 85 105',     // Slate 600

        '--border': '30 41 59',             // Slate 800
        '--border-subtle': '51 65 85',      // Slate 700
        '--border-active': '100 116 139',   // Slate 500

        '--text-primary': '248 250 252',    // Slate 50
        '--text-secondary': '148 163 184',  // Slate 400
        '--text-muted': '100 116 139',      // Slate 500
        '--text-inverted': '2 6 23',        // Slate 950

        '--accent': '56 189 248',           // Sky 400
        '--accent-hover': '14 165 233',     // Sky 500
        '--accent-active': '2 132 199',     // Sky 600
        '--accent-foreground': '15 23 42',  // Slate 900
        '--accent-subtle': '125 211 252',   // Sky 300

        '--status-success': '74 222 128',   // Green 400
        '--status-warning': '250 204 21',   // Yellow 400
        '--status-error': '248 113 113',    // Red 400
        '--status-info': '96 165 250',      // Blue 400

        // Slightly Rounder
        '--radius-sm': '0.375rem',
        '--radius-md': '0.5rem',
        '--radius-lg': '0.75rem',
        '--radius-full': '9999px',
    },
    'cyberpunk': {
        // High Contrast Neon - Sharp & Vivid
        '--background': '3 3 5',            // Almost Black
        '--background-secondary': '10 10 18',
        '--background-tertiary': '20 20 35',

        '--surface': '10 10 18',
        '--surface-hover': '24 20 45',      // Slight purple tint
        '--surface-active': '45 20 60',
        '--surface-muted': '60 60 80',

        '--border': '45 20 60',
        '--border-subtle': '255 0 128',     // Neon Pink border hint
        '--border-active': '0 255 255',     // Neon Cyan

        '--text-primary': '255 255 255',
        '--text-secondary': '200 200 255',
        '--text-muted': '150 150 200',
        '--text-inverted': '0 0 0',

        '--accent': '255 0 128',            // Neon Pink
        '--accent-hover': '255 50 150',
        '--accent-active': '200 0 100',
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '255 100 200',

        '--status-success': '0 255 150',    // Neon Green
        '--status-warning': '255 220 0',    // Neon Yellow
        '--status-error': '255 50 80',      // Neon Red
        '--status-info': '0 220 255',       // Neon Blue

        // Sharp Edges
        '--radius-sm': '0px',
        '--radius-md': '2px',
        '--radius-lg': '4px',
        '--radius-full': '9999px',
    },
    'dawn': {
        // Soft Light Theme - Easy on eyes
        '--background': '255 255 255',      // White
        '--background-secondary': '248 250 252', // Slate 50
        '--background-tertiary': '241 245 249',  // Slate 100

        '--surface': '255 255 255',         // White
        '--surface-hover': '241 245 249',   // Slate 100
        '--surface-active': '226 232 240',  // Slate 200
        '--surface-muted': '203 213 225',   // Slate 300

        '--border': '226 232 240',          // Slate 200
        '--border-subtle': '203 213 225',   // Slate 300
        '--border-active': '148 163 184',   // Slate 400

        '--text-primary': '15 23 42',       // Slate 900
        '--text-secondary': '71 85 105',    // Slate 600
        '--text-muted': '100 116 139',      // Slate 500 (Improved contrast)
        '--text-inverted': '255 255 255',   // White

        '--accent': '99 102 241',           // Indigo 500
        '--accent-hover': '79 70 229',      // Indigo 600
        '--accent-active': '67 56 202',     // Indigo 700
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '129 140 248',   // Indigo 400

        '--status-success': '22 163 74',    // Green 600
        '--status-warning': '202 138 4',    // Yellow 600
        '--status-error': '220 38 38',      // Red 600
        '--status-info': '37 99 235',       // Blue 600

        // Soft Radius
        '--radius-sm': '0.375rem',
        '--radius-md': '0.5rem',
        '--radius-lg': '0.75rem',
        '--radius-full': '9999px',
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
