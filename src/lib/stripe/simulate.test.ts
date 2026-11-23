import type { PaymentMethod } from '@stripe/stripe-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentDeclinedError, simulatePaymentConfirmation } from './simulate';

const paymentMethod = (last4?: string): PaymentMethod =>
  ({ card: last4 === undefined ? null : { last4 } }) as PaymentMethod;

describe('PaymentDeclinedError', () => {
  it('exposes Stripe-style codes and an informative message', () => {
    const error = new PaymentDeclinedError('card_declined', 'insufficient_funds');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'PaymentDeclinedError',
      code: 'card_declined',
      decline_code: 'insufficient_funds',
      message: 'Payment failed: insufficient_funds',
    });
  });

  it('handles errors without a decline code', () => {
    const error = new PaymentDeclinedError('expired_card');
    expect(error.code).toBe('expired_card');
    expect(error.decline_code).toBeUndefined();
    expect(error.message).toBe('Payment failed: expired_card');
  });
});

describe('simulatePaymentConfirmation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('resolves successful payments after the simulated delay', async () => {
    let completed = false;
    const confirmation = simulatePaymentConfirmation(paymentMethod('4242')).then(() => {
      completed = true;
    });

    await vi.advanceTimersByTimeAsync(1199);
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(confirmation).resolves.toBeUndefined();
    expect(completed).toBe(true);
  });

  it.each([
    ['0002', 'card_declined', 'generic_decline'],
    ['9995', 'card_declined', 'insufficient_funds'],
    ['9987', 'card_declined', 'lost_card'],
    ['9979', 'card_declined', 'stolen_card'],
    ['0069', 'expired_card', undefined],
    ['0127', 'incorrect_cvc', undefined],
    ['0119', 'processing_error', undefined],
    ['3220', 'authentication_required', undefined],
  ])('rejects test card ending %s with the right error', async (last4, code, declineCode) => {
    const assertion = expect(simulatePaymentConfirmation(paymentMethod(last4)))
      .rejects.toMatchObject({ name: 'PaymentDeclinedError', code, decline_code: declineCode });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('allows payment methods without card details', async () => {
    const confirmation = simulatePaymentConfirmation(paymentMethod());
    await vi.runAllTimersAsync();
    await expect(confirmation).resolves.toBeUndefined();
  });
});
