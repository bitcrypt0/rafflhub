/**
 * Universal Mobile Keyboard Fix
 * Handles keyboard viewport issues for both Android and iOS
 * Prevents keyboard from closing when viewport changes occur
 */

let lastFocusedElement = null;
let keyboardVisible = false;
let initialViewportHeight = window.innerHeight;
let initialVisualViewportHeight = window.visualViewport?.height || window.innerHeight;
let keyboardHeight = 0;
let isModalOpen = false;
let preventNextBlur = false;
let focusTimeout = null;
let blurTimeout = null;

// Enhanced mobile detection
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);

// Initialize the universal mobile keyboard fix
export const initMobileKeyboardFix = () => {
  if (!isMobile) return;

  console.log(`Initializing mobile keyboard fix for ${isAndroid ? 'Android' : isIOS ? 'iOS' : 'Mobile'}...`);

  // Store initial viewport heights
  initialViewportHeight = window.innerHeight;
  initialVisualViewportHeight = window.visualViewport?.height || window.innerHeight;

  // Track focused input elements with enhanced detection
  document.addEventListener('focusin', handleFocusIn, { capture: true, passive: false });
  document.addEventListener('focusout', handleFocusOut, { capture: true, passive: false });

  // Monitor viewport changes (keyboard show/hide)
  window.addEventListener('resize', handleViewportChange, { passive: true });

  // Use Visual Viewport API if available (better for modern browsers)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleVisualViewportChange, { passive: true });
    window.visualViewport.addEventListener('scroll', handleVisualViewportScroll, { passive: true });
  }

  // iOS-specific orientation change handling
  if (isIOS) {
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
  }

  // Android-specific aggressive keyboard handling
  if (isAndroid) {
    initAndroidSpecificFixes();
  }

  // Prevent viewport meta tag manipulation during keyboard events
  observeViewportChanges();
};

// Enhanced focus handling for mobile devices
const handleFocusIn = (event) => {
  const target = event.target;

  // Clear any pending timeouts
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }

  // Only track input elements
  if (isInputElement(target)) {
    console.log('Focus in:', target.tagName, target.type, 'Modal open:', isModalOpen, 'Platform:', isAndroid ? 'Android' : 'iOS');
    lastFocusedElement = target;
    preventNextBlur = false;

    // Set keyboard visible immediately for responsive UI
    setKeyboardVisible(true);

    // Android-specific aggressive focus handling
    if (isAndroid) {
      // Prevent any blur events for a short period
      preventNextBlur = true;
      setTimeout(() => {
        preventNextBlur = false;
      }, 500);

      // Ensure input is in viewport immediately
      target.scrollIntoView({
        behavior: 'auto', // Instant for Android
        block: 'center',
        inline: 'nearest'
      });

      // Multiple focus attempts for Android reliability
      const ensureAndroidFocus = () => {
        if (target && document.contains(target)) {
          if (document.activeElement !== target) {
            console.log('Android: Re-focusing element');
            target.focus();
          }

          // Check again after a delay
          setTimeout(() => {
            if (target && document.contains(target) && document.activeElement !== target) {
              console.log('Android: Final focus attempt');
              target.focus();
            }
          }, 100);
        }
      };

      // Immediate focus
      ensureAndroidFocus();

      // Delayed focus for Android keyboard timing
      setTimeout(ensureAndroidFocus, 200);
    } else {
      // iOS handling - more gentle
      focusTimeout = setTimeout(() => {
        if (target && document.contains(target)) {
          const scrollOptions = {
            behavior: 'auto', // iOS prefers instant scroll
            block: 'center',
            inline: 'nearest'
          };

          target.scrollIntoView(scrollOptions);

          // Ensure focus is maintained
          if (document.activeElement !== target) {
            target.focus();
          }
        }
      }, 50); // iOS needs faster response
    }
  }
};

// Enhanced focus out handling
const handleFocusOut = (event) => {
  const target = event.target;
  console.log('Focus out:', target.tagName, 'Prevent blur:', preventNextBlur, 'Platform:', isAndroid ? 'Android' : 'iOS');

  // Clear focus timeout
  if (focusTimeout) {
    clearTimeout(focusTimeout);
    focusTimeout = null;
  }

  // Don't immediately clear keyboard state if we're preventing blur
  if (preventNextBlur) {
    console.log('Blur prevented - maintaining keyboard state');
    preventNextBlur = false;
    return;
  }

  // Android-specific blur handling
  if (isAndroid) {
    // Much longer delay for Android to prevent premature keyboard closure
    blurTimeout = setTimeout(() => {
      // Check if any input element has focus
      const activeElement = document.activeElement;
      const hasInputFocus = activeElement && isInputElement(activeElement);

      console.log('Android blur check:', {
        activeElement: activeElement?.tagName,
        hasInputFocus,
        keyboardVisible
      });

      if (!hasInputFocus) {
        // Double-check with viewport to ensure keyboard is actually gone
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const heightDiff = initialVisualViewportHeight - currentHeight;

        if (heightDiff <= 50) { // Very small threshold for Android
          console.log('Android: Keyboard confirmed closed');
          setKeyboardVisible(false);
        } else {
          console.log('Android: Keyboard still detected, maintaining state');
        }
      }
    }, 800); // Much longer delay for Android
  } else {
    // iOS handling - faster response
    blurTimeout = setTimeout(() => {
      if (!document.activeElement || !isInputElement(document.activeElement)) {
        setKeyboardVisible(false);
      }
    }, 100);
  }
};

// Enhanced input element detection
const isInputElement = (element) => {
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();
  const type = element.type?.toLowerCase();

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    element.hasAttribute('contenteditable') ||
    element.closest('[data-radix-select-trigger]') ||
    element.closest('[role="combobox"]') ||
    (tagName === 'div' && element.getAttribute('role') === 'textbox')
  );
};

// Unified keyboard state management
const setKeyboardVisible = (visible) => {
  const wasVisible = keyboardVisible;
  keyboardVisible = visible;

  if (visible !== wasVisible) {
    console.log('Keyboard state changed:', visible ? 'visible' : 'hidden');

    // Dispatch custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('keyboardStateChange', {
      detail: { visible, height: keyboardHeight }
    }));

    // Update CSS custom property for styling
    document.documentElement.style.setProperty('--keyboard-visible', visible ? '1' : '0');
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
  }
};

// Modal state management
export const setModalOpen = (open) => {
  isModalOpen = open;
  console.log('Modal state changed:', open ? 'open' : 'closed');

  if (open) {
    // Prevent blur events when modal opens
    preventNextBlur = true;
  }
};

// Enhanced viewport change handling for both Android and iOS
const handleViewportChange = () => {
  const currentHeight = window.innerHeight;
  const heightDifference = initialViewportHeight - currentHeight;

  // Calculate keyboard height
  keyboardHeight = Math.max(0, heightDifference);

  // Different thresholds for different platforms
  const threshold = isIOS ? 100 : 150; // iOS has smaller threshold
  const wasKeyboardVisible = keyboardVisible;
  const newKeyboardVisible = heightDifference > threshold;

  console.log('Viewport change:', {
    platform: isAndroid ? 'Android' : isIOS ? 'iOS' : 'Mobile',
    currentHeight,
    initialHeight: initialViewportHeight,
    heightDifference,
    keyboardHeight,
    threshold,
    keyboardVisible: newKeyboardVisible,
    wasKeyboardVisible
  });

  // Update keyboard state through unified function
  setKeyboardVisible(newKeyboardVisible);

  // If keyboard just appeared and we have a focused element
  if (newKeyboardVisible && !wasKeyboardVisible && lastFocusedElement) {
    console.log('Keyboard appeared - refocusing element');
    refocusElement();
  }

  // If keyboard just disappeared, reset viewport height
  if (!newKeyboardVisible && wasKeyboardVisible) {
    console.log('Keyboard disappeared');
    setTimeout(() => {
      initialViewportHeight = window.innerHeight;
    }, isIOS ? 300 : 500); // iOS needs faster reset
  }
};

// Enhanced Visual Viewport API handling (more accurate for modern browsers)
const handleVisualViewportChange = () => {
  if (!window.visualViewport) return;

  const currentHeight = window.visualViewport.height;
  const heightDifference = initialVisualViewportHeight - currentHeight;

  // Calculate keyboard height more accurately
  keyboardHeight = Math.max(0, heightDifference);

  // Different thresholds for different platforms
  const threshold = isIOS ? 80 : 120; // Visual viewport is more sensitive
  const wasKeyboardVisible = keyboardVisible;
  const newKeyboardVisible = heightDifference > threshold;

  console.log('Visual viewport change:', {
    platform: isAndroid ? 'Android' : isIOS ? 'iOS' : 'Mobile',
    currentHeight,
    initialHeight: initialVisualViewportHeight,
    heightDifference,
    keyboardHeight,
    threshold,
    keyboardVisible: newKeyboardVisible,
    wasKeyboardVisible
  });

  // Update keyboard state
  setKeyboardVisible(newKeyboardVisible);

  // Handle focus restoration
  if (newKeyboardVisible && !wasKeyboardVisible && lastFocusedElement) {
    refocusElement();
  }
};

// Handle Visual Viewport scroll (iOS specific)
const handleVisualViewportScroll = () => {
  if (!window.visualViewport || !isIOS) return;

  // iOS sometimes scrolls the visual viewport when keyboard appears
  // Ensure focused element stays visible
  if (lastFocusedElement && keyboardVisible) {
    setTimeout(() => {
      if (lastFocusedElement && document.contains(lastFocusedElement)) {
        lastFocusedElement.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'nearest'
        });
      }
    }, 50);
  }
};

// iOS orientation change handling
const handleOrientationChange = () => {
  if (!isIOS) return;

  console.log('Orientation changed on iOS');

  // Reset viewport heights after orientation change
  setTimeout(() => {
    initialViewportHeight = window.innerHeight;
    initialVisualViewportHeight = window.visualViewport?.height || window.innerHeight;

    // Refocus if we have an active element
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }
  }, 500); // iOS needs time to settle after orientation change
};

// Android-specific aggressive keyboard fixes
const initAndroidSpecificFixes = () => {
  console.log('Initializing Android-specific keyboard fixes...');

  // Aggressive input focus detection for Android
  document.addEventListener('touchstart', (e) => {
    const target = e.target;
    if (isInputElement(target)) {
      console.log('Android: Touch start on input element');
      preventNextBlur = true;
      setKeyboardVisible(true);

      // Ensure focus happens
      setTimeout(() => {
        if (target && document.contains(target)) {
          target.focus();
        }
      }, 50);
    }
  }, { capture: true, passive: false });

  // Prevent Android from closing keyboard on layout changes
  document.addEventListener('touchend', (e) => {
    const target = e.target;
    if (isInputElement(target)) {
      console.log('Android: Touch end on input element');

      // Delay to ensure focus is maintained
      setTimeout(() => {
        if (target && document.contains(target) && document.activeElement !== target) {
          console.log('Android: Refocusing after touch end');
          target.focus();
        }
      }, 100);
    }
  }, { capture: true, passive: false });

  // Android-specific viewport stability
  let androidViewportStable = true;
  const stabilizeAndroidViewport = () => {
    if (!androidViewportStable) return;

    androidViewportStable = false;
    setTimeout(() => {
      androidViewportStable = true;
    }, 300);

    // Prevent any viewport changes during this period
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && originalViewportContent) {
      viewport.setAttribute('content', originalViewportContent);
    }
  };

  // Monitor for Android-specific events that might close keyboard
  document.addEventListener('scroll', stabilizeAndroidViewport, { passive: true });
  window.addEventListener('resize', stabilizeAndroidViewport, { passive: true });

  // Android-specific input event handling
  document.addEventListener('input', (e) => {
    if (isInputElement(e.target)) {
      console.log('Android: Input event detected');
      setKeyboardVisible(true);
      preventNextBlur = true;
    }
  }, { capture: true });

  // Prevent Android keyboard from closing on certain events
  document.addEventListener('click', (e) => {
    if (keyboardVisible && isInputElement(e.target)) {
      console.log('Android: Click on input while keyboard visible');
      e.stopPropagation();
      preventNextBlur = true;

      setTimeout(() => {
        if (e.target && document.contains(e.target)) {
          e.target.focus();
        }
      }, 50);
    }
  }, { capture: true });
};

// Prevent viewport meta tag manipulation during keyboard events
let viewportObserver = null;
let originalViewportContent = null;

const observeViewportChanges = () => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;

  // Store original viewport content
  originalViewportContent = viewport.getAttribute('content');

  // Create mutation observer to watch for viewport changes
  viewportObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'content') {
        const newContent = viewport.getAttribute('content');

        // If keyboard is visible and viewport is being changed, prevent it
        if (keyboardVisible && newContent !== originalViewportContent) {
          console.log('Preventing viewport change during keyboard interaction');

          // Restore original viewport
          setTimeout(() => {
            viewport.setAttribute('content', originalViewportContent);
          }, 0);

          // Refocus if needed
          if (lastFocusedElement && document.contains(lastFocusedElement)) {
            setTimeout(() => {
              lastFocusedElement.focus();
            }, 50);
          }
        }
      }
    });
  });

  viewportObserver.observe(viewport, {
    attributes: true,
    attributeFilter: ['content']
  });
};

// Enhanced refocus functionality
const refocusElement = () => {
  if (!lastFocusedElement || !document.contains(lastFocusedElement)) return;

  try {
    console.log('Refocusing element:', lastFocusedElement.tagName);

    // Prevent blur event during refocus
    preventNextBlur = true;

    // Platform-specific refocus timing
    const delay = isIOS ? 50 : 100;

    setTimeout(() => {
      if (lastFocusedElement && document.contains(lastFocusedElement)) {
        // Ensure element is focusable
        if (lastFocusedElement.disabled || lastFocusedElement.readOnly) {
          return;
        }

        lastFocusedElement.focus();

        // Scroll into view with platform-specific behavior
        setTimeout(() => {
          if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.scrollIntoView({
              behavior: isIOS ? 'auto' : 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }
        }, isIOS ? 50 : 100);
      }
    }, delay);
  } catch (error) {
    console.error('Error refocusing element:', error);
  }
};





// Backward compatibility exports
export const initAndroidKeyboardFix = initMobileKeyboardFix;

// Enhanced cleanup function for all mobile platforms
export const cleanupMobileKeyboardFix = () => {
  if (!isMobile) return;

  console.log(`Cleaning up mobile keyboard fix for ${isAndroid ? 'Android' : isIOS ? 'iOS' : 'Mobile'}...`);

  // Clear timeouts
  if (focusTimeout) {
    clearTimeout(focusTimeout);
    focusTimeout = null;
  }
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }

  // Remove event listeners
  document.removeEventListener('focusin', handleFocusIn, { capture: true });
  document.removeEventListener('focusout', handleFocusOut, { capture: true });
  window.removeEventListener('resize', handleViewportChange);

  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
    window.visualViewport.removeEventListener('scroll', handleVisualViewportScroll);
  }

  if (isIOS) {
    window.removeEventListener('orientationchange', handleOrientationChange);
  }

  // Cleanup viewport observer
  if (viewportObserver) {
    viewportObserver.disconnect();
    viewportObserver = null;
  }

  // Reset state
  lastFocusedElement = null;
  keyboardVisible = false;
  isModalOpen = false;
  preventNextBlur = false;
  keyboardHeight = 0;

  // Remove CSS custom properties
  document.documentElement.style.removeProperty('--keyboard-visible');
  document.documentElement.style.removeProperty('--keyboard-height');
};

// Backward compatibility
export const cleanupAndroidKeyboardFix = cleanupMobileKeyboardFix;
