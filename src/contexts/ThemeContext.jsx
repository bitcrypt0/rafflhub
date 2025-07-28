import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Available themes configuration
const AVAILABLE_THEMES = [
  { id: 'light', name: 'Light', icon: 'Sun' },
  { id: 'dark', name: 'Dark', icon: 'Moon' },
  { id: 'dim-blue', name: 'Dim Blue', icon: 'Waves' }
];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && AVAILABLE_THEMES.some(t => t.id === savedTheme)) {
      return savedTheme;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // Default to dark theme (as per original app behavior)
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme classes
    AVAILABLE_THEMES.forEach(themeOption => {
      root.classList.remove(themeOption.id);
    });

    // Add current theme class
    root.classList.add(theme);

    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    const currentIndex = AVAILABLE_THEMES.findIndex(t => t.id === theme);
    const nextIndex = (currentIndex + 1) % AVAILABLE_THEMES.length;
    setTheme(AVAILABLE_THEMES[nextIndex].id);
  };

  const getCurrentTheme = () => {
    return AVAILABLE_THEMES.find(t => t.id === theme) || AVAILABLE_THEMES[1]; // fallback to dark
  };

  const value = {
    theme,
    setTheme,
    cycleTheme,
    getCurrentTheme,
    availableThemes: AVAILABLE_THEMES,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    isDimBlue: theme === 'dim-blue'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
