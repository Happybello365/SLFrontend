import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentsApi } from '@/lib/api/services';
import type { Enrollment } from '@/types';
import ProgressPage from './page';

vi.mock('@/lib/api/services', () => ({
  enrollmentsApi: { getMy: vi.fn() },
}));

const meta = { total: 0, page: 1, limit: 100, totalPages: 0 };
const enrollment = {
  id: 'enrollment-1',
  studentId: 'student-1',
  courseId: 'course-1',
  amountPaid: 0,
  txHash: null,
  status: 'ACTIVE',
  progressPercent: 50,
  completedAt: null,
  enrolledAt: '2026-01-01T00:00:00.000Z',
  lessonProgress: [],
  course: { id: 'course-1', title: 'Introduction to Design', totalLessons: 10, modules: [] },
} as Enrollment;

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('Learning progress page', () => {
  it('shows its heading and loading indicator while fetching enrollments', () => {
    vi.mocked(enrollmentsApi.getMy).mockReturnValue(new Promise(() => {}));

    render(<ProgressPage />);

    expect(screen.getByRole('heading', { name: 'Learning Progress' })).toBeInTheDocument();
    expect(screen.getByText(/track your journey/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Loading progress')).toBeInTheDocument();
    expect(enrollmentsApi.getMy).toHaveBeenCalledWith(1, 100);
  });

  it('renders an enrollment with progress after the API responds', async () => {
    vi.mocked(enrollmentsApi.getMy).mockResolvedValue({
      data: [enrollment],
      meta: { ...meta, total: 1, totalPages: 1 },
    });

    render(<ProgressPage />);

    expect(await screen.findByText('Introduction to Design')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter courses')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading progress')).not.toBeInTheDocument();
  });

  it('shows the progress empty state when there are no enrollments', async () => {
    vi.mocked(enrollmentsApi.getMy).mockResolvedValue({ data: [], meta });

    render(<ProgressPage />);

    expect(await screen.findByText('No courses match this filter')).toBeInTheDocument();
    expect(screen.getByText('Try another progress category.')).toBeInTheDocument();
  });

  it('stops loading after an API error without crashing the page', async () => {
    const error = new Error('Request failed');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(enrollmentsApi.getMy).mockRejectedValue(error);

    render(<ProgressPage />);

    await waitFor(() => expect(screen.queryByLabelText('Loading progress')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Learning Progress' })).toBeInTheDocument();
    expect(screen.getByText('No courses match this filter')).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith(error);
  });
});
