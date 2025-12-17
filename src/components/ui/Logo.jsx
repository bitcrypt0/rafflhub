import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Logo component that automatically switches between light and dark theme versions
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.size - Size preset: 'sm', 'md', 'lg', or custom height class
 * @param {boolean} props.showIcon - Whether to show icon version instead of full logo
 * @param {string} props.alt - Alt text for accessibility
 * @returns {JSX.Element} Logo image component
 */
const Logo = ({ 
  className = '', 
  size = 'md', 
  showIcon = false, 
  alt = 'Dropr',
  ...props 
}) => {
  const { getCurrentTheme } = useTheme();
  
  // Size presets - increased for better visibility
  const sizeClasses = {
    'xs': 'h-4 w-auto',     // Extra small
    'sm': 'h-6 w-auto',     // Small - for mobile
    'md': 'h-8 w-auto',     // Medium - for desktop
    'lg': 'h-10 w-auto',    // Large
    'xl': 'h-12 w-auto'     // Extra large
  };
  
  // Get the appropriate size class
  const sizeClass = sizeClasses[size] || size;
  
  // Determine which logo to use based on theme and icon preference
  const getLogoSrc = () => {
    if (showIcon) {
      return "/images/logo/logo-icon.png";
    }
    
    const currentTheme = getCurrentTheme();
    return currentTheme.id === 'light' 
      ? "/images/logo/Asset 25.svg" 
      : "/images/logo/Asset 26.svg";
  };
  
  return (
    <img 
      src={getLogoSrc()}
      alt={alt}
      className={`${sizeClass} transition-opacity duration-200 ${className}`}
      {...props}
    />
  );
};

export default Logo;
