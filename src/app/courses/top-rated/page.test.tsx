import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Course } from '@/types';
import TopRatedCoursesPage from './page';

const { list, getCategories } = vi.hoisted(() => ({
  list: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock('@/lib/api/services', () => ({
  coursesApi: { list, getCategories },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/courses/top-rated',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/courses/CourseCard', () => ({
  CourseCard: ({ course }: { course: Course }) => <article>{course.title}</article>,
}));

vi.mock('@/components/skeletons', () => ({
  CourseCardSkeleton: () => <div data-testid="course-skeleton" />,
}));
vi.mock('@/components/ui/Pagination', () => ({ Pagination: () => null }));
vi.mock('@/components/courses/CompareBar', () => ({ CompareBar: () => null }));

describe('Top-rated courses page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCategories.mockResolvedValue([{ name: 'Baking', count: 3 }]);
  });

  it('renders top-rated courses in descending rating order', async () => {
    const courses = [
      { id: 'course-1', title: 'Everyday Baking', rating: 4.6 },
      { id: 'course-2', title: 'Advanced Pastry', rating: 4.9 },
      { id: 'course-3', title: 'Kitchen Basics', rating: 4.4 },
    ] as Course[];
    list.mockResolvedValue({ data: courses, meta: { total: 3 } });

    render(<TopRatedCoursesPage />);

    expect(
      screen.getByRole('heading', { name: 'Top Rated Courses on SorobanLard' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Filter by Category' })).toBeInTheDocument();
    expect(await screen.findByText('Advanced Pastry')).toBeInTheDocument();
    expect(screen.getByText('Everyday Baking')).toBeInTheDocument();
    expect(screen.queryByText('Kitchen Basics')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baking (3)' })).toBeInTheDocument();

    const courseCards = screen.getAllByRole('article');
    expect(within(courseCards[0]).getByText('Advanced Pastry')).toBeInTheDocument();
    expect(within(courseCards[1]).getByText('Everyday Baking')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 200 });
  });

  it('shows the empty state when loading top-rated courses fails', async () => {
    list.mockRejectedValue(new Error('Request failed'));

    render(<TopRatedCoursesPage />);

    expect(await screen.findByText('No top-rated courses found')).toBeInTheDocument();
    expect(screen.getByText('Try selecting a different category or check back later.'))
      .toBeInTheDocument();
  });
});