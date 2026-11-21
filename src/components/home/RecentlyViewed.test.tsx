import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RecentlyViewed } from './RecentlyViewed';
import { recordRecentlyViewed } from '@/lib/recently-viewed';
import { coursesApi } from '@/lib/api/services';

vi.mock('@/lib/hooks/use-auth-store', () => ({
  useAuthStore: (selector: (s: { isConnected: boolean; rehydrate: () => void }) => unknown) =>
    selector({ isConnected: true, rehydrate: vi.fn() }),
}));

vi.mock('@/components/courses/CourseCard', () => ({
  CourseCard: ({ course }: { course: { title: string } }) => <div>{course.title}</div>,
}));

vi.mock('@/lib/api/services', () => ({
  coursesApi: {
    get: vi.fn(),
  },
}));

describe('RecentlyViewed component states', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders an explicit empty state for first-time visitors with no viewing history', () => {
    render(<RecentlyViewed />);

    expect(screen.getByTestId('recently-viewed-empty')).toBeInTheDocument();
    expect(screen.getByText(/No recently viewed courses yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse courses/i })).toHaveAttribute('href', '/courses');
  });

  it('renders a distinct loading state while fetching recently viewed courses', () => {
    recordRecentlyViewed('course-1');
    vi.mocked(coursesApi.get).mockReturnValue(new Promise(() => {}));

    render(<RecentlyViewed />);

    expect(screen.getByTestId('recently-viewed-loading')).toBeInTheDocument();
    expect(screen.getByText(/Loading your recently viewed courses/i)).toBeInTheDocument();
  });

  it('renders an error state with a retry action and reloads when clicked', async () => {
    recordRecentlyViewed('course-1');
    vi.mocked(coursesApi.get)
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce({ id: 'course-1', title: 'Soroban Smart Contracts 101' } as never);

    render(<RecentlyViewed />);

    await waitFor(() => {
      expect(screen.getByTestId('recently-viewed-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Network offline/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

    await waitFor(() => {
      expect(screen.getByText('Soroban Smart Contracts 101')).toBeInTheDocument();
    });
    expect(coursesApi.get).toHaveBeenCalledTimes(2);
  });
});
