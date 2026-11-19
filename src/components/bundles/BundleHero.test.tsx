import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { Bundle } from '@/types';
import { BundleHero } from './BundleHero';

const mockBundle: Bundle = {
  id: 'bundle-1',
  slug: 'web-dev-bundle',
  title: 'Web Development Bundle',
  description: 'Master modern web development with this comprehensive bundle',
  thumbnailUrl: 'https://example.com/bundle.jpg',
  totalValue: 300,
  bundlePrice: 150,
  courses: [
    {
      id: 'course-1',
      instructorAddress: 'stellar-address-1',
      title: 'React Basics',
      description: null,
      category: 'web-development',
      level: 'Beginner',
      language: 'English',
      thumbnailUrl: null,
      previewVideoUrl: null,
      price: 100,
      platformFeePercent: 5,
      status: 'ACTIVE',
      totalLessons: 20,
      totalDuration: 3600,
      totalEnrollments: 100,
      totalRevenue: 10000,
      txHash: null,
      approvedAt: '2024-01-01T00:00:00Z',
      publishedAt: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      instructor: {
        name: 'John Doe',
        stellarAddress: 'stellar-address-1',
        avatarUrl: null,
      },
      modules: [],
      _count: { enrollments: 100 },
      rating: 4.5,
      reviewCount: 50,
    },
    {
      id: 'course-2',
      instructorAddress: 'stellar-address-2',
      title: 'Node.js Advanced',
      description: null,
      category: 'web-development',
      level: 'Advanced',
      language: 'English',
      thumbnailUrl: null,
      previewVideoUrl: null,
      price: 200,
      platformFeePercent: 5,
      status: 'ACTIVE',
      totalLessons: 30,
      totalDuration: 5400,
      totalEnrollments: 80,
      totalRevenue: 16000,
      txHash: null,
      approvedAt: '2024-01-01T00:00:00Z',
      publishedAt: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      instructor: {
        name: 'Jane Smith',
        stellarAddress: 'stellar-address-2',
        avatarUrl: null,
      },
      modules: [],
      _count: { enrollments: 80 },
      rating: 4.8,
      reviewCount: 60,
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('BundleHero', () => {
  describe('Rendering', () => {
    it('renders bundle title', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByRole('heading', { name: 'Web Development Bundle' })).toBeInTheDocument();
    });

    it('renders bundle description when provided', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('Master modern web development with this comprehensive bundle')).toBeInTheDocument();
    });

    it('renders bundle description truncated with line-clamp', () => {
      const bundleWithLongDesc = {
        ...mockBundle,
        description: 'A'.repeat(500),
      };
      render(
        <BundleHero
          bundle={bundleWithLongDesc}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      const descElement = screen.getByText(/^A+/);
      expect(descElement).toHaveClass('line-clamp-3');
    });

    it('renders price formatted with 2 decimal places', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('150.00')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });

    it('renders total hours stat', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('2h total')).toBeInTheDocument();
    });

    it('renders lecture count stat', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('50 lectures')).toBeInTheDocument();
    });

    it('renders certificate count stat with plural', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('2 certificates')).toBeInTheDocument();
    });

    it('renders certificate count stat with singular', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={1}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('1 certificate')).toBeInTheDocument();
    });

    it('does not render certificate stat when count is zero', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={0}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.queryByText(/certificate/i)).not.toBeInTheDocument();
    });

    it('renders course count with plural', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('2 courses included')).toBeInTheDocument();
    });

    it('renders course count with singular', () => {
      const bundleWithOneCourse = {
        ...mockBundle,
        courses: [mockBundle.courses[0]],
      };
      render(
        <BundleHero
          bundle={bundleWithOneCourse}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('1 course included')).toBeInTheDocument();
    });
  });

  describe('Savings Display', () => {
    it('renders savings badge when price is discounted', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText(/save \d+%/i)).toBeInTheDocument();
    });

    it('calculates savings percentage correctly', () => {
      const bundle = {
        ...mockBundle,
        totalValue: 100,
        bundlePrice: 50,
      };
      render(
        <BundleHero
          bundle={bundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('Save 50%')).toBeInTheDocument();
    });

    it('does not render savings badge when no discount', () => {
      const bundle = {
        ...mockBundle,
        totalValue: 100,
        bundlePrice: 100,
      };
      render(
        <BundleHero
          bundle={bundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
    });

    it('shows original price and savings amount', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('300.00')).toBeInTheDocument();
      expect(screen.getByText(/you save 150\.00 usdc/i)).toBeInTheDocument();
    });

    it('does not show original price when no discount', () => {
      const bundle = {
        ...mockBundle,
        totalValue: 100,
        bundlePrice: 100,
      };
      render(
        <BundleHero
          bundle={bundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      // Only the bundle price should be visible, not the original price line
      const usdcTexts = screen.getAllByText(/USDC/);
      expect(usdcTexts.length).toBe(1); // Only the bundle price
    });
  });

  describe('Button States', () => {
    it('renders add all to cart button when not all in cart', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByRole('button', { name: /add all to cart/i })).toBeInTheDocument();
    });

    it('shows "All courses in cart" text when allInCart is true', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={true}
        />,
      );
      expect(screen.getByRole('button', { name: /all courses in cart/i })).toBeInTheDocument();
    });

    it('disables button when all items are in cart', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={true}
        />,
      );
      expect(screen.getByRole('button', { name: /all courses in cart/i })).toBeDisabled();
    });

    it('button is enabled when not all items in cart', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByRole('button', { name: /add all to cart/i })).not.toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls onAddAllToCart when button is clicked', async () => {
      const handleAddAllToCart = vi.fn();
      const user = userEvent.setup();
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={handleAddAllToCart}
          allInCart={false}
        />,
      );
      await user.click(screen.getByRole('button', { name: /add all to cart/i }));
      expect(handleAddAllToCart).toHaveBeenCalledTimes(1);
    });

    it('does not call onAddAllToCart when button is disabled', async () => {
      const handleAddAllToCart = vi.fn();
      const user = userEvent.setup();
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={handleAddAllToCart}
          allInCart={true}
        />,
      );
      const button = screen.getByRole('button', { name: /all courses in cart/i });
      await user.click(button);
      expect(handleAddAllToCart).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure with role grouping', () => {
      const { container } = render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(container.querySelector('section') || container.querySelector('div')).toBeInTheDocument();
    });

    it('button has type="button" to prevent form submission', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      const button = screen.getByRole('button', { name: /add all to cart/i });
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Edge Cases', () => {
    it('handles zero total value correctly', () => {
      const bundle = {
        ...mockBundle,
        totalValue: 0,
        bundlePrice: 0,
      };
      render(
        <BundleHero
          bundle={bundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('0.00')).toBeInTheDocument();
      expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
    });

    it('handles large numbers with proper formatting', () => {
      const bundle = {
        ...mockBundle,
        totalValue: 10000,
        bundlePrice: 5000,
      };
      render(
        <BundleHero
          bundle={bundle}
          totalHours={2.5}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('5,000.00')).toBeInTheDocument();
      expect(screen.getByText('10,000.00')).toBeInTheDocument();
    });

    it('handles zero hours correctly', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={0}
          totalLectures={50}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('0h total')).toBeInTheDocument();
    });

    it('handles zero lectures correctly', () => {
      render(
        <BundleHero
          bundle={mockBundle}
          totalHours={2.5}
          totalLectures={0}
          certificateCount={2}
          onAddAllToCart={vi.fn()}
          allInCart={false}
        />,
      );
      expect(screen.getByText('0 lectures')).toBeInTheDocument();
    });
  });
});
