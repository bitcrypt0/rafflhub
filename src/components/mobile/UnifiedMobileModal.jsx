/**
 * Unified Mobile Modal Component
 * Fixes Android keyboard issues while maintaining iOS compatibility
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';
import { setModalOpen } from '../../utils/androidKeyboardFix';

const UnifiedMobileModal = ({
  isOpen,
  onOpenChange,
  trigger,
  title,
  children,
  className = ''
}) => {
  const { isMobile } = useMobileBreakpoints();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Listen for keyboard state changes
  useEffect(() => {
    const handleKeyboardChange = (event) => {
      setKeyboardVisible(event.detail.visible);
    };

    window.addEventListener('keyboardStateChange', handleKeyboardChange);
    return () => window.removeEventListener('keyboardStateChange', handleKeyboardChange);
  }, []);

  // Manage modal state in keyboard fix utility
  useEffect(() => {
    setModalOpen(isOpen);
  }, [isOpen]);

  // Handle modal open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Prevent body scroll without aggressive viewport manipulation
      document.body.style.overflow = 'hidden';
      
      // Add modal-open class for CSS targeting
      document.documentElement.classList.add('modal-open');
      
      // Animation complete
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      document.body.style.overflow = '';
      document.documentElement.classList.remove('modal-open');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isMobile, onOpenChange]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  // Prevent event propagation for content area
  const handleContentInteraction = (e) => {
    e.stopPropagation();
  };

  // Desktop modal (using native dialog or simple overlay)
  if (!isMobile) {
    return (
      <>
        {trigger}
        {isOpen && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={handleBackdropClick} />
            <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button
                  onClick={() => onOpenChange(false)}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                {children}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Mobile modal with keyboard-friendly implementation
  return (
    <>
      {trigger}
      {isOpen && createPortal(
        <div
          ref={modalRef}
          className={`fixed inset-0 z-[9999] flex ${keyboardVisible ? 'items-start pt-4' : 'items-end'} justify-center transition-all duration-300 ${className}`}
          onClick={handleBackdropClick}
          style={{
            // Use transform instead of changing viewport
            transform: isAnimating ? 'translateY(100%)' : 'translateY(0)',
            transition: 'transform 0.3s ease-out'
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" />
          
          {/* Modal Content */}
          <div
            ref={contentRef}
            className={`
              relative bg-background border border-border rounded-t-xl shadow-lg w-full mx-2 
              ${keyboardVisible ? 'max-h-[60vh]' : 'max-h-[85vh]'} 
              transition-all duration-300 ease-out
              ${isAnimating ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
            `}
            onClick={handleContentInteraction}
            onTouchStart={handleContentInteraction}
            onTouchMove={handleContentInteraction}
            onTouchEnd={handleContentInteraction}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-background rounded-t-xl">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 hover:bg-muted rounded-md transition-colors touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Content */}
            <div 
              className="p-4 overflow-y-auto"
              style={{
                maxHeight: keyboardVisible ? 'calc(60vh - 80px)' : 'calc(85vh - 80px)',
                WebkitOverflowScrolling: 'touch',
                // Prevent zoom on input focus
                touchAction: 'pan-y'
              }}
            >
              {children}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default UnifiedMobileModal;
