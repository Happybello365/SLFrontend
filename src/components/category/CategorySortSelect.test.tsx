import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategorySortSelect } from './CategorySortSelect';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('CategorySortSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders select element', () => {
      render(<CategorySortSelect slug="tailoring" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox', { name: /sort courses/i });
      expect(select).toBeInTheDocument();
    });

    it('renders all sort options', () => {
      render(<CategorySortSelect slug="baking" activeSub="" activeSort="popular" />);
      expect(screen.getByRole('option', { name: 'Most Popular' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Highest Rated' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Newest' })).toBeInTheDocument();
    });

    it('renders with correct id attribute', () => {
      render(<CategorySortSelect slug="photography" activeSub="" activeSort="rated" />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select).toHaveAttribute('id', 'cat-sort');
    });

    it('has associated label via htmlFor', () => {
      render(<CategorySortSelect slug="makeup-artistry" activeSub="" activeSort="newest" />);
      const label = screen.getByLabelText(/sort by/i);
      expect(label).toBeInTheDocument();
      expect(label.tagName).toBe('SELECT');
    });

    it('label is visually hidden', () => {
      render(<CategorySortSelect slug="hairstyling" activeSub="" activeSort="popular" />);
      const label = screen.getByText('Sort by');
      expect(label).toHaveClass('sr-only');
    });
  });

  describe('Selected Value', () => {
    it('shows "popular" as selected when activeSort is popular', () => {
      render(<CategorySortSelect slug="nail-technology" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('popular');
    });

    it('shows "rated" as selected when activeSort is rated', () => {
      render(<CategorySortSelect slug="web-development" activeSub="" activeSort="rated" />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('rated');
    });

    it('shows "newest" as selected when activeSort is newest', () => {
      render(<CategorySortSelect slug="business" activeSub="" activeSort="newest" />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('newest');
    });

    it('updates displayed selection when activeSort changes', () => {
      const { rerender } = render(
        <CategorySortSelect slug="culinary-arts" activeSub="" activeSort="popular" />,
      );
      let select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('popular');

      rerender(<CategorySortSelect slug="culinary-arts" activeSub="" activeSort="rated" />);
      select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('rated');
    });
  });

  describe('URL Navigation', () => {
    it('navigates to correct URL when sort option changes', async () => {
      render(<CategorySortSelect slug="fashion-design" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox');

      fireEvent.change(select, { target: { value: 'rated' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/categories/fashion-design?sort=rated');
      });
    });

    it('includes sub parameter when activeSub is provided', async () => {
      render(<CategorySortSelect slug="tailoring" activeSub="beginner" activeSort="popular" />);
      const select = screen.getByRole('combobox');

      fireEvent.change(select, { target: { value: 'newest' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/categories/tailoring?sub=beginner&sort=newest');
      });
    });

    it('does not include sub parameter when activeSub is empty', async () => {
      render(<CategorySortSelect slug="baking" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox');

      fireEvent.change(select, { target: { value: 'rated' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/categories/baking?sort=rated');
      });
    });

    it('preserves sub parameter order in URL', async () => {
      render(<CategorySortSelect slug="photography" activeSub="advanced" activeSort="popular" />);
      const select = screen.getByRole('combobox');

      fireEvent.change(select, { target: { value: 'newest' } });

      await waitFor(() => {
        const callArg = mockPush.mock.calls[0][0];
        expect(callArg).toContain('sub=advanced');
        expect(callArg).toContain('sort=newest');
      });
    });
  });

  describe('User Interaction', () => {
    it('calls router.push when user changes selection', async () => {
      const user = userEvent.setup();
      render(<CategorySortSelect slug="makeup-artistry" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox');

      await user.selectOptions(select, 'rated');

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });
    });

    it('handles rapid selection changes', async () => {
      render(<CategorySortSelect slug="hairstyling" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox');

      fireEvent.change(select, { target: { value: 'rated' } });
      fireEvent.change(select, { target: { value: 'newest' } });
      fireEvent.change(select, { target: { value: 'popular' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Accessibility', () => {
    it('select has aria-label for screen readers', () => {
      render(<CategorySortSelect slug="nail-technology" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox', { name: /sort courses/i });
      expect(select).toHaveAttribute('aria-label', 'Sort courses');
    });

    it('options are semantically correct', () => {
      render(<CategorySortSelect slug="web-development" activeSub="" activeSort="popular" />);
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options.map((opt) => opt.textContent)).toEqual([
        'Most Popular',
        'Highest Rated',
        'Newest',
      ]);
    });

    it('selected option has correct value attribute', () => {
      render(<CategorySortSelect slug="business" activeSub="" activeSort="newest" />);
      const selectedOption = screen.getByRole('option', { name: 'Newest' }) as HTMLOptionElement;
      expect(selectedOption.selected).toBe(true);
    });

    it('unselected options do not have selected attribute', () => {
      render(<CategorySortSelect slug="culinary-arts" activeSub="" activeSort="popular" />);
      const ratedOption = screen.getByRole('option', { name: 'Highest Rated' }) as HTMLOptionElement;
      const newestOption = screen.getByRole('option', { name: 'Newest' }) as HTMLOptionElement;
      expect(ratedOption.selected).toBe(false);
      expect(newestOption.selected).toBe(false);
    });
  });

  describe('Styling', () => {
    it('select has appropriate CSS classes', () => {
      render(<CategorySortSelect slug="fashion-design" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('select');
      expect(select).toHaveClass('text-sm');
      expect(select).toHaveClass('w-auto');
    });

    it('container has shrink-0 class for flex layout', () => {
      const { container } = render(
        <CategorySortSelect slug="tailoring" activeSub="" activeSort="popular" />,
      );
      const flexContainer = container.firstChild;
      expect(flexContainer).toHaveClass('flex-shrink-0');
    });
  });

  describe('URL Building', () => {
    it('correctly builds URL with all parameter combinations', async () => {
      const testCases = [
        { slug: 'photography', activeSub: '', activeSort: 'popular', expected: 'sort=popular' },
        {
          slug: 'makeup-artistry',
          activeSub: 'beginner',
          activeSort: 'rated',
          expected: 'sub=beginner&sort=rated',
        },
        {
          slug: 'hairstyling',
          activeSub: 'advanced',
          activeSort: 'newest',
          expected: 'sub=advanced&sort=newest',
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        const { unmount } = render(
          <CategorySortSelect
            slug={testCase.slug}
            activeSub={testCase.activeSub}
            activeSort={testCase.activeSort}
          />,
        );
        const select = screen.getByRole('combobox');
        const sortValues = ['popular', 'rated', 'newest'];
        const nextSort = sortValues[(sortValues.indexOf(testCase.activeSort) + 1) % 3];
        fireEvent.change(select, { target: { value: nextSort } });

        await waitFor(() => {
          const url = mockPush.mock.calls[0][0];
          expect(url).toContain(nextSort);
        });
        unmount();
      }
    });
  });

  describe('Props Changes', () => {
    it('updates when slug prop changes', () => {
      const { rerender } = render(
        <CategorySortSelect slug="tailoring" activeSub="" activeSort="popular" />,
      );

      rerender(<CategorySortSelect slug="baking" activeSub="" activeSort="popular" />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'rated' } });

      expect(mockPush).toHaveBeenCalledWith('/categories/baking?sort=rated');
    });

    it('updates when activeSub prop changes', () => {
      const { rerender } = render(
        <CategorySortSelect slug="photography" activeSub="" activeSort="popular" />,
      );

      rerender(<CategorySortSelect slug="photography" activeSub="beginner" activeSort="popular" />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'rated' } });

      expect(mockPush).toHaveBeenCalledWith('/categories/photography?sub=beginner&sort=rated');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty slug gracefully', () => {
      render(<CategorySortSelect slug="" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'newest' } });
      expect(mockPush).toHaveBeenCalledWith('/categories/?sort=newest');
    });

    it('handles special characters in slug', () => {
      render(<CategorySortSelect slug="web-dev-123" activeSub="" activeSort="popular" />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'rated' } });
      expect(mockPush).toHaveBeenCalledWith('/categories/web-dev-123?sort=rated');
    });

    it('handles special characters in activeSub', () => {
      render(
        <CategorySortSelect slug="business" activeSub="sub-with-dash" activeSort="popular" />,
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'newest' } });
      expect(mockPush).toHaveBeenCalledWith('/categories/business?sub=sub-with-dash&sort=newest');
    });
  });
});
