/**
 * Android Keyboard Input Component
 * Simple but effective Android keyboard fix
 */

import React, { useRef, useEffect } from 'react';

const AndroidKeyboardInput = ({
  children,
  className = '',
  ...props
}) => {
  const containerRef = useRef(null);
  const isAndroid = /Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isAndroid || !containerRef.current) return;

    const container = containerRef.current;

    // Simple focus preservation for Android
    const handleFocusIn = (e) => {
      if (e.target.matches('input, textarea, select')) {
        // Prevent any blur events for a short time
        setTimeout(() => {
          if (document.activeElement !== e.target && document.contains(e.target)) {
            e.target.focus();
          }
        }, 100);
      }
    };

    // Add event listener
    container.addEventListener('focusin', handleFocusIn);

    // Cleanup
    return () => {
      container.removeEventListener('focusin', handleFocusIn);
    };
  }, [isAndroid]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        // Prevent zoom on Android
        fontSize: isAndroid ? '16px' : undefined,
        // Ensure proper touch targets
        minHeight: isAndroid ? '44px' : undefined,
        ...props.style
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default AndroidKeyboardInput;
