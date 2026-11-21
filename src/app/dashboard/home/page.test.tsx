import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardHomePage from './page';

const { getMy, list } = vi.hoisted(() => ({
  getMy: vi.fn(),
  list: vi.fn(),
}));

vi.mock('@/lib/api/services', () => ({
  enrollmentsApi: { getMy },
  coursesApi: { list },
  usersApi: { getMe: vi.fn() },
}));

vi.mock('@/lib/hooks/use-auth-store', () => ({
  useAuthStore: () => ({ user: { name: 'Amina' } }),
}));

vi.mock('@/components/dashboard/OnboardingModal', () => ({ OnboardingModal: () => null }));
vi.mock('@/components/dashboard/StreakTracker', () => ({ StreakTracker: () => null }));
vi.mock('@/components/layout/BottomTabs', () => ({ BottomTabs: () => null }));
vi.mock('@/components/skeletons', () => ({
  QuickStatsSkeleton: () => <div data-testid="quick-stats-skeleton" />,
  ContinueLearningSkeletonList: () => <div data-testid="continue-learning-skeleton" />,
  CourseGridSkeleton: () => <div data-testid="course-grid-skeleton" />,
}));

describe('Dashboard home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the welcome, learning, stats, and recommended-course sections', async () => {
    getMy.mockResolvedValue({
      data: [
        {
          courseId: 'course-1',
          progressPercent: 35,
          status: 'IN_PROGRESS',
          course: { title: 'Tailoring Basics' },
        },
        {
          courseId: 'course-2',
          progressPercent: 100,
          status: 'COMPLETED',
          course: { title: 'Baking at Home' },
        },
      ],
    });
    list.mockResolvedValue({
      data: [{ id: 'course-3', title: 'Street Photography', description: 'Learn the essentials.' }],
    });

    render(<DashboardHomePage />);

    expect(screen.getByRole('heading', { name: 'Welcome back, Amina' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Continue learning' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommended for you' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Courses' })).toHaveAttribute('href', '/dashboard/courses');
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/');
    expect(await screen.findByText('Tailoring Basics')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.queryByText('Baking at Home')).not.toBeInTheDocument();
    expect(await screen.findByText('Street Photography')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View certificates' })).toHaveAttribute(
      'href',
      '/dashboard/certificates',
    );
    expect(getMy).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith({ limit: 6 });
  });

  it('shows empty states and zero stats when dashboard requests fail', async () => {
    getMy.mockRejectedValue(new Error('Enrollment request failed'));
    list.mockRejectedValue(new Error('Course request failed'));

    render(<DashboardHomePage />);

    expect(await screen.findByText('No in-progress courses yet. Start a course to see progress here.'))
      .toBeInTheDocument();
    expect(await screen.findByText('No recommended courses found.')).toBeInTheDocument();
    expect(screen.getByText('Courses')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Certificates')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});