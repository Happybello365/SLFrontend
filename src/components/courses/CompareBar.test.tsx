import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompareBar } from './CompareBar';
import { useCompareStore } from '@/lib/hooks/use-compare-store';
import { coursesApi } from '@/lib/api/services';
import type { Course } from '@/types';

const mockPush = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('next/image', () => ({
  default: function MockImage({ src, alt }: { src: string; alt: string }) {
    return <img src={src} alt={alt} />;
  },
}));

vi.mock('@/lib/api/services', () => ({
  coursesApi: {
    get: vi.fn(),
  },
}));

const base: Course = {
  id: 'course-1',
  instructorAddress: 'instructor-1',
  title: 'Soroban Basics',
  description: 'Learn smart contracts',
  category: 'Tailoring',
  level: 'Beginner',
  language: 'English',
  thumbnailUrl: null,
  previewVideoUrl: null,
  price: 19.99,
  platformFeePercent: 10,
  status: 'ACTIVE',
  totalLessons: 10,
  totalDuration: 3600,
  totalEnrollments: 20,
  totalRevenue: 399.8,
  txHash: null,
  approvedAt: '2024-01-01T00:00:00Z',
  createdAt: '2023-12-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  instructor: { name: 'Jane Doe', stellarAddress: 'instructor-1', avatarUrl: null },
  modules: [],
  _count: { enrollments: 20 },
  rating: 4.5,
  reviewCount: 8,
};

const course1: Course = { ...base, id: 'course-1', title: 'Soroban Basics' };
const course2: Course = { ...base, id: 'course-2', title: 'Stellar Payments' };

describe('CompareBar', () => {
  beforeEach(() => {
    localStorage.clear();
    useCompareStore.setState({ courses: [] });
    vi.clearAllMocks();
  });

  it('renders nothing when no courses are selected for comparison', () => {
    const { container } = render(<CompareBar />);

    expect(container).toBeEmptyDOMElement();
    expect(coursesApi.get).not.toHaveBeenCalled();
  });

  it('shows a loading state while a compared course detail is being fetched', () => {
    vi.mocked(coursesApi.get).mockReturnValue(new Promise(() => {}));
    useCompareStore.setState({ courses: [course1] });

    render(<CompareBar />);

    expect(screen.getByText('Soroban Basics')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Loading details/i);
    expect(coursesApi.get).toHaveBeenCalledWith('course-1');
  });

  it('clears the loading state once the course detail loads', async () => {
    vi.mocked(coursesApi.get).mockResolvedValue(course1);
    useCompareStore.setState({ courses: [course1] });

    render(<CompareBar />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error state with a retry action when a compared course fails to load', async () => {
    vi.mocked(coursesApi.get).mockRejectedValueOnce(new Error('Network offline'));
    useCompareStore.setState({ courses: [course1] });

    render(<CompareBar />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Couldn't load details/i);
    expect(screen.getByRole('button', { name: 'Retry loading Soroban Basics' })).toBeInTheDocument();
  });

  it('treats an empty detail response as a failed load', async () => {
    vi.mocked(coursesApi.get).mockResolvedValue(null as unknown as Course);
    useCompareStore.setState({ courses: [course1] });

    render(<CompareBar />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't load details/i);
  });

  it('retries the failed course and clears the error when the retry succeeds', async () => {
    vi.mocked(coursesApi.get)
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce(course1);
    useCompareStore.setState({ courses: [course1] });

    render(<CompareBar />);

    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading Soroban Basics' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(coursesApi.get).toHaveBeenCalledTimes(2);
  });

  it('only requests details for newly added courses', async () => {
    vi.mocked(coursesApi.get).mockResolvedValue(course1);
    useCompareStore.setState({ courses: [course1] });

    render(<CompareBar />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    act(() => {
      useCompareStore.getState().add(course2);
    });

    await waitFor(() => {
      expect(coursesApi.get).toHaveBeenCalledTimes(2);
    });
    expect(coursesApi.get).toHaveBeenLastCalledWith('course-2');
  });

  it('removes a course from the comparison without leaving a stale error behind', async () => {
    vi.mocked(coursesApi.get).mockRejectedValueOnce(new Error('Network offline'));
    useCompareStore.setState({ courses: [course1] });

    const { container } = render(<CompareBar />);

    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Soroban Basics from comparison' }));

    expect(container).toBeEmptyDOMElement();
  });

  it('navigates to the compare page when Compare Now is clicked', async () => {
    vi.mocked(coursesApi.get).mockResolvedValue(course1);
    useCompareStore.setState({ courses: [course1] });

    render(<CompareBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Compare Now' }));

    expect(mockPush).toHaveBeenCalledWith('/compare');
  });
});
