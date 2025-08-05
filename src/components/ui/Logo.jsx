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
  alt = 'Rafflehub',
  ...props 
}) => {
  const { getCurrentTheme } = useTheme();
  
  // Size presets - adjusted to match original text logo sizes
  const sizeClasses = {
    'xs': 'h-4 w-auto',     // Extra small
    'sm': 'h-5 w-auto',     // Small - for mobile (matches text-lg)
    'md': 'h-6 w-auto',     // Medium - for desktop (matches text-xl)
    'lg': 'h-8 w-auto',     // Large
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
      ? "/images/logo/logo-light.svg" 
      : "/images/logo/logo-dark.svg";
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
