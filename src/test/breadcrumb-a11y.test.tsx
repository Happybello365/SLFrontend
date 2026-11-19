import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/seo', () => ({
  absoluteUrl: (href: string) => `https://example.com${href.startsWith('/') ? href : `/${href}`}`,
}));

import { Breadcrumb } from '@/components/ui/Breadcrumb';

/**
 * Breadcrumb current-page semantics (#217).
 *
 * Trail items are links until the last one, which represents the page
 * the user is on. That final crumb must:
 *   - carry aria-current="page" so SR users hear "current page";
 *   - NOT be rendered as a clickable link, even when an href is supplied;
 *   - be the only element with aria-current="page" in the trail.
 */

describe('Breadcrumb current-page semantics (#217)', () => {
  it('marks the last item with aria-current="page" and renders it as plain text', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Courses', href: '/courses' },
          { label: 'Soroban Basics', href: '/courses/soroban-basics' },
        ]}
      />,
    );

    // The last item is rendered twice (mobile + desktop variants); both must
    // carry aria-current="page".
    const currentCrumbs = screen.getAllByText('Soroban Basics');
    expect(currentCrumbs.length).toBeGreaterThan(0);
    for (const node of currentCrumbs) {
      expect(node).toHaveAttribute('aria-current', 'page');
      // The current page is a <span>, not an <a> — SR/keyboard users must
      // not be able to tab into or click a self-referential link.
      expect(node.tagName.toLowerCase()).toBe('span');
    }
  });

  it('non-current items ARE links and do NOT get aria-current', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Courses', href: '/courses' },
          { label: 'Soroban Basics', href: '/courses/soroban-basics' },
        ]}
      />,
    );

    const homes = screen.getAllByText('Home');
    for (const node of homes) {
      // Trail items are <a href>
      expect(node.tagName.toLowerCase()).toBe('a');
      expect(node).not.toHaveAttribute('aria-current');
    }
  });

  it('the <nav> landmark is labelled so SR users can jump to it', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Here' },
        ]}
      />,
    );

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
    // The current page is present under the nav with aria-current.
    expect(within(nav).getAllByText('Here').length).toBeGreaterThan(0);
  });

  it('still marks the last item as current even when it has an href', () => {
    // A caller may pass href on the last item (e.g. canonical self-link);
    // the component must NOT turn it into an <a> — self-links confuse SR
    // users and waste a tab stop.
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Here', href: '/here' },
        ]}
      />,
    );

    const here = screen.getAllByText('Here');
    for (const node of here) {
      expect(node.tagName.toLowerCase()).toBe('span');
      expect(node).toHaveAttribute('aria-current', 'page');
    }
  });

  it('only one node in the tree carries aria-current="page" per rendered view', () => {
    // Even across the mobile + desktop variants, only the trailing crumb is
    // the current page — not ellipsis, not intermediate items.
    const { container } = render(
      <Breadcrumb
        items={[
          { label: 'A', href: '/a' },
          { label: 'B', href: '/a/b' },
          { label: 'C', href: '/a/b/c' },
          { label: 'D', href: '/a/b/c/d' },
          { label: 'E', href: '/a/b/c/d/e' },
        ]}
      />,
    );

    const currents = container.querySelectorAll('[aria-current="page"]');
    // Two renders (mobile + desktop), one current each = two nodes total.
    expect(currents.length).toBe(2);
    for (const node of currents) {
      expect(node.textContent).toBe('E');
    }
  });

  it('renders nothing for an empty items array (no stray nav landmark)', () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
