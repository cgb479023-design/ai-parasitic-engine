// Theme Toggle Component

import React from 'react';

interface ThemeToggleProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onThemeChange }) => {
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    onThemeChange(newTheme);
    
    // Update HTML attribute for global theme
    document.documentElement.className = newTheme;
    
    // Store theme preference in localStorage
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center justify-center p-2 rounded-full bg-slate-800/50 text-slate-300 hover:text-blue-400 hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      aria-label="Toggle theme"
      title={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
    >
      <div className="relative w-10 h-6">
        <span 
          className={`absolute inset-0 rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-700' : 'bg-blue-500'}`}
        ></span>
        <span 
          className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 transform ${theme === 'dark' ? '' : 'translate-x-4'}`}
        ></span>
      </div>
    </button>
  );
};

// Custom Hook for Theme Management
export const useTheme = () => {
  // Get initial theme from localStorage or default to dark
  const initialTheme = (localStorage.getItem('theme') as 'dark' | 'light' | null) || 'dark';
  
  // Update HTML attribute on initial load
  React.useEffect(() => {
    document.documentElement.className = initialTheme;
  }, [initialTheme]);
  
  const [theme, setTheme] = React.useState<['dark' | 'light']>([initialTheme]);
  
  const toggleTheme = () => {
    const newTheme = theme[0] === 'dark' ? 'light' : 'dark';
    setTheme([newTheme]);
    document.documentElement.className = newTheme;
    localStorage.setItem('theme', newTheme);
  };
  
  const setThemeMode = (newTheme: 'dark' | 'light') => {
    setTheme([newTheme]);
    document.documentElement.className = newTheme;
    localStorage.setItem('theme', newTheme);
  };
  
  return {
    theme: theme[0],
    toggleTheme,
    setTheme: setThemeMode
  };
};
