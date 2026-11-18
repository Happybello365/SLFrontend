import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Pagination } from '@/components/ui/Pagination';

const mockPush = vi.fn();
const mockGet = vi.fn((_key: string) => null);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/courses',
  // toString() must return '' so URLSearchParams(searchParams.toString())
  // builds a clean query string instead of '[object Object]'.
  useSearchParams: () => ({ get: mockGet, toString: () => '' }),
}));

describe('Pagination Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders page numbers correctly for small total counts', () => {
    render(<Pagination currentPage={1} totalPages={5} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('shows ellipsis for large page ranges', () => {
    render(<Pagination currentPage={5} totalPages={10} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 10' })).toBeInTheDocument();
    const ellipsisElements = screen.getAllByText('…');
    expect(ellipsisElements.length).toBeGreaterThan(0);
  });

  it('calculates totalPages from totalItems and itemsPerPage when totalPages is omitted', () => {
    render(<Pagination currentPage={1} totalItems={45} itemsPerPage={10} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument();
  });

  // ── Hide / show ───────────────────────────────────────────────────────────

  it('hides itself (renders null) when there is only one page of results (totalPages <= 1)', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} updateUrl={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides itself (renders null) when totalItems fits on a single page (totalItems <= itemsPerPage)', () => {
    const { container } = render(
      <Pagination currentPage={1} totalItems={7} itemsPerPage={10} updateUrl={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('hides itself (renders null) when totalPages is 0 or totalItems is 0', () => {
    const { container: c1 } = render(<Pagination currentPage={1} totalPages={0} updateUrl={false} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <Pagination currentPage={1} totalItems={0} itemsPerPage={10} updateUrl={false} />,
    );
    expect(c2.firstChild).toBeNull();
  });

  // ── Prev / Next boundaries ────────────────────────────────────────────────

  it('disables Previous button at start boundary', () => {
    render(<Pagination currentPage={1} totalPages={5} updateUrl={false} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });

  it('disables Next button at end boundary', () => {
    render(<Pagination currentPage={5} totalPages={5} updateUrl={false} />);
    expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  // ── aria-current contract ─────────────────────────────────────────────────

  it('active page button has aria-current="page"', () => {
    render(<Pagination currentPage={3} totalPages={5} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
  });

  it('active page button also carries the active visual styling', () => {
    render(<Pagination currentPage={3} totalPages={5} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 3' }).className).toContain('bg-[#7F77DD]');
  });

  it('inactive page buttons do NOT have aria-current', () => {
    render(<Pagination currentPage={3} totalPages={5} updateUrl={false} />);
    // Every rendered page button except page 3 must not have aria-current.
    [1, 2, 4, 5].forEach((page) => {
      expect(screen.getByRole('button', { name: `Page ${page}` })).not.toHaveAttribute('aria-current');
    });
  });

  it('exactly one page button has aria-current="page" at a time', () => {
    render(<Pagination currentPage={2} totalPages={7} updateUrl={false} />);
    const nav = screen.getByRole('navigation');
    const currentButtons = within(nav)
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-current') === 'page');
    expect(currentButtons).toHaveLength(1);
    expect(currentButtons[0]).toHaveAttribute('aria-label', 'Page 2');
  });

  it('aria-current moves to the new page after a controlled re-render', () => {
    const { rerender } = render(<Pagination currentPage={1} totalPages={5} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 2' })).not.toHaveAttribute('aria-current');

    rerender(<Pagination currentPage={2} totalPages={5} updateUrl={false} />);

    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
  });

  it('aria-current is present on page 1 when rendered at the first page', () => {
    render(<Pagination currentPage={1} totalPages={10} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('aria-current is present on the last page when rendered at the last page', () => {
    render(<Pagination currentPage={10} totalPages={10} updateUrl={false} />);
    expect(screen.getByRole('button', { name: 'Page 10' })).toHaveAttribute('aria-current', 'page');
  });

  // ── Nav landmark ──────────────────────────────────────────────────────────

  it('wraps everything in a <nav> landmark with aria-label="Pagination"', () => {
    render(<Pagination currentPage={1} totalPages={5} updateUrl={false} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toBeInTheDocument();
  });

  it('page-number group has role="group" with an accessible name', () => {
    render(<Pagination currentPage={1} totalPages={5} updateUrl={false} />);
    const group = screen.getByRole('group', { name: /page numbers/i });
    expect(group).toBeInTheDocument();
  });

  // ── Mobile status span ────────────────────────────────────────────────────

  it('mobile status span carries aria-live="polite" and aria-atomic="true"', () => {
    render(<Pagination currentPage={3} totalPages={10} updateUrl={false} />);
    // The span is always in the DOM (hidden via CSS on larger screens).
    const span = screen.getByText(/^Page 3 of 10$/);
    expect(span).toHaveAttribute('aria-live', 'polite');
    expect(span).toHaveAttribute('aria-atomic', 'true');
  });

  it('mobile status span reflects the current page number', () => {
    render(<Pagination currentPage={5} totalPages={10} updateUrl={false} />);
    expect(screen.getByText('Page 5 of 10')).toBeInTheDocument();
  });

  it('mobile status span updates when the active page changes via re-render', () => {
    const { rerender } = render(<Pagination currentPage={1} totalPages={5} updateUrl={false} />);
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();

    rerender(<Pagination currentPage={4} totalPages={5} updateUrl={false} />);
    expect(screen.getByText('Page 4 of 5')).toBeInTheDocument();
  });

  // ── Jump-to-page input ────────────────────────────────────────────────────

  it('jump-to-page input is associated with its label via id/htmlFor', () => {
    render(<Pagination currentPage={1} totalPages={10} updateUrl={false} />);
    // getByLabelText traverses the for/id association.
    const input = screen.getByLabelText(/jump to page/i);
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('Go button is labelled and disabled until the input has a value', () => {
    render(<Pagination currentPage={1} totalPages={10} updateUrl={false} />);
    const goBtn = screen.getByRole('button', { name: /go to entered page/i });
    expect(goBtn).toBeDisabled();
  });

  it('clicking Go triggers onPageChange with the entered value', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={10} onPageChange={handlePageChange} updateUrl={false} />,
    );
    const input = screen.getByLabelText(/jump to page/i);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /go to entered page/i }));
    expect(handlePageChange).toHaveBeenCalledWith(7);
  });

  // ── URL sync ──────────────────────────────────────────────────────────────

  it('triggers onPageChange and updates URL search params when a page button is clicked', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={handlePageChange} paramName="page" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(handlePageChange).toHaveBeenCalledWith(2);
    expect(mockPush).toHaveBeenCalledWith('/courses?page=2', { scroll: false });
  });

  // ── Prev / Next interaction ───────────────────────────────────────────────

  it('clicking Next calls onPageChange with activePage + 1', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={handlePageChange} updateUrl={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(handlePageChange).toHaveBeenCalledWith(4);
  });

  it('clicking Previous calls onPageChange with activePage - 1', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={handlePageChange} updateUrl={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /previous page/i }));
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});
