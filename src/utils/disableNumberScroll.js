// Global fix for accidental mouse-wheel changes on <input type="number">
// Strategy: capture wheel events early, and if they originate within a number input
// (that isn't disabled/readOnly and hasn't opted out), immediately blur the input.
// This prevents the value from changing while still allowing the page to scroll.

let cleanupFn = null;

export function initDisableNumberScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const options = { capture: true };

  const handler = (event) => {
    const target = event.target;
    if (!target || !(target instanceof Element)) return;

    const input = target.closest('input[type="number"]');
    if (!input) return;

    if (input.disabled || input.readOnly) return;

    // Opt-out mechanism: <input type="number" data-wheel-allowed="true" />
    if (input.dataset && input.dataset.wheelAllowed === 'true') return;

    // Blur before default wheel behavior to avoid value changes.
    // We do not call preventDefault so the page can still scroll.
    input.blur();
  };

  document.addEventListener('wheel', handler, options);

  cleanupFn = () => {
    document.removeEventListener('wheel', handler, options);
    cleanupFn = null;
  };

  return cleanupFn;
}

export function cleanupDisableNumberScroll() {
  if (cleanupFn) cleanupFn();
}

