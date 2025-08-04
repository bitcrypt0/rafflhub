/**
 * Android Keyboard Input Component
 * Specialized input wrapper that prevents Android keyboard from closing
 */

import React, { useRef, useEffect, useState } from 'react';

const AndroidKeyboardInput = ({ 
  children, 
  className = '',
  onFocus,
  onBlur,
  ...props 
}) => {
  const containerRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isAndroid] = useState(() => /Android/i.test(navigator.userAgent));

  useEffect(() => {
    if (!isAndroid || !containerRef.current) return;

    const container = containerRef.current;
    let focusTimeout = null;
    let preventBlur = false;

    // Android-specific focus handling
    const handleContainerFocus = (e) => {
      console.log('Android Input: Focus event');
      setIsFocused(true);
      preventBlur = true;
      
      // Clear any existing timeout
      if (focusTimeout) {
        clearTimeout(focusTimeout);
      }

      // Ensure the input stays focused
      focusTimeout = setTimeout(() => {
        if (e.target && document.contains(e.target)) {
          e.target.focus();
        }
        preventBlur = false;
      }, 100);

      // Call original onFocus if provided
      if (onFocus) {
        onFocus(e);
      }
    };

    const handleContainerBlur = (e) => {
      console.log('Android Input: Blur event, prevent:', preventBlur);
      
      if (preventBlur) {
        // Re-focus the element
        setTimeout(() => {
          if (e.target && document.contains(e.target)) {
            e.target.focus();
          }
        }, 50);
        return;
      }

      setIsFocused(false);
      
      // Call original onBlur if provided
      if (onBlur) {
        onBlur(e);
      }
    };

    // Android-specific touch handling
    const handleTouchStart = (e) => {
      console.log('Android Input: Touch start');
      preventBlur = true;
      
      // Ensure focus happens
      setTimeout(() => {
        const input = container.querySelector('input, textarea, select');
        if (input) {
          input.focus();
        }
      }, 50);
    };

    const handleTouchEnd = (e) => {
      console.log('Android Input: Touch end');
      
      setTimeout(() => {
        preventBlur = false;
      }, 200);
    };

    // Prevent Android keyboard from closing on certain events
    const handleClick = (e) => {
      console.log('Android Input: Click event');
      e.stopPropagation();
      preventBlur = true;
      
      const input = e.target.closest('input, textarea, select');
      if (input) {
        setTimeout(() => {
          input.focus();
        }, 50);
      }
      
      setTimeout(() => {
        preventBlur = false;
      }, 300);
    };

    // Add event listeners
    container.addEventListener('focusin', handleContainerFocus, { capture: true });
    container.addEventListener('focusout', handleContainerBlur, { capture: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('click', handleClick, { capture: true });

    // Cleanup
    return () => {
      if (focusTimeout) {
        clearTimeout(focusTimeout);
      }
      container.removeEventListener('focusin', handleContainerFocus, { capture: true });
      container.removeEventListener('focusout', handleContainerBlur, { capture: true });
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('click', handleClick, { capture: true });
    };
  }, [isAndroid, onFocus, onBlur]);

  // For non-Android devices, just render normally
  if (!isAndroid) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  // Android-specific wrapper
  return (
    <div
      ref={containerRef}
      className={`android-keyboard-input ${className} ${isFocused ? 'android-input-focused' : ''}`}
      style={{
        // Prevent layout shifts
        contain: 'layout style',
        // Ensure proper touch targets
        minHeight: '44px',
        // Prevent zoom
        fontSize: '16px',
        // Stable positioning
        position: 'relative',
        zIndex: isFocused ? 10 : 'auto'
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default AndroidKeyboardInput;
