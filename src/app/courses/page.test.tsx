import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Course } from '@/types';
import CourseBrowsePage from './page';

const { list, getCategories } = vi.hoisted(() => ({
  list: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock('@/lib/api/services', () => ({
  coursesApi: { list, getCategories },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/courses',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => ({ sentinelRef: { current: null } }),
}));

vi.mock('@/components/courses/CourseCard', () => ({
  CourseCard: ({ course }: { course: Course }) => <article>{course.title}</article>,
}));

vi.mock('@/components/courses/FilterSidebar', () => ({ FilterSidebar: () => null }));
vi.mock('@/components/courses/CompareBar', () => ({ CompareBar: () => null }));
vi.mock('@/components/ui/Pagination', () => ({ Pagination: () => null }));
vi.mock('@/components/skeletons', () => ({
  CourseCardSkeleton: () => <div data-testid="course-skeleton" />,
}));

describe('Courses listing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCategories.mockResolvedValue([]);
  });

  it('renders the listing heading, search CTA, result count, and courses', async () => {
    const course = { id: 'course-1', title: 'Practical Baking' } as Course;
    list.mockResolvedValue({
      data: [course],
      meta: { total: 1, page: 1, limit: 12, totalPages: 1 },
    });

    render(<CourseBrowsePage />);

    expect(screen.getByRole('heading', { name: 'Browse Courses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(await screen.findByText('Practical Baking')).toBeInTheDocument();
    expect(screen.getByText('results')).toBeInTheDocument();
  });

  it('shows the empty state when loading courses fails', async () => {
    list.mockRejectedValue(new Error('Request failed'));

    render(<CourseBrowsePage />);

    expect(await screen.findByText('No courses found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});