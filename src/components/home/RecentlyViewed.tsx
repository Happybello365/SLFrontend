'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CourseCard } from '@/components/courses/CourseCard';
import { coursesApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import {
  clearRecentlyViewed,
  getRecentlyViewed,
  recordRecentlyViewed,
} from '@/lib/recently-viewed';
import type { Course } from '@/types';

export function RecentlyViewedTracker({ courseId }: { courseId: string }) {
  useEffect(() => {
    recordRecentlyViewed(courseId);
  }, [courseId]);
  return null;
}

export function RecentlyViewed() {
  const isConnected = useAuthStore((state) => state.isConnected);
  const rehydrate = useAuthStore((state) => state.rehydrate);
  const [courses, setCourses] = useState<Course[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty' | 'ready'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  const handleRetry = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setCourses([]);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    const entries = getRecentlyViewed();
    if (entries.length === 0) {
      setCourses([]);
      setStatus('empty');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    Promise.all(entries.map(({ courseId }) => coursesApi.get(courseId)))
      .then((results) => {
        if (cancelled) return;
        const validCourses = results.filter((course): course is Course => course !== null && course !== undefined);
        setCourses(validCourses);
        setStatus(validCourses.length > 0 ? 'ready' : 'empty');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCourses([]);
        setStatus('error');
        setErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : 'Unable to load recently viewed courses.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, reloadTick]);

  const handleClear = () => {
    clearRecentlyViewed();
    setCourses([]);
    setStatus('empty');
    setConfirmingClear(false);
  };

  if (!isConnected) return null;

  return (
    <section aria-labelledby="recently-viewed-heading">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="recently-viewed-heading" className="section-heading">Recently viewed</h2>
          <p className="mt-1 text-sm text-ink-400">Pick up where you left off</p>
        </div>
        {status === 'ready' && courses.length > 0 && (
          confirmingClear ? (
            <div className="flex shrink-0 items-center gap-2 text-sm">
              <span className="text-ink-400">Clear history?</span>
              <button
                type="button"
                onClick={handleClear}
                className="font-semibold text-sorobanlard-primary transition-colors hover:underline"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="font-semibold text-ink-400 transition-colors hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="shrink-0 text-sm font-semibold text-ink-400 transition-colors hover:text-sorobanlard-primary"
            >
              Clear
            </button>
          )
        )}
      </div>

      {status === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          data-testid="recently-viewed-loading"
          className="rounded-xl border border-ink-100 bg-white p-6 text-sm text-ink-400"
        >
          Loading your recently viewed courses...
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          data-testid="recently-viewed-error"
          className="flex flex-col items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-6 sm:flex-row sm:items-center"
        >
          <div>
            <p className="text-sm font-semibold text-red-700">Failed to load recently viewed courses</p>
            <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-lg bg-sorobanlard-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'empty' && (
        <div
          data-testid="recently-viewed-empty"
          className="flex flex-col items-start justify-between gap-4 rounded-xl border border-ink-100 bg-white p-6 sm:flex-row sm:items-center"
        >
          <div>
            <p className="text-sm font-semibold text-ink-700">No recently viewed courses yet</p>
            <p className="mt-1 text-xs text-ink-400">
              Courses you explore will show up here so you can jump right back in.
            </p>
          </div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sorobanlard-primary hover:underline"
          >
            Browse courses
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {status === 'ready' && courses.length > 0 && (
        <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 no-scrollbar">
          {courses.map((course) => (
            <div key={course.id} className="w-[72vw] max-w-[280px] shrink-0 snap-start sm:w-[264px]">
              <CourseCard course={course} href={`/courses/${course.id}`} />
            </div>
          ))}
          <Link
            href="/courses"
            className="flex min-h-48 w-44 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-ink-100 bg-white text-sm font-semibold text-sorobanlard-primary transition-colors hover:bg-sorobanlard-lilac"
          >
            See all courses
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
