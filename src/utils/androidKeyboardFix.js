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
    console.log('Focus in:', target.tagName, target.type, 'Modal open:', isModalOpen);
    lastFocusedElement = target;
    preventNextBlur = false;

    // Set keyboard visible immediately for responsive UI
    setKeyboardVisible(true);

    // Enhanced scroll into view for mobile
    focusTimeout = setTimeout(() => {
      if (target && document.contains(target)) {
        // Different scroll behavior for iOS vs Android
        const scrollOptions = {
          behavior: isIOS ? 'auto' : 'smooth', // iOS prefers instant scroll
          block: 'center',
          inline: 'nearest'
        };

        target.scrollIntoView(scrollOptions);

        // Ensure focus is maintained
        if (document.activeElement !== target) {
          target.focus();
        }
      }
    }, isIOS ? 50 : 100); // iOS needs faster response
  }
};

// Enhanced focus out handling
const handleFocusOut = (event) => {
  const target = event.target;
  console.log('Focus out:', target.tagName, 'Prevent blur:', preventNextBlur);

  // Clear focus timeout
  if (focusTimeout) {
    clearTimeout(focusTimeout);
    focusTimeout = null;
  }

  // Don't immediately clear keyboard state if we're preventing blur
  if (preventNextBlur) {
    preventNextBlur = false;
    return;
  }

  // Delay keyboard state change to allow for refocusing
  blurTimeout = setTimeout(() => {
    if (!document.activeElement || !isInputElement(document.activeElement)) {
      setKeyboardVisible(false);
    }
  }, isIOS ? 100 : 200); // iOS needs faster response
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
