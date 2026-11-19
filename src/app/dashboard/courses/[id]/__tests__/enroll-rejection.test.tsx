/**
 * src/app/dashboard/courses/[id]/__tests__/enroll-rejection.test.tsx
 *
 * Component tests for the user-rejection edge case on the course-detail /
 * enrollment page.
 *
 * When the user clicks "Reject" in the Freighter signing popup, enrollInCourse()
 * throws a UserRejectedError.  This suite verifies that the page:
 *   - shows a yellow/amber recoverable-error banner (not a hard red error)
 *   - does NOT navigate away
 *   - re-enables the enroll button so the user can retry
 *   - clears the error banner on the next attempt
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CourseDetailPage from '../page';
import { UserRejectedError } from '@/lib/stellar/freighter';
import { coursesApi, enrollmentsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';

// ─── Route / navigation mocks ─────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter:  () => ({ push: mockPush }),
  useParams:  () => ({ id: 'course-stellar-101' }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: any) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// ─── API mocks ────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services', () => ({
  coursesApi:     { get: vi.fn() },
  enrollmentsApi: { get: vi.fn(), create: vi.fn() },
}));

// ─── Contract mock ────────────────────────────────────────────────────────────
// enrollInCourse is the only contract function called from this page.
// We mock the whole module so individual tests can configure return/reject.
vi.mock('@/lib/stellar/contract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stellar/contract')>();
  return {
    ...actual,
    enrollInCourse: vi.fn(),
  };
});

// ─── UI component mocks ───────────────────────────────────────────────────────

vi.mock('@/components/ui', () => ({
  Breadcrumb: () => <nav aria-label="breadcrumb" />,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { enrollInCourse } from '@/lib/stellar/contract';
const mockEnrollInCourse = vi.mocked(enrollInCourse);

const STUB_ADDRESS = 'GCL6KHXPXJTR47SMQQI7IGZBHPK7NRQAXLSJSLOQKGSL35RGOYN2JLUF';

const STUB_COURSE = {
  id:          'course-stellar-101',
  title:       'Intro to Stellar',
  description: 'Build on Stellar.',
  price:       10,
  category:    'Web Development',
  level:       'Beginner',
  instructor:  { name: 'Alice Dev' },
  modules:     [],
  _count:      { enrollments: 5 },
};

function seedAuth() {
  useAuthStore.setState({
    address:     STUB_ADDRESS,
    token:       'test-token',
    user:        null,
    isConnected: true,
  });
}

async function renderAndWaitForCourse() {
  render(<CourseDetailPage />);
  // Wait for the course title to appear — loading state clears.
  await screen.findByRole('heading', { name: /intro to stellar/i });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Course enrollment – user rejects Freighter signing popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    // Default course load: success
    vi.mocked(coursesApi.get).mockResolvedValue(STUB_COURSE as any);
    // Default enrollment check: not enrolled
    vi.mocked(enrollmentsApi.get).mockRejectedValue(new Error('not found'));
    seedAuth();
  });

  it('shows the enroll button in the initial state', async () => {
    mockEnrollInCourse.mockResolvedValue('tx-hash-ok');
    await renderAndWaitForCourse();

    expect(screen.getByRole('button', { name: /enroll for/i })).toBeInTheDocument();
  });

  it('shows a recoverable error banner when the user rejects the signing popup', async () => {
    mockEnrollInCourse.mockRejectedValue(new UserRejectedError());
    await renderAndWaitForCourse();

    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));

    const banner = await screen.findByTestId('rejected-error');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');
  });

  it('error banner text tells the user to try again', async () => {
    mockEnrollInCourse.mockRejectedValue(new UserRejectedError());
    await renderAndWaitForCourse();

    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));

    const banner = await screen.findByTestId('rejected-error');
    // Message must tell them they rejected and that they can retry.
    expect(banner).toHaveTextContent(/rejected|reject/i);
    expect(banner).toHaveTextContent(/again|retry/i);
  });

  it('does NOT navigate away after a rejection', async () => {
    mockEnrollInCourse.mockRejectedValue(new UserRejectedError());
    await renderAndWaitForCourse();

    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));
    await screen.findByTestId('rejected-error');

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('re-enables the enroll button after rejection so the user can retry', async () => {
    mockEnrollInCourse.mockRejectedValue(new UserRejectedError());
    await renderAndWaitForCourse();

    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));
    await screen.findByTestId('rejected-error');

    expect(screen.getByRole('button', { name: /enroll for/i })).not.toBeDisabled();
  });

  it('clears the rejection banner when the user retries and succeeds', async () => {
    // First attempt: rejected. Second: succeeds.
    mockEnrollInCourse
      .mockRejectedValueOnce(new UserRejectedError())
      .mockResolvedValueOnce('tx-hash-ok');
    vi.mocked(enrollmentsApi.create).mockResolvedValue({} as any);

    await renderAndWaitForCourse();

    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));
    await screen.findByTestId('rejected-error');

    // Retry
    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));

    // Banner must disappear as the new attempt begins / succeeds.
    await waitFor(() =>
      expect(screen.queryByTestId('rejected-error')).not.toBeInTheDocument(),
    );
  });

  it('uses a visually distinct (yellow/amber) style, not the hard-red error style', async () => {
    mockEnrollInCourse.mockRejectedValue(new UserRejectedError());
    await renderAndWaitForCourse();

    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));
    const banner = await screen.findByTestId('rejected-error');

    // The banner must carry yellow/amber Tailwind classes, not the red ones
    // used for unexpected errors.
    expect(banner.className).toMatch(/yellow/);
    expect(banner.className).not.toMatch(/\bred-/);
  });

  it('shows the red error style for unexpected (non-rejection) errors', async () => {
    mockEnrollInCourse.mockRejectedValue(new Error('RPC timeout'));
    await renderAndWaitForCourse();

    await userEvent.click(screen.getByRole('button', { name: /enroll for/i }));
    const banner = await screen.findByTestId('enroll-error');

    expect(banner.className).toMatch(/red/);
  });
});
