/**
 * ToastProvider – live-region announcement tests  (#224)
 *
 * Verifies the ARIA contract that guarantees screen readers are notified of
 * toasts without requiring visual focus:
 *
 *   • Two always-mounted live regions exist: assertive (errors) + polite (rest)
 *   • Both carry aria-atomic="true" so the full message is read as one unit
 *   • error/push-with-role-alert toasts go into the assertive region
 *   • success/warning/info/push-with-role-status toasts go into the polite region
 *   • Each ToastCard carries role + aria-atomic on the card element itself
 *   • The dismiss button is labelled and its icon is decorative (aria-hidden)
 *   • Dismissed toasts are removed from the DOM
 */

import { render, screen, within, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToastContext } from '../ToastProvider';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * A minimal consumer that exposes toast helpers via data-testid buttons so
 * the tests can trigger them without worrying about UI scaffolding.
 */
function ToastTrigger() {
  const toast = useToastContext();
  return (
    <div>
      <button type="button" onClick={() => toast.success({ title: 'Saved', description: 'Changes saved.' })}>
        trigger-success
      </button>
      <button type="button" onClick={() => toast.error({ title: 'Failed', description: 'Something went wrong.' })}>
        trigger-error
      </button>
      <button type="button" onClick={() => toast.warning({ title: 'Heads up', description: 'Check this.' })}>
        trigger-warning
      </button>
      <button type="button" onClick={() => toast.info({ title: 'FYI', description: 'Just so you know.' })}>
        trigger-info
      </button>
      <button
        type="button"
        onClick={() => toast.push({ title: 'Custom alert', variant: 'error', role: 'alert' })}
      >
        trigger-push-alert
      </button>
      <button
        type="button"
        onClick={() => toast.push({ title: 'Custom status', variant: 'info', role: 'status' })}
      >
        trigger-push-status
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ToastProvider>
      <ToastTrigger />
    </ToastProvider>,
  );
}

/** Returns the assertive live-region container. */
function getAssertiveRegion() {
  return document.querySelector('[aria-live="assertive"]') as HTMLElement;
}

/** Returns the polite live-region container. */
function getPoliteRegion() {
  return document.querySelector('[aria-live="polite"]') as HTMLElement;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ToastProvider – live-region semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Region presence and attributes ─────────────────────────────────────────

  it('renders an assertive live region on mount (before any toast)', () => {
    renderProvider();
    const region = getAssertiveRegion();
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders a polite live region on mount (before any toast)', () => {
    renderProvider();
    const region = getPoliteRegion();
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('the two regions are distinct elements', () => {
    renderProvider();
    expect(getAssertiveRegion()).not.toBe(getPoliteRegion());
  });

  // ── Routing by role ────────────────────────────────────────────────────────

  it('error toast appears inside the assertive region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-error')); });
    expect(within(getAssertiveRegion()).getByText('Failed')).toBeInTheDocument();
  });

  it('error toast does NOT appear inside the polite region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-error')); });
    expect(within(getPoliteRegion()).queryByText('Failed')).toBeNull();
  });

  it('success toast appears inside the polite region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-success')); });
    expect(within(getPoliteRegion()).getByText('Saved')).toBeInTheDocument();
  });

  it('success toast does NOT appear inside the assertive region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-success')); });
    expect(within(getAssertiveRegion()).queryByText('Saved')).toBeNull();
  });

  it('warning toast appears inside the polite region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-warning')); });
    expect(within(getPoliteRegion()).getByText('Heads up')).toBeInTheDocument();
  });

  it('info toast appears inside the polite region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-info')); });
    expect(within(getPoliteRegion()).getByText('FYI')).toBeInTheDocument();
  });

  it('push({ role: "alert" }) routes to the assertive region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-push-alert')); });
    expect(within(getAssertiveRegion()).getByText('Custom alert')).toBeInTheDocument();
  });

  it('push({ role: "status" }) routes to the polite region', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-push-status')); });
    expect(within(getPoliteRegion()).getByText('Custom status')).toBeInTheDocument();
  });

  // ── Toast card ARIA attributes ─────────────────────────────────────────────

  it('error toast card carries role="alert" and aria-atomic="true"', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-error')); });
    const card = screen.getByRole('alert');
    expect(card).toHaveAttribute('aria-atomic', 'true');
  });

  it('success toast card carries role="status" and aria-atomic="true"', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-success')); });
    const card = screen.getByRole('status');
    expect(card).toHaveAttribute('aria-atomic', 'true');
  });

  it('toast card renders both title and description', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-error')); });
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  // ── Dismiss button ─────────────────────────────────────────────────────────

  it('dismiss button has aria-label and its icon is aria-hidden', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-success')); });
    const btn = screen.getByRole('button', { name: /dismiss notification/i });
    expect(btn).toHaveAttribute('type', 'button');
    const icon = btn.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('clicking the dismiss button removes the toast from the DOM', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-success')); });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    });
    // Allow the 180 ms exit animation to complete.
    act(() => { vi.advanceTimersByTime(300); });

    expect(screen.queryByText('Saved')).toBeNull();
  });

  // ── Auto-dismiss ───────────────────────────────────────────────────────────

  it('toast is removed automatically after its duration elapses', () => {
    renderProvider();
    act(() => { fireEvent.click(screen.getByText('trigger-info')); });
    expect(screen.getByText('FYI')).toBeInTheDocument();

    // Default duration is 4000 ms + 220 ms exit animation.
    act(() => { vi.advanceTimersByTime(4500); });

    expect(screen.queryByText('FYI')).toBeNull();
  });
});
