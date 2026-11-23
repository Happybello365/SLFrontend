import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReviewsList from './ReviewsList';

const reviews = [
  {
    id: 'review-1',
    reviewer: { name: 'Ada Okafor' },
    rating: 5,
    date: '2026-01-10',
    comment: 'Clear lessons and practical exercises.',
    helpfulCount: 3,
  },
  {
    id: 'review-2',
    reviewer: { name: 'Tunde Bello' },
    rating: 4,
    date: '2026-01-05',
    comment: 'Good pace throughout.',
    helpfulCount: 1,
  },
];

describe('ReviewsList component states', () => {
  it('renders a loading state instead of the list while reviews are fetching', () => {
    render(<ReviewsList reviews={[]} isLoading />);

    expect(screen.getByTestId('reviews-loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Loading reviews/i);
    expect(screen.queryByTestId('reviews-empty')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Most Helpful' })).not.toBeInTheDocument();
  });

  it('renders an error state with the failure message and a retry action', () => {
    const onRetry = vi.fn();

    render(<ReviewsList reviews={[]} error="Network offline" onRetry={onRetry} />);

    expect(screen.getByTestId('reviews-error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't load reviews/i);
    expect(screen.getByText('Network offline')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry action in the error state when no retry handler is provided', () => {
    render(<ReviewsList reviews={[]} error="Network offline" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try again/i })).not.toBeInTheDocument();
  });

  it('shows the loading state ahead of the error state while a retry is in flight', () => {
    render(<ReviewsList reviews={[]} isLoading error="Network offline" />);

    expect(screen.getByTestId('reviews-loading')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an explicit empty state when a course has no reviews yet', () => {
    render(<ReviewsList reviews={[]} />);

    expect(screen.getByTestId('reviews-empty')).toBeInTheDocument();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    // The rating summary and sort controls only make sense with reviews present.
    expect(screen.queryByRole('option', { name: 'Most Helpful' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the reviews and sort controls once reviews are available', () => {
    render(<ReviewsList reviews={reviews} />);

    expect(screen.getByText('Ada Okafor')).toBeInTheDocument();
    expect(screen.getByText('Tunde Bello')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Most Helpful' })).toBeInTheDocument();
    expect(screen.queryByTestId('reviews-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reviews-error')).not.toBeInTheDocument();
  });

  it('leaves the loading state and shows the list when fetching completes', () => {
    const { rerender } = render(<ReviewsList reviews={[]} isLoading />);

    expect(screen.getByTestId('reviews-loading')).toBeInTheDocument();

    rerender(<ReviewsList reviews={reviews} />);

    expect(screen.queryByTestId('reviews-loading')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Okafor')).toBeInTheDocument();
  });
});
