import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Course } from '@/types';

/** Maximum number of courses that can be compared at once. */
export const MAX_COMPARE = 3;

interface CompareStore {
  courses: Course[];
  add: (course: Course) => void;
  remove: (courseId: string) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      courses: [],

      add: (course) => {
        const { courses } = get();
        if (courses.length >= MAX_COMPARE) return;
        if (courses.some((c) => c.id === course.id)) return;
        set({ courses: [...courses, course] });
      },

      remove: (courseId) => {
        set({ courses: get().courses.filter((c) => c.id !== courseId) });
      },

      clear: () => {
        set({ courses: [] });
      },
    }),
    {
      name: 'course-compare-storage',
    }
  )
);
