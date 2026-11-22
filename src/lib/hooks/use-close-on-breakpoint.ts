'use client';

import { useEffect } from 'react';

/** Tailwind's `lg` breakpoint: the width at which mobile drawers switch to the desktop sidebar. */
export const LG_BREAKPOINT_PX = 1024;

/**
 * While `active` is true, calls `onClose` once the viewport reaches `minWidth`.
 *
 * Mobile drawers are hidden with CSS at the desktop breakpoint, but their open
 * state lives in the parent. Without this, a drawer left open while the window
 * grows keeps its body scroll lock on desktop, and reappears when the window
 * shrinks again.
 */
export function useCloseOnBreakpoint(active: boolean, minWidth: number, onClose: () => void): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const handleChange = () => {
      if (query.matches) onClose();
    };

    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [active, minWidth, onClose]);
}
