import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCloseOnBreakpoint } from './use-close-on-breakpoint';

type ChangeListener = () => void;

/** Installs a controllable window.matchMedia; `setMatches` simulates a resize across the query. */
function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<ChangeListener>();
  const query = {
    matches: initialMatches,
    addEventListener: vi.fn((_event: string, listener: ChangeListener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: ChangeListener) => {
      listeners.delete(listener);
    }),
  };
  const matchMedia = vi.fn(() => query);
  Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: matchMedia });

  return {
    matchMedia,
    query,
    setMatches(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

afterEach(() => {
  delete (window as Partial<Window>).matchMedia;
});

describe('useCloseOnBreakpoint', () => {
  it('does nothing while inactive', () => {
    const { matchMedia } = mockMatchMedia(true);
    const onClose = vi.fn();

    renderHook(() => useCloseOnBreakpoint(false, 1024, onClose));

    expect(matchMedia).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes immediately if the drawer is active at a desktop width', () => {
    mockMatchMedia(true);
    const onClose = vi.fn();

    renderHook(() => useCloseOnBreakpoint(true, 1024, onClose));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open below the breakpoint and closes once the viewport crosses it', () => {
    const media = mockMatchMedia(false);
    const onClose = vi.fn();

    renderHook(() => useCloseOnBreakpoint(true, 1024, onClose));

    expect(media.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    expect(onClose).not.toHaveBeenCalled();

    act(() => media.setMatches(true));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('removes its listener on unmount', () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderHook(() => useCloseOnBreakpoint(true, 1024, vi.fn()));

    unmount();

    expect(media.query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('is a no-op when matchMedia is unavailable', () => {
    const onClose = vi.fn();

    renderHook(() => useCloseOnBreakpoint(true, 1024, onClose));

    expect(onClose).not.toHaveBeenCalled();
  });
});
