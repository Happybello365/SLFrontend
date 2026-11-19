import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompareStore, MAX_COMPARE } from './use-compare-store';
import type { Course } from '@/types';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const base: Course = {
  id: 'course-1',
  instructorAddress: 'instructor-1',
  title: 'Advanced Tailoring Techniques',
  description: 'Learn professional tailoring',
  category: 'Tailoring',
  level: 'Advanced',
  language: 'English',
  thumbnailUrl: null,
  previewVideoUrl: null,
  price: 49.99,
  platformFeePercent: 10,
  status: 'ACTIVE',
  totalLessons: 25,
  totalDuration: 7200,
  totalEnrollments: 150,
  totalRevenue: 7498.5,
  txHash: null,
  approvedAt: '2024-01-01T00:00:00Z',
  createdAt: '2023-12-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  instructor: { name: 'Jane Doe', stellarAddress: 'instructor-1', avatarUrl: null },
  modules: [],
  _count: { enrollments: 150 },
  rating: 4.8,
  reviewCount: 45,
};

const c1: Course = { ...base, id: 'course-1', title: 'Course 1' };
const c2: Course = { ...base, id: 'course-2', title: 'Course 2' };
const c3: Course = { ...base, id: 'course-3', title: 'Course 3' };
const c4: Course = { ...base, id: 'course-4', title: 'Course 4' };

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetStore() {
  useCompareStore.setState({ courses: [] });
  useCompareStore.persist.rehydrate();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useCompareStore', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Constant ───────────────────────────────────────────────────────────────

  describe('MAX_COMPARE constant', () => {
    it('is exported and equals 3', () => {
      expect(MAX_COMPARE).toBe(3);
    });
  });

  // ── add ────────────────────────────────────────────────────────────────────

  describe('add', () => {
    it('adds a course', () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => { result.current.add(c1); });
      expect(result.current.courses).toHaveLength(1);
      expect(result.current.courses[0].id).toBe('course-1');
    });

    it('does not add a duplicate', () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => {
        result.current.add(c1);
        result.current.add(c1);
      });
      expect(result.current.courses).toHaveLength(1);
    });

    it('allows up to MAX_COMPARE courses', () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => {
        result.current.add(c1);
        result.current.add(c2);
        result.current.add(c3);
      });
      expect(result.current.courses).toHaveLength(MAX_COMPARE);
    });
  });

  // ── Limit enforcement (regression for #165) ───────────────────────────────

  describe('limit enforcement', () => {
    it('silently rejects a (MAX_COMPARE + 1)th add', () => {
      const { result } = renderHook(() => useCompareStore());

      // Fill to the limit.
      act(() => {
        result.current.add(c1);
        result.current.add(c2);
        result.current.add(c3);
      });

      expect(result.current.courses).toHaveLength(MAX_COMPARE);

      // Attempt to add one more — must have no effect.
      act(() => { result.current.add(c4); });

      expect(result.current.courses).toHaveLength(MAX_COMPARE);
      expect(result.current.courses.map((c) => c.id)).not.toContain('course-4');
    });

    it('allows a new add after removing one course from a full list', () => {
      const { result } = renderHook(() => useCompareStore());

      act(() => {
        result.current.add(c1);
        result.current.add(c2);
        result.current.add(c3);
      });

      // Remove one to free a slot.
      act(() => { result.current.remove('course-2'); });
      expect(result.current.courses).toHaveLength(MAX_COMPARE - 1);

      // Now c4 must be accepted.
      act(() => { result.current.add(c4); });
      expect(result.current.courses).toHaveLength(MAX_COMPARE);
      expect(result.current.courses.map((c) => c.id)).toContain('course-4');
    });

    it('never exceeds MAX_COMPARE even after multiple rapid adds', () => {
      const { result } = renderHook(() => useCompareStore());

      // Attempt to add more courses than the limit in a single act block.
      act(() => {
        result.current.add(c1);
        result.current.add(c2);
        result.current.add(c3);
        result.current.add(c4);
        result.current.add({ ...base, id: 'course-5', title: 'Course 5' });
      });

      expect(result.current.courses.length).toBeLessThanOrEqual(MAX_COMPARE);
    });

    it('isAtLimit selector returns true only when courses equals MAX_COMPARE', () => {
      const { result } = renderHook(() =>
        useCompareStore((s) => s.courses.length >= MAX_COMPARE),
      );

      // Empty — not at limit.
      expect(result.current).toBe(false);

      act(() => { useCompareStore.getState().add(c1); });
      expect(result.current).toBe(false);

      act(() => {
        useCompareStore.getState().add(c2);
        useCompareStore.getState().add(c3);
      });
      expect(result.current).toBe(true);

      // After removing one — no longer at limit.
      act(() => { useCompareStore.getState().remove('course-3'); });
      expect(result.current).toBe(false);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the specified course', () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => {
        result.current.add(c1);
        result.current.add(c2);
        result.current.remove('course-1');
      });
      expect(result.current.courses).toHaveLength(1);
      expect(result.current.courses[0].id).toBe('course-2');
    });

    it('is a no-op for an unknown id', () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => { result.current.add(c1); });
      act(() => { result.current.remove('does-not-exist'); });
      expect(result.current.courses).toHaveLength(1);
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('empties the list', () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => {
        result.current.add(c1);
        result.current.add(c2);
        result.current.clear();
      });
      expect(result.current.courses).toHaveLength(0);
    });
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('writes to localStorage on add', () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => { result.current.add(c1); });

      const raw = localStorage.getItem('course-compare-storage');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.state.courses).toHaveLength(1);
      expect(parsed.state.courses[0].id).toBe('course-1');
    });

    it('restores state after a simulated hard refresh', async () => {
      const { result } = renderHook(() => useCompareStore());
      act(() => {
        result.current.add(c1);
        result.current.add(c2);
      });

      const snapshot = localStorage.getItem('course-compare-storage');
      useCompareStore.setState({ courses: [] });
      localStorage.setItem('course-compare-storage', snapshot!);
      await useCompareStore.persist.rehydrate();

      const { result: after } = renderHook(() => useCompareStore());
      expect(after.current.courses).toHaveLength(2);
      expect(after.current.courses.map((c) => c.id)).toEqual(['course-1', 'course-2']);
    });

    it('enforces the limit after rehydrating a full list', async () => {
      // Seed three courses into localStorage directly (simulates a saved session).
      const persisted = {
        state: { courses: [c1, c2, c3] },
        version: 0,
      };
      localStorage.setItem('course-compare-storage', JSON.stringify(persisted));
      await useCompareStore.persist.rehydrate();

      const { result } = renderHook(() => useCompareStore());
      expect(result.current.courses).toHaveLength(MAX_COMPARE);

      // The limit must still be enforced after rehydration.
      act(() => { result.current.add(c4); });
      expect(result.current.courses).toHaveLength(MAX_COMPARE);
      expect(result.current.courses.map((c) => c.id)).not.toContain('course-4');
    });
  });
});
