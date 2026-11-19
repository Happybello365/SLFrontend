/**
 * Header – mobile-menu accessible-toggle tests
 *
 * Covers the ARIA contract for the hamburger button ↔ mobile-nav-drawer pair:
 *   • aria-expanded reflects open/closed state
 *   • aria-controls points to the drawer's id
 *   • aria-hidden on the drawer mirrors the closed state
 *   • aria-label updates with open/closed state
 *   • drawer carries role="dialog", aria-modal="true", aria-label
 *   • keyboard: Escape closes the drawer and returns focus to the hamburger
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Header } from './Header';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/lib/hooks/use-auth-store', () => ({
  useAuthStore: () => ({ isConnected: false, user: null, logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-cart-store', () => ({
  useCartStore: () => 0,
  useCartHydrated: () => true,
}));

vi.mock('@/lib/api/services', () => ({
  coursesApi: {
    getCategories: () => Promise.resolve([]),
    list: () => Promise.resolve({ data: [] }),
  },
}));

vi.mock('@/components/notifications/NotificationDropdown', () => ({
  NotificationDropdown: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHamburger() {
  return screen.getByRole('button', { name: /open menu/i });
}

function getDrawer() {
  return document.getElementById('mobile-nav-drawer') as HTMLElement;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Header – mobile menu disclosure semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the hamburger as a <button> with type="button"', () => {
    render(<Header />);
    const btn = getHamburger();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('hamburger starts with aria-expanded="false" and aria-label="Open menu"', () => {
    render(<Header />);
    const btn = getHamburger();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveAttribute('aria-label', 'Open menu');
  });

  it('aria-controls on the hamburger resolves to the drawer element', () => {
    render(<Header />);
    const btn = getHamburger();
    const panelId = btn.getAttribute('aria-controls');
    expect(panelId).toBe('mobile-nav-drawer');
    expect(document.getElementById(panelId!)).not.toBeNull();
  });

  it('drawer is in the DOM with role="dialog", aria-modal="true", and aria-label', () => {
    render(<Header />);
    const drawer = getDrawer();
    expect(drawer).toHaveAttribute('role', 'dialog');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveAttribute('aria-label', 'Mobile navigation');
  });

  it('drawer has aria-hidden="true" when the menu is closed', () => {
    render(<Header />);
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true');
  });

  it('opening the menu sets aria-expanded="true", aria-label="Close menu", and removes aria-hidden from drawer', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const hamburger = getHamburger();
    await user.click(hamburger);

    // The hamburger itself flips to "Close menu" with aria-expanded="true".
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    expect(hamburger).toHaveAttribute('aria-label', 'Close menu');
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false');
  });

  it('closing the menu restores aria-expanded="false", aria-label="Open menu", and sets aria-hidden="true"', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const hamburger = getHamburger();

    // Open via hamburger.
    await user.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');

    // Close via hamburger again (it now reads "Close menu").
    await user.click(hamburger);

    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    expect(hamburger).toHaveAttribute('aria-label', 'Open menu');
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true');
  });

  it('Escape key closes the drawer, restores aria-expanded="false", and returns focus to the hamburger', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(getHamburger());
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false');

    await user.keyboard('{Escape}');

    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true');
    expect(getHamburger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(getHamburger());
  });

  it('the drawer contains a close button with aria-label="Close menu"', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(getHamburger());

    const drawer = getDrawer();
    const closeBtn = within(drawer).getByRole('button', { name: /close menu/i });
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn).toHaveAttribute('type', 'button');
  });

  it('mobile category toggle has aria-expanded and aria-controls wired to its panel', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(getHamburger());

    const drawer = getDrawer();
    const catToggle = within(drawer).getByRole('button', { name: /categories/i });
    expect(catToggle).toHaveAttribute('aria-expanded', 'false');
    expect(catToggle).toHaveAttribute('aria-controls', 'mobile-category-menu');

    await user.click(catToggle);
    expect(catToggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('mobile-category-menu')).not.toBeNull();
  });
});
