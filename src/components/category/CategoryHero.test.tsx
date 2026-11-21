import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CategoryHero, getCategoryMeta, CATEGORY_META } from './CategoryHero';

describe('CategoryHero', () => {
  describe('Rendering', () => {
    it('renders with known category slug', () => {
      render(<CategoryHero slug="tailoring" courseCount={15} />);
      expect(screen.getByRole('heading', { name: 'Tailoring' })).toBeInTheDocument();
    });

    it('renders category icon emoji', () => {
      render(<CategoryHero slug="baking" courseCount={10} />);
      expect(screen.getByText('🍰')).toBeInTheDocument();
    });

    it('renders category description', () => {
      render(<CategoryHero slug="photography" courseCount={20} />);
      expect(
        screen.getByText(
          /capture stunning images and build a photography business/i,
        ),
      ).toBeInTheDocument();
    });

    it('renders category label', () => {
      render(<CategoryHero slug="makeup-artistry" courseCount={12} />);
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('renders course count with proper pluralization', () => {
      render(<CategoryHero slug="hairstyling" courseCount={5} />);
      expect(screen.getByText('5 courses available')).toBeInTheDocument();
    });

    it('renders course count singular when count is 1', () => {
      render(<CategoryHero slug="nail-technology" courseCount={1} />);
      expect(screen.getByText('1 course available')).toBeInTheDocument();
    });

    it('renders course count plural when count is greater than 1', () => {
      render(<CategoryHero slug="web-development" courseCount={42} />);
      expect(screen.getByText('42 courses available')).toBeInTheDocument();
    });

    it('renders course count with comma for large numbers', () => {
      render(<CategoryHero slug="business" courseCount={1000} />);
      expect(screen.getByText('1,000 courses available')).toBeInTheDocument();
    });

    it('renders with section element for semantic structure', () => {
      const { container } = render(<CategoryHero slug="culinary-arts" courseCount={8} />);
      const section = container.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('renders with proper background gradient based on category', () => {
      const { container } = render(
        <CategoryHero slug="fashion-design" courseCount={25} />,
      );
      const section = container.querySelector('section');
      expect(section).toHaveClass('bg-gradient-to-br');
      expect(section?.className).toMatch(/from-\w+-\d+/);
      expect(section?.className).toMatch(/to-\w+-\d+/);
    });
  });

  describe('getCategoryMeta', () => {
    it('returns metadata for known categories', () => {
      const meta = getCategoryMeta('tailoring');
      expect(meta).toEqual(CATEGORY_META['tailoring']);
      expect(meta.name).toBe('Tailoring');
      expect(meta.icon).toBe('🧵');
    });

    it('returns fallback metadata for unknown category', () => {
      const meta = getCategoryMeta('unknown-category');
      expect(meta.name).toBe('Unknown Category');
      expect(meta.icon).toBe('🎓');
      expect(meta.description).toBe(
        'Explore Unknown Category courses taught by expert instructors.',
      );
    });

    it('converts slug to title case for fallback', () => {
      const meta = getCategoryMeta('creative-writing');
      expect(meta.name).toBe('Creative Writing');
    });

    it('handles single word slug for fallback', () => {
      const meta = getCategoryMeta('music');
      expect(meta.name).toBe('Music');
    });

    it('capitalizes each word in multi-word slugs', () => {
      const meta = getCategoryMeta('digital-marketing');
      expect(meta.name).toBe('Digital Marketing');
    });

    it('provides fallback gradient for unknown categories', () => {
      const meta = getCategoryMeta('some-new-category');
      expect(meta.gradient).toBe('from-sorobanlard-lilac to-saffron-100');
    });
  });

  describe('All Known Categories', () => {
    Object.entries(CATEGORY_META).forEach(([slug, expected]) => {
      it(`renders ${slug} category correctly`, () => {
        render(<CategoryHero slug={slug} courseCount={10} />);
        expect(screen.getByRole('heading', { name: expected.name })).toBeInTheDocument();
        expect(screen.getByText(expected.icon)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has aria-labelledby pointing to heading', () => {
      const { container } = render(<CategoryHero slug="tailoring" courseCount={15} />);
      const section = container.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'category-hero-heading');
    });

    it('heading has matching id attribute', () => {
      render(<CategoryHero slug="baking" courseCount={10} />);
      const heading = screen.getByRole('heading', { name: 'Baking' });
      expect(heading).toHaveAttribute('id', 'category-hero-heading');
    });

    it('category label is uppercase for semantic emphasis', () => {
      render(<CategoryHero slug="photography" courseCount={20} />);
      const label = screen.getByText('Category');
      expect(label).toHaveClass('uppercase');
    });

    it('icon has aria-hidden to avoid redundant announcements', () => {
      const { container } = render(<CategoryHero slug="makeup-artistry" courseCount={12} />);
      const iconDiv = container.querySelector('[aria-hidden="true"]');
      expect(iconDiv).toBeInTheDocument();
      expect(iconDiv?.textContent).toContain('💄');
    });

    it('book icon in course count badge has aria-hidden', () => {
      const { container } = render(<CategoryHero slug="hairstyling" courseCount={5} />);
      const svg = container.querySelector('svg[aria-hidden="true"]');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Visual Hierarchy', () => {
    it('uses font-display class for heading', () => {
      render(<CategoryHero slug="nail-technology" courseCount={1} />);
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('font-display');
    });

    it('applies different text sizes for responsive design', () => {
      render(<CategoryHero slug="web-development" courseCount={42} />);
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('text-2xl');
      expect(heading).toHaveClass('sm:text-3xl');
      expect(heading).toHaveClass('lg:text-4xl');
    });

    it('description text is lighter color', () => {
      render(<CategoryHero slug="business" courseCount={8} />);
      const description = screen.getByText(/grow your entrepreneurial skills/i);
      expect(description).toHaveClass('text-ink-600');
    });
  });

  describe('Course Count Badge Styling', () => {
    it('renders badge with proper styling', () => {
      const { container } = render(<CategoryHero slug="culinary-arts" courseCount={8} />);
      const badge = container.querySelector('div.inline-flex.items-center.gap-2');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-white/70');
      expect(badge).toHaveClass('backdrop-blur-sm');
      expect(badge).toHaveClass('border');
    });

    it('badge displays course count', () => {
      render(<CategoryHero slug="fashion-design" courseCount={25} />);
      expect(screen.getByText('25 courses available')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('uses responsive flex layout', () => {
      const { container } = render(<CategoryHero slug="tailoring" courseCount={15} />);
      const flexContainer = container.querySelector('div.flex.flex-col.sm\\:flex-row');
      expect(flexContainer).toBeInTheDocument();
    });

    it('icon is responsive with different sizes', () => {
      const { container } = render(<CategoryHero slug="baking" courseCount={10} />);
      const iconDiv = container.querySelector('.w-16.h-16');
      expect(iconDiv).toBeInTheDocument();
      expect(iconDiv).toHaveClass('sm:w-20');
      expect(iconDiv).toHaveClass('sm:h-20');
    });

    it('applies padding for responsive spacing', () => {
      const { container } = render(<CategoryHero slug="photography" courseCount={20} />);
      const innerDiv = container.querySelector('div.py-10');
      expect(innerDiv).toBeInTheDocument();
      expect(innerDiv).toHaveClass('sm:py-14');
    });

    it('applies max-width constraint', () => {
      const { container } = render(<CategoryHero slug="makeup-artistry" courseCount={12} />);
      const maxWidthContainer = container.querySelector('div.max-w-7xl');
      expect(maxWidthContainer).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero course count', () => {
      render(<CategoryHero slug="hairstyling" courseCount={0} />);
      expect(screen.getByText('0 courses available')).toBeInTheDocument();
    });

    it('handles very large course count', () => {
      render(<CategoryHero slug="nail-technology" courseCount={999999} />);
      expect(screen.getByText('999,999 courses available')).toBeInTheDocument();
    });

    it('handles category slug with multiple hyphens', () => {
      const meta = getCategoryMeta('very-long-category-name');
      expect(meta.name).toBe('Very Long Category Name');
    });

    it('handles empty string slug fallback', () => {
      const meta = getCategoryMeta('');
      expect(meta.name).toBe('');
      expect(meta.icon).toBe('🎓');
    });
  });

  describe('Border Styling', () => {
    it('renders border bottom separator', () => {
      const { container } = render(<CategoryHero slug="web-development" courseCount={42} />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('border-b');
      expect(section).toHaveClass('border-ink-100');
    });
  });
});
