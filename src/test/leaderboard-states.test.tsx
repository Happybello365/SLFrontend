import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';

import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import type { LeaderboardEntry } from '@/types';

/**
 * Distinct loading / error / empty states for the leaderboard (#206).
 *
 * The three states are mutually exclusive and each exposes its own
 * `data-testid` + role so a screen reader and a sighted user can tell
 * them apart without squinting at an unexplained blank panel.
 */

const makeEntry = (over: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  userId: over.userId ?? 'u1',
  rank: over.rank ?? 1,
  name: over.name ?? 'Alice',
  avatarUrl: over.avatarUrl ?? null,
  coursesCompleted: over.coursesCompleted ?? 3,
  hoursLearned: over.hoursLearned ?? 12,
  streakDays: over.streakDays ?? 7,
  // Any extra fields the type defines are optional; cast through unknown
  // keeps the fixture tolerant across repo-level type changes.
}) as LeaderboardEntry;

describe('LeaderboardTable — loading state (#206)', () => {
  it('shows a labelled loading indicator when isLoading is true', () => {
    render(<LeaderboardTable entries={[]} isLoading />);

    expect(screen.getByTestId('leaderboard-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading the leaderboard/i)).toBeInTheDocument();
    // Critically: NOT the empty-state copy.
    expect(screen.queryByTestId('leaderboard-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-error')).not.toBeInTheDocument();
  });
});

describe('LeaderboardTable — error state (#206)', () => {
  it('shows an alert with the error message and a retry button when onRetry is passed', () => {
    const onRetry = vi.fn();
    render(
      <LeaderboardTable
        entries={[]}
        error={new Error('backend offline')}
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByTestId('leaderboard-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/couldn't load the leaderboard/i);
    expect(alert).toHaveTextContent(/backend offline/i);

    const retry = screen.getByRole('button', { name: /retry loading leaderboard/i });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when onRetry is not provided', () => {
    render(<LeaderboardTable entries={[]} error="transient" />);
    expect(screen.getByTestId('leaderboard-error')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /retry loading leaderboard/i }),
    ).not.toBeInTheDocument();
  });

  it('error state is preferred over empty when both would be eligible', () => {
    render(<LeaderboardTable entries={[]} error="boom" />);
    expect(screen.getByTestId('leaderboard-error')).toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-empty')).not.toBeInTheDocument();
  });
});

describe('LeaderboardTable — empty state (#206)', () => {
  it('shows the empty-state copy when there are no entries and no current-user row', () => {
    render(<LeaderboardTable entries={[]} />);

    expect(screen.getByTestId('leaderboard-empty')).toBeInTheDocument();
    expect(
      screen.getByText(/no ranked learners yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-error')).not.toBeInTheDocument();
  });

  it('does not use the empty state when a current-user entry exists (they should see their row)', () => {
    render(
      <LeaderboardTable
        entries={[]}
        currentUserEntry={makeEntry({ userId: 'me', rank: 42, name: 'Me' })}
        currentUserId="me"
      />,
    );
    expect(screen.queryByTestId('leaderboard-empty')).not.toBeInTheDocument();
    expect(screen.getByText('Me')).toBeInTheDocument();
  });
});

describe('LeaderboardTable — data state (#206)', () => {
  it('renders the data table when entries are present', () => {
    render(<LeaderboardTable entries={[makeEntry()]} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-error')).not.toBeInTheDocument();
  });
});
