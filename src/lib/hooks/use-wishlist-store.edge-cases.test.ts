// Additional coverage for #406. The existing use-wishlist-store.test.ts
// already tests basic operations, persistence and cross-tab synchronisation.
// Leave that existing test file intact.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useIsWishlisted,
  useWishlistCount,
  useWishlistHydrated,
  useWishlistStore,
} from './use-wishlist-store';

const STORAGE_KEY = 'sorobanlard_wishlist';

beforeEach(() => {
  act(() => { useWishlistStore.getState().clear(); });
  useWishlistStore.persist.clearStorage();
});

afterEach(() => {
  act(() => { useWishlistStore.getState().clear(); });
  useWishlistStore.persist.clearStorage();
});

describe('Wishlist additional edge cases (#406)', () => {
  it('reports hydrated state after the persisted store has initialized', async () => {
    const { result } = renderHook(() => useWishlistHydrated());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('does not change the wishlist when removing absent or empty IDs', () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.add('course-a');
      result.current.remove('missing');
      result.current.remove('');
    });
    expect(result.current.courseIds).toEqual(['course-a']);
    expect(result.current.isWishlisted('')).toBe(false);
    expect(result.current.isWishlisted('missing')).toBe(false);
  });

  it('toggles one entry without changing other entries or their order', () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.add('course-a');
      result.current.add('course-b');
      result.current.add('course-c');
      result.current.toggle('course-b');
    });
    expect(result.current.courseIds).toEqual(['course-a', 'course-c']);
    act(() => { result.current.toggle('course-b'); });
    expect(result.current.courseIds).toEqual(['course-a', 'course-c', 'course-b']);
  });

  it('persists a cleared wishlist and updates the derived count and membership', async () => {
    const { result: count } = renderHook(() => useWishlistCount());
    const { result: membership } = renderHook(() => useIsWishlisted('course-a'));

    act(() => {
      useWishlistStore.getState().add('course-a');
      useWishlistStore.getState().add('course-b');
    });
    await waitFor(() => expect(count.current).toBe(2));
    expect(membership.current).toBe(true);

    act(() => { useWishlistStore.getState().clear(); });
    expect(count.current).toBe(0);
    expect(membership.current).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').state.courseIds).toEqual([]);
  });
});
