import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Course } from '@/types';
import NewReleasesPage from './page';

const { list } = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@/lib/api/services', () => ({
  coursesApi: { list },
}));

vi.mock('@/components/courses/CourseCard', () => ({
  CourseCard: ({ course }: { course: Course }) => <article>{course.title}</article>,
}));

vi.mock('@/components/courses/CourseCardSkeleton', () => ({
  CourseCardSkeleton: () => <div data-testid="course-skeleton" />,
}));

vi.mock('@/components/ui/Pagination', () => ({ Pagination: () => null }));

describe('New releases page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders recent releases newest first and filters by category', async () => {
    const now = Date.now();
    const courses = [
      {
        id: 'course-1',
        title: 'Recent Baking',
        category: 'Baking',
        publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'course-2',
        title: 'Recent Photography',
        category: 'Photography',
        publishedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'course-3',
        title: 'Older Baking',
        category: 'Baking',
        publishedAt: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ] as Course[];
    list.mockResolvedValue({
      data: courses,
      meta: { total: courses.length, page: 1, limit: 100, totalPages: 1 },
    });

    render(<NewReleasesPage />);

    expect(screen.getByRole('heading', { name: 'New Releases' })).toBeInTheDocument();
    expect(await screen.findByText('2 courses found')).toBeInTheDocument();
    expect(screen.queryByText('Older Baking')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baking' })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 100 });

    const courseCards = screen.getAllByRole('article');
    expect(within(courseCards[0]).getByText('Recent Photography')).toBeInTheDocument();
    expect(within(courseCards[1]).getByText('Recent Baking')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Baking' }));

    expect(await screen.findByText('1 course found')).toBeInTheDocument();
    expect(screen.getByText('Recent Baking')).toBeInTheDocument();
    expect(screen.queryByText('Recent Photography')).not.toBeInTheDocument();
  });

  it('shows an error state when loading new releases fails', async () => {
    list.mockRejectedValue(new Error('Request failed'));

    render(<NewReleasesPage />);

    expect(await screen.findByRole('heading', { name: 'Unable to load new releases' }))
      .toBeInTheDocument();
    expect(screen.getByText('Please try again later.')).toBeInTheDocument();
  });
});