/**
 * Tests for use-wishlist-store.ts
 *
 * Cross-tab sync regression (#166)
 * ─────────────────────────────────
 * Zustand 4's persist middleware writes to localStorage on every mutation but
 * never subscribes to the browser 'storage' event.  A change in Tab A writes
 * the new state to localStorage, but Tab B's in-memory store remains stale
 * until the user does a hard refresh.
 *
 * The fix: a module-level window.addEventListener('storage', ...) that calls
 * useWishlistStore.persist.rehydrate() when our key is touched by another
 * browsing context.
 *
 * In jsdom, calling localStorage.setItem() directly does NOT fire a 'storage'
 * event (matching real-browser behaviour: the tab that makes the change never
 * receives its own event).  To simulate a foreign-tab write we construct and
 * dispatch a StorageEvent manually, which is exactly what browsers deliver to
 * every other tab that shares the origin.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWishlistStore, useIsWishlisted, useWishlistCount } from './use-wishlist-store';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sorobanlard_wishlist';

/** Build the JSON payload that the persist middleware writes to localStorage. */
function buildPersistedValue(courseIds: string[]): string {
  return JSON.stringify({ state: { courseIds }, version: 0 });
}

/**
 * Simulate a foreign-tab write: update localStorage directly (bypassing
 * Zustand so our tab's store is not updated), then dispatch a StorageEvent
 * exactly as the browser would deliver it to every other open tab.
 */
function simulateForeignTabWrite(courseIds: string[]): void {
  const newValue = buildPersistedValue(courseIds);
  // Write directly so the value is available when rehydrate() reads it.
  localStorage.setItem(STORAGE_KEY, newValue);
  // Dispatch the event — this is what triggers the cross-tab listener.
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: STORAGE_KEY,
      oldValue: localStorage.getItem(STORAGE_KEY),
      newValue,
      storageArea: localStorage,
      url: window.location.href,
    }),
  );
}

function resetStore(): void {
  useWishlistStore.setState({ courseIds: [] });
  useWishlistStore.persist.rehydrate();
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('useWishlistStore', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Basic operations ───────────────────────────────────────────────────────

  describe('toggle', () => {
    it('adds a course id when not wishlisted', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => { result.current.toggle('c-1'); });
      expect(result.current.courseIds).toContain('c-1');
    });

    it('removes a course id when already wishlisted', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => {
        result.current.toggle('c-1');
        result.current.toggle('c-1');
      });
      expect(result.current.courseIds).not.toContain('c-1');
    });
  });

  describe('add', () => {
    it('adds a new course id', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => { result.current.add('c-1'); });
      expect(result.current.courseIds).toHaveLength(1);
    });

    it('is idempotent — does not add duplicates', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => {
        result.current.add('c-1');
        result.current.add('c-1');
      });
      expect(result.current.courseIds).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('removes the specified id', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => {
        result.current.add('c-1');
        result.current.add('c-2');
        result.current.remove('c-1');
      });
      expect(result.current.courseIds).toEqual(['c-2']);
    });
  });

  describe('clear', () => {
    it('empties the list', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => {
        result.current.add('c-1');
        result.current.add('c-2');
        result.current.clear();
      });
      expect(result.current.courseIds).toHaveLength(0);
    });
  });

  describe('isWishlisted', () => {
    it('returns true only for added ids', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => { result.current.add('c-1'); });
      expect(result.current.isWishlisted('c-1')).toBe(true);
      expect(result.current.isWishlisted('c-99')).toBe(false);
    });
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('writes courseIds to localStorage on mutation', () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => { result.current.add('c-1'); });

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.state.courseIds).toContain('c-1');
    });

    it('restores state after a simulated hard refresh', async () => {
      const { result } = renderHook(() => useWishlistStore());
      act(() => {
        result.current.add('c-1');
        result.current.add('c-2');
      });

      const snapshot = localStorage.getItem(STORAGE_KEY);
      useWishlistStore.setState({ courseIds: [] });
      localStorage.setItem(STORAGE_KEY, snapshot!);
      await useWishlistStore.persist.rehydrate();

      const { result: after } = renderHook(() => useWishlistStore());
      expect(after.current.courseIds).toEqual(['c-1', 'c-2']);
    });
  });

  // ── Cross-tab sync regression (#166) ──────────────────────────────────────
  //
  // Scenario reproduced
  // ───────────────────
  // Before the fix: Tab B's store holds ['c-1']. Tab A adds 'c-2' and writes
  // the new state to localStorage, but Tab B's in-memory store still shows
  // only ['c-1'] because Zustand never listens for 'storage' events.
  //
  // Fix verification
  // ────────────────
  // The module registers a window 'storage' listener.  When a StorageEvent
  // arrives for our key, it calls persist.rehydrate(), which reads the new
  // value from localStorage and replaces the stale in-memory state.

  describe('cross-tab synchronisation (issue #166)', () => {
    it('reproduces the drift: without a storage event the store stays stale', () => {
      // Start with 'c-1' in the store (Tab B's current state).
      useWishlistStore.setState({ courseIds: ['c-1'] });

      // Tab A writes 'c-2' directly to localStorage without touching Tab B's
      // in-memory Zustand store — no StorageEvent dispatched.
      localStorage.setItem(STORAGE_KEY, buildPersistedValue(['c-1', 'c-2']));

      // Tab B's store is still stale.
      expect(useWishlistStore.getState().courseIds).toEqual(['c-1']);
    });

    it('rehydrates the store when another tab adds a course', async () => {
      // Tab B starts with an empty wishlist.
      const { result } = renderHook(() => useWishlistStore());
      expect(result.current.courseIds).toEqual([]);

      // Tab A adds 'c-1' and 'c-2'.
      await act(async () => {
        simulateForeignTabWrite(['c-1', 'c-2']);
      });

      expect(result.current.courseIds).toEqual(['c-1', 'c-2']);
    });

    it('rehydrates when another tab removes a course', async () => {
      // Tab B has two courses wishlisted.
      useWishlistStore.setState({ courseIds: ['c-1', 'c-2'] });

      // Tab A removes 'c-1'.
      await act(async () => {
        simulateForeignTabWrite(['c-2']);
      });

      expect(useWishlistStore.getState().courseIds).toEqual(['c-2']);
    });

    it('rehydrates to an empty list when another tab clears the wishlist', async () => {
      useWishlistStore.setState({ courseIds: ['c-1', 'c-2', 'c-3'] });

      await act(async () => {
        simulateForeignTabWrite([]);
      });

      expect(useWishlistStore.getState().courseIds).toHaveLength(0);
    });

    it('handles a Storage.clear() from another tab (event.key is null) without throwing', async () => {
      // When a foreign tab calls Storage.clear(), the browser delivers a
      // StorageEvent with key === null.  After the clear there is nothing in
      // localStorage, so rehydrate() merges undefined into the current state
      // and leaves it unchanged — but the listener must not throw.
      useWishlistStore.setState({ courseIds: ['c-1'] });

      // Wipe storage (simulates the foreign clear) and dispatch the null-key event.
      localStorage.clear();

      await act(async () => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: null,
            oldValue: null,
            newValue: null,
            storageArea: localStorage,
            url: window.location.href,
          }),
        );
      });

      // rehydrate() found no data for our key, so it merges nothing and the
      // store retains its current courseIds rather than crashing.
      expect(useWishlistStore.getState().courseIds).toBeDefined();
    });

    it('ignores storage events for unrelated keys', async () => {
      useWishlistStore.setState({ courseIds: ['c-1'] });

      await act(async () => {
        // Write an unrelated key and dispatch a storage event for it.
        localStorage.setItem('some_other_key', '{}');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'some_other_key',
            oldValue: null,
            newValue: '{}',
            storageArea: localStorage,
            url: window.location.href,
          }),
        );
      });

      // Store must be unchanged.
      expect(useWishlistStore.getState().courseIds).toEqual(['c-1']);
    });

    it('keeps both tabs consistent through a sequence of foreign-tab operations', async () => {
      const { result } = renderHook(() => useWishlistStore());

      // Step 1 — Tab A adds courses.
      await act(async () => { simulateForeignTabWrite(['c-1', 'c-2', 'c-3']); });
      expect(result.current.courseIds).toEqual(['c-1', 'c-2', 'c-3']);

      // Step 2 — Tab A removes one.
      await act(async () => { simulateForeignTabWrite(['c-1', 'c-3']); });
      expect(result.current.courseIds).toEqual(['c-1', 'c-3']);

      // Step 3 — Tab A clears the wishlist.
      await act(async () => { simulateForeignTabWrite([]); });
      expect(result.current.courseIds).toHaveLength(0);
    });
  });

  // ── Derived hooks ──────────────────────────────────────────────────────────

  describe('useIsWishlisted', () => {
    it('returns false when hydrated but course is not in the list', () => {
      useWishlistStore.setState({ courseIds: [] });
      const { result } = renderHook(() => useIsWishlisted('c-1'));
      // useWishlistHydrated waits for the effect; advance past it.
      act(() => {});
      expect(result.current).toBe(false);
    });

    it('reflects a cross-tab add via storage event', async () => {
      const { result } = renderHook(() => useIsWishlisted('c-1'));
      act(() => {});
      expect(result.current).toBe(false);

      await act(async () => { simulateForeignTabWrite(['c-1']); });

      expect(result.current).toBe(true);
    });
  });

  describe('useWishlistCount', () => {
    it('reflects a cross-tab add via storage event', async () => {
      const { result } = renderHook(() => useWishlistCount());
      act(() => {});
      expect(result.current).toBe(0);

      await act(async () => { simulateForeignTabWrite(['c-1', 'c-2']); });

      expect(result.current).toBe(2);
    });
  });
});
