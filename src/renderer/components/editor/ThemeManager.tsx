import React, { useEffect, ReactNode } from 'react';
import { useStore } from '@store';
import { ThemeName } from '@store/slices/themeSlice';

export const themes: Record<ThemeName, Record<string, string>> = {
    'adnify-dark': {
        '--background': '9 9 11',
        '--background-secondary': '9 9 11',
        '--background-tertiary': '20 20 23',
        '--surface': '24 24 27',
        '--surface-hover': '39 39 42',
        '--surface-active': '63 63 70',
        '--surface-muted': '113 113 122',
        '--border': '39 39 42',
        '--border-subtle': '24 24 27',
        '--border-active': '82 82 91',
        '--text-primary': '250 250 250',
        '--text-secondary': '161 161 170',
        '--text-muted': '113 113 122',
        '--text-inverted': '9 9 11',
        '--accent': '139 92 246',
        '--accent-hover': '124 58 237',
        '--accent-active': '109 40 217',
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '167 139 250',
        '--status-success': '34 197 94',
        '--status-warning': '234 179 8',
        '--status-error': '239 68 68',
        '--status-info': '59 130 246',
        '--radius-sm': '0.25rem',
        '--radius-md': '0.375rem',
        '--radius-lg': '0.5rem',
        '--radius-full': '9999px',
    },
    'dawn': {
        // High Quality Vercel-like Light Theme
        '--background': '255 255 255',
        '--background-secondary': '250 250 250',
        '--background-tertiary': '244 244 245',
        '--surface': '255 255 255',
        '--surface-hover': '244 244 245',
        '--surface-active': '228 228 231',
        '--surface-muted': '161 161 170',
        '--border': '228 228 231',
        '--border-subtle': '244 244 245',
        '--border-active': '161 161 170',
        '--text-primary': '9 9 11',
        '--text-secondary': '82 82 91',
        '--text-muted': '113 113 122',
        '--text-inverted': '255 255 255',
        '--accent': '79 70 229',
        '--accent-hover': '67 56 202',
        '--accent-active': '55 48 163',
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '199 210 254',
        '--status-success': '22 163 74',
        '--status-warning': '202 138 4',
        '--status-error': '220 38 38',
        '--status-info': '37 99 235',
        '--radius-sm': '0.375rem',
        '--radius-md': '0.5rem',
        '--radius-lg': '0.75rem',
        '--radius-full': '9999px',
    },
    'midnight': {
        '--background': '2 6 23',
        '--background-secondary': '2 6 23',
        '--background-tertiary': '15 23 42',
        '--surface': '15 23 42',
        '--surface-hover': '30 41 59',
        '--surface-active': '51 65 85',
        '--surface-muted': '71 85 105',
        '--border': '30 41 59',
        '--border-subtle': '15 23 42',
        '--border-active': '100 116 139',
        '--text-primary': '248 250 252',
        '--text-secondary': '148 163 184',
        '--text-muted': '100 116 139',
        '--text-inverted': '2 6 23',
        '--accent': '56 189 248',
        '--accent-hover': '14 165 233',
        '--accent-active': '2 132 199',
        '--accent-foreground': '15 23 42',
        '--accent-subtle': '125 211 252',
        '--status-success': '74 222 128',
        '--status-warning': '250 204 21',
        '--status-error': '248 113 113',
        '--status-info': '96 165 250',
        '--radius-sm': '0.375rem',
        '--radius-md': '0.5rem',
        '--radius-lg': '0.75rem',
        '--radius-full': '9999px',
    },
    'cyberpunk': {
        '--background': '3 3 5',
        '--background-secondary': '3 3 5',
        '--background-tertiary': '10 10 18',
        '--surface': '10 10 18',
        '--surface-hover': '24 20 45',
        '--surface-active': '45 20 60',
        '--surface-muted': '60 60 80',
        '--border': '45 20 60',
        '--border-subtle': '3 3 5',
        '--border-active': '0 255 255',
        '--text-primary': '255 255 255',
        '--text-secondary': '200 200 255',
        '--text-muted': '150 150 200',
        '--text-inverted': '0 0 0',
        '--accent': '255 0 128',
        '--accent-hover': '255 50 150',
        '--accent-active': '200 0 100',
        '--accent-foreground': '255 255 255',
        '--accent-subtle': '255 100 200',
        '--status-success': '0 255 150',
        '--status-warning': '255 220 0',
        '--status-error': '255 50 80',
        '--status-info': '0 220 255',
        '--radius-sm': '0px',
        '--radius-md': '2px',
        '--radius-lg': '4px',
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

        root.style.colorScheme = currentTheme === 'dawn' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', currentTheme === 'dawn' ? 'light' : 'dark');

    }, [currentTheme]);

    return <>{children}</>;
};