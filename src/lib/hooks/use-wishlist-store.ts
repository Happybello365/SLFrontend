'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = 'sorobanlard_wishlist';

interface WishlistStore {
  courseIds: string[];
  toggle:       (courseId: string) => void;
  add:          (courseId: string) => void;
  remove:       (courseId: string) => void;
  isWishlisted: (courseId: string) => boolean;
  clear:        () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      courseIds: [],

      toggle: (courseId) => {
        set((state) => ({
          courseIds: state.courseIds.includes(courseId)
            ? state.courseIds.filter((id) => id !== courseId)
            : [...state.courseIds, courseId],
        }));
      },

      add: (courseId) => {
        set((state) => (
          state.courseIds.includes(courseId)
            ? state
            : { courseIds: [...state.courseIds, courseId] }
        ));
      },

      remove: (courseId) => {
        set((state) => ({
          courseIds: state.courseIds.filter((id) => id !== courseId),
        }));
      },

      isWishlisted: (courseId) => get().courseIds.includes(courseId),

      clear: () => set({ courseIds: [] }),
    }),
    {
      name: STORAGE_KEY,
      // createJSONStorage swallows the ReferenceError on the server, so persistence
      // simply stays inert until the store reaches the browser.
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ courseIds: state.courseIds }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Cross-tab synchronisation
//
// Zustand 4's persist middleware writes to localStorage but never subscribes
// to the browser 'storage' event, so a toggle made in Tab A is invisible to
// Tab B's in-memory store until the user does a hard refresh.
//
// We register a single module-level listener that calls rehydrate() whenever
// another browsing context writes to (or clears) our key.  Attaching at
// module load — not inside a component effect — means the listener lives for
// the full lifetime of the page, independent of which components are mounted.
//
// 'storage' events are only dispatched to *other* windows/tabs that share the
// same origin, so this callback never fires for the tab that made the change.
//
// Guard: typeof window check keeps this inert in SSR and in test environments
// that do not expose a global window object.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    // event.key is null when Storage.clear() is called; treat that as a
    // signal to rehydrate too, since it would wipe our persisted key.
    if (event.key === null || event.key === STORAGE_KEY) {
      useWishlistStore.persist.rehydrate();
    }
  });
}

/**
 * True once the persisted wishlist has been read back from localStorage.
 *
 * Server-rendered markup can never know what is in localStorage, so anything
 * driven by the wishlist must render its empty state first and fill in after
 * hydration — otherwise React discards the mismatched client render.
 */
export function useWishlistHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useWishlistStore.persist.onFinishHydration(() => setHydrated(true));
    // Hydration is synchronous for localStorage, so it has usually already
    // finished by the time this effect runs and the subscription above missed it.
    if (useWishlistStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, []);

  return hydrated;
}

/** Hydration-safe read of a single course's wishlist state. */
export function useIsWishlisted(courseId: string): boolean {
  const hydrated = useWishlistHydrated();
  const wishlisted = useWishlistStore((state) => state.courseIds.includes(courseId));
  return hydrated && wishlisted;
}

/** Hydration-safe wishlist size, for badges and counters. */
export function useWishlistCount(): number {
  const hydrated = useWishlistHydrated();
  const count = useWishlistStore((state) => state.courseIds.length);
  return hydrated ? count : 0;
}
