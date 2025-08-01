/**
 * Android Keyboard Focus Fix
 * Handles the Android keyboard viewport resize issue that causes input fields to lose focus
 */

let lastFocusedElement = null;
let keyboardVisible = false;
let initialViewportHeight = window.innerHeight;

// Detect if we're on Android
const isAndroid = /Android/i.test(navigator.userAgent);

// Initialize the Android keyboard fix
export const initAndroidKeyboardFix = () => {
  if (!isAndroid) return;

  console.log('Initializing Android keyboard fix...');

  // Store initial viewport height
  initialViewportHeight = window.innerHeight;

  // Track focused input elements
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);

  // Monitor viewport changes (keyboard show/hide)
  window.addEventListener('resize', handleViewportChange);
  
  // Use Visual Viewport API if available (better for Android)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleVisualViewportChange);
  }
};

// Handle input focus
const handleFocusIn = (event) => {
  const target = event.target;
  
  if (isInputElement(target)) {
    console.log('Input focused:', target.tagName, target.type);
    lastFocusedElement = target;
    
    // Ensure the input stays in view when keyboard appears
    setTimeout(() => {
      if (target === document.activeElement) {
        target.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }
    }, 300); // Delay to allow keyboard animation
  }
};

// Handle input blur
const handleFocusOut = (event) => {
  const target = event.target;
  
  if (isInputElement(target)) {
    console.log('Input blurred:', target.tagName);
    
    // Don't clear lastFocusedElement immediately - keyboard might still be showing
    setTimeout(() => {
      if (document.activeElement === document.body || 
          !isInputElement(document.activeElement)) {
        lastFocusedElement = null;
      }
    }, 100);
  }
};

// Handle viewport changes (keyboard show/hide)
const handleViewportChange = () => {
  const currentHeight = window.innerHeight;
  const heightDifference = initialViewportHeight - currentHeight;
  
  // Keyboard is considered visible if viewport shrunk by more than 150px
  const wasKeyboardVisible = keyboardVisible;
  keyboardVisible = heightDifference > 150;
  
  console.log('Viewport change:', {
    currentHeight,
    initialHeight: initialViewportHeight,
    heightDifference,
    keyboardVisible,
    wasKeyboardVisible
  });
  
  // If keyboard just appeared and we have a focused element
  if (keyboardVisible && !wasKeyboardVisible && lastFocusedElement) {
    console.log('Keyboard appeared - refocusing element');
    refocusElement();
  }
  
  // If keyboard just disappeared
  if (!keyboardVisible && wasKeyboardVisible) {
    console.log('Keyboard disappeared');
    // Update initial height for next time
    setTimeout(() => {
      initialViewportHeight = window.innerHeight;
    }, 500);
  }
};

// Handle Visual Viewport changes (more accurate for Android)
const handleVisualViewportChange = () => {
  if (!window.visualViewport) return;
  
  const currentHeight = window.visualViewport.height;
  const heightDifference = initialViewportHeight - currentHeight;
  
  const wasKeyboardVisible = keyboardVisible;
  keyboardVisible = heightDifference > 150;
  
  console.log('Visual viewport change:', {
    currentHeight,
    initialHeight: initialViewportHeight,
    heightDifference,
    keyboardVisible
  });
  
  if (keyboardVisible && !wasKeyboardVisible && lastFocusedElement) {
    console.log('Visual viewport - keyboard appeared - refocusing element');
    refocusElement();
  }
};

// Refocus the last focused element
const refocusElement = () => {
  if (!lastFocusedElement) return;
  
  try {
    // Small delay to ensure keyboard is fully shown
    setTimeout(() => {
      if (lastFocusedElement && document.contains(lastFocusedElement)) {
        console.log('Refocusing element:', lastFocusedElement.tagName);
        lastFocusedElement.focus();
        
        // Scroll into view again
        setTimeout(() => {
          lastFocusedElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }, 100);
      }
    }, 100);
  } catch (error) {
    console.error('Error refocusing element:', error);
  }
};

// Check if element is an input element
const isInputElement = (element) => {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  const inputTypes = ['input', 'textarea', 'select'];
  
  return inputTypes.includes(tagName) || 
         element.contentEditable === 'true' ||
         element.hasAttribute('data-radix-select-trigger');
};

// Cleanup function
export const cleanupAndroidKeyboardFix = () => {
  if (!isAndroid) return;
  
  console.log('Cleaning up Android keyboard fix...');
  
  document.removeEventListener('focusin', handleFocusIn, true);
  document.removeEventListener('focusout', handleFocusOut, true);
  window.removeEventListener('resize', handleViewportChange);
  
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
  }
  
  lastFocusedElement = null;
  keyboardVisible = false;
};
