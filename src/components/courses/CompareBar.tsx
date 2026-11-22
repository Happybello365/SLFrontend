'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X } from 'lucide-react';
import { coursesApi } from '@/lib/api/services';
import { useCompareStore, MAX_COMPARE } from '@/lib/hooks/use-compare-store';
import { cn } from '@/lib/utils';

const BLUR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAHklEQVQI12NgYGD4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==';

type DetailStatus = 'loading' | 'ready' | 'error';

export function CompareBar() {
  const router = useRouter();
  const courses = useCompareStore((state) => state.courses);
  const remove = useCompareStore((state) => state.remove);
  const clear = useCompareStore((state) => state.clear);
  const [detailStatus, setDetailStatus] = useState<Record<string, DetailStatus>>({});
  // Courses whose detail request has already been made, so adding another course
  // does not refetch the ones already loaded.
  const requestedIds = useRef<Set<string>>(new Set());

  const loadDetail = useCallback((courseId: string) => {
    requestedIds.current.add(courseId);
    setDetailStatus((prev) => ({ ...prev, [courseId]: 'loading' }));
    coursesApi
      .get(courseId)
      .then((detail) => {
        setDetailStatus((prev) => ({ ...prev, [courseId]: detail ? 'ready' : 'error' }));
      })
      .catch(() => {
        setDetailStatus((prev) => ({ ...prev, [courseId]: 'error' }));
      });
  }, []);

  useEffect(() => {
    courses.forEach((course) => {
      if (!requestedIds.current.has(course.id)) loadDetail(course.id);
    });
  }, [courses, loadDetail]);

  // An empty selection hides the bar entirely: a sticky bar with nothing to compare
  // would only cover page content.
  if (courses.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-ink-200 shadow-lg z-40">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 overflow-x-auto">
            <span className="text-sm font-semibold text-ink-900 whitespace-nowrap">
              Compare ({courses.length}/{MAX_COMPARE})
            </span>
            <div className="flex gap-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="relative flex items-center gap-2 bg-ink-50 rounded-lg p-2 pr-8"
                >
                  <div className="relative w-16 h-10 rounded overflow-hidden flex-shrink-0">
                    {course.thumbnailUrl ? (
                      <Image
                        src={course.thumbnailUrl}
                        alt={course.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-saffron-100 to-saffron-200">
                        <span className="text-lg">
                          {course.category === 'Tailoring' ? '🧵' :
                           course.category === 'Baking' ? '🍰' :
                           course.category === 'Photography' ? '📷' :
                           course.category === 'Makeup Artistry' ? '💄' :
                           course.category === 'Hairstyling' ? '💇' :
                           course.category === 'Nail Technology' ? '💅' : '🎓'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs text-ink-700 max-w-[120px] truncate">
                      {course.title}
                    </span>
                    {(detailStatus[course.id] ?? 'loading') === 'loading' && (
                      <span role="status" className="block text-[10px] text-ink-400">
                        Loading details...
                      </span>
                    )}
                    {detailStatus[course.id] === 'error' && (
                      <span role="alert" className="flex items-center gap-1 text-[10px] text-red-600 whitespace-nowrap">
                        Couldn&apos;t load details.
                        <button
                          type="button"
                          onClick={() => loadDetail(course.id)}
                          aria-label={`Retry loading ${course.title}`}
                          className="font-semibold underline underline-offset-2 hover:text-red-700"
                        >
                          Retry
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => remove(course.id)}
                    aria-label={`Remove ${course.title} from comparison`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-ink-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-ink-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/compare')}
              className="btn-primary px-6 py-2 text-sm whitespace-nowrap"
            >
              Compare Now
            </button>
            <button
              onClick={clear}
              className="btn-secondary px-4 py-2 text-sm whitespace-nowrap"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
