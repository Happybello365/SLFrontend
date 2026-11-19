import { describe, expect, it } from 'vitest';

import { classifyFreighterError } from '@/lib/wallet/freighterErrors';

/**
 * Tests cover every branch of the Freighter error classifier (#208): a
 * rejected signature, a failed on-chain submission, a network error, and
 * a genuinely unknown failure. The classifier is UI-pure — no mocks are
 * needed — so these tests also stand in for the "unit test mocking the
 * Freighter API response for this case" acceptance criterion.
 */

describe('classifyFreighterError — rejected', () => {
  it('matches the Freighter extension "user declined" message', () => {
    const c = classifyFreighterError(new Error('User declined access.'));
    expect(c.kind).toBe('rejected');
    expect(c.retryable).toBe(true);
    expect(c.message).toMatch(/cancelled the signature request/i);
  });

  it('matches the browser-translated cancellation strings', () => {
    for (const msg of ['User cancelled', 'Signature request cancelled']) {
      const c = classifyFreighterError({ message: msg });
      expect(c.kind).toBe('rejected');
    }
  });
});

describe('classifyFreighterError — submission_failed', () => {
  it('maps tx_bad_seq to a submission failure that is not blindly retryable', () => {
    const c = classifyFreighterError(new Error('tx_bad_seq'));
    expect(c.kind).toBe('submission_failed');
    expect(c.retryable).toBe(false);
    expect(c.message).toMatch(/rejected by the network/i);
  });

  it('maps op_underfunded (insufficient XLM) to submission_failed', () => {
    const c = classifyFreighterError({
      message: 'operation failed: op_underfunded',
    });
    expect(c.kind).toBe('submission_failed');
    expect(c.action).toMatch(/top up XLM/i);
  });

  it('maps Horizon-reported errors to submission_failed', () => {
    const c = classifyFreighterError({
      data: { title: 'Horizon rejected tx_failed' },
    });
    expect(c.kind).toBe('submission_failed');
  });
});

describe('classifyFreighterError — network', () => {
  it('matches a fetch-timeout failure', () => {
    const c = classifyFreighterError(new Error('Failed to fetch'));
    expect(c.kind).toBe('network');
    expect(c.retryable).toBe(true);
    expect(c.action).toMatch(/not submitted on-chain/i);
  });

  it('matches a generic request timeout', () => {
    const c = classifyFreighterError(new Error('Request timed out'));
    expect(c.kind).toBe('network');
  });
});

describe('classifyFreighterError — unknown', () => {
  it('falls back to a safe, retryable prompt for anything it does not recognise', () => {
    const c = classifyFreighterError(new Error('zAlpha decoded corrupt payload'));
    expect(c.kind).toBe('unknown');
    expect(c.retryable).toBe(true);
    expect(c.message).toMatch(/something went wrong/i);
  });

  it('handles null/undefined without throwing', () => {
    expect(() => classifyFreighterError(null)).not.toThrow();
    expect(() => classifyFreighterError(undefined)).not.toThrow();
    expect(classifyFreighterError(null).kind).toBe('unknown');
  });

  it('never exposes the raw cause in the user-facing message', () => {
    const c = classifyFreighterError(new Error('leaked-secret-ABC123'));
    expect(c.message).not.toContain('leaked-secret-ABC123');
    // The cause field is present for console/debug use, not for render.
    expect(c.cause).toContain('leaked-secret-ABC123');
  });
});
