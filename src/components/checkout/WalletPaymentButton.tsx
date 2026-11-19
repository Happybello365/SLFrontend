'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js';
import type {
  PaymentMethod,
  PaymentRequest,
  PaymentRequestPaymentMethodEvent,
  StripePaymentRequestButtonElementClickEvent,
} from '@stripe/stripe-js';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { classifyFreighterError } from '@/lib/wallet/freighterErrors';

export const WALLET_CONFIRMATION_TIMEOUT_MS = 45_000;

type Wallet = 'applePay' | 'googlePay';

const WALLET_LABELS: Record<Wallet, string> = {
  applePay: 'Apple Pay',
  googlePay: 'Google Pay',
};

export interface WalletPaymentButtonProps {
  /** Order total in major units (e.g. 49.99), same figure the card form charges. */
  amount: number;
  /** ISO currency code, lower-case as Stripe expects. */
  currency?: string;
  /** Two-letter country of the Stripe account. */
  country?: string;
  /** Line shown on the wallet sheet next to the total. */
  label?: string;
  disabled?: boolean;
  /** Charges the wallet's payment method. Throw to report a failure. */
  confirmPayment: (paymentMethod: PaymentMethod) => Promise<void>;
  onSuccess: (paymentMethod: PaymentMethod) => void;
  onError: (error: unknown) => void;
  /** Fires with `true` when the wallet sheet opens and `false` once it closes. */
  onSheetOpenChange?: (open: boolean) => void;
}

/** Stripe wants the smallest currency unit; every currency we sell in has cents. */
const toMinorUnits = (amount: number) => Math.round(amount * 100);

/**
 * Apple Pay / Google Pay via Stripe's Payment Request Button. Renders nothing
 * until `canMakePayment()` confirms a wallet is set up on this device, so the
 * card form stays the only option everywhere else.
 */
export function WalletPaymentButton({
  amount,
  currency = 'usd',
  country = 'US',
  label = 'SorobanLard courses',
  disabled = false,
  confirmPayment,
  onSuccess,
  onError,
  onSheetOpenChange,
}: WalletPaymentButtonProps) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'insufficient' | 'timeout' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The Payment Request is created once per Stripe instance; later amount
  // changes go through `update()`, so keep the latest values in a ref.
  const latest = useRef({ amount, label, confirmPayment, onSuccess, onError, onSheetOpenChange });
  latest.current = { amount, label, confirmPayment, onSuccess, onError, onSheetOpenChange };

  const setOpen = (open: boolean) => {
    setSheetOpen(open);
    latest.current.onSheetOpenChange?.(open);
  };

  useEffect(() => {
    if (!stripe) return;

    let cancelled = false;
    const request = stripe.paymentRequest({
      country,
      currency,
      total: { label: latest.current.label, amount: toMinorUnits(latest.current.amount) },
      requestPayerName: true,
      requestPayerEmail: true,
      // Only surface the device wallets this feature is about.
      disableWallets: ['link', 'browserCard'],
    });

    request
      .canMakePayment()
      .then((result) => {
        if (cancelled || !result) return;
        const available = (['applePay', 'googlePay'] as const).find((key) => result[key]);
        if (!available) return;
        setWallet(available);
        setPaymentRequest(request);
      })
      .catch(() => {
        // No wallet support is the normal case on most desktops — fall back silently.
      });

    return () => {
      cancelled = true;
      setPaymentRequest(null);
      setWallet(null);
    };
  }, [stripe, country, currency]);

  useEffect(() => {
    paymentRequest?.update({ total: { label, amount: toMinorUnits(amount) } });
  }, [paymentRequest, amount, label]);

  useEffect(() => {
    if (!paymentRequest) return;

    const handlePaymentMethod = async (event: PaymentRequestPaymentMethodEvent) => {
      const { confirmPayment: confirm, onSuccess: succeed, onError: fail } = latest.current;
      setPaymentStatus('pending');
      setStatusMessage('Waiting for the payment to confirm on-chain…');
      confirmationTimer.current = setTimeout(() => {
        setPaymentStatus('timeout');
        setStatusMessage('Confirmation is taking longer than expected. Check Freighter/network activity before retrying.');
        setOpen(false);
        event.complete('fail');
      }, WALLET_CONFIRMATION_TIMEOUT_MS);

      try {
        await confirm(event.paymentMethod);
        if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
        setPaymentStatus('idle');
        setStatusMessage('');
        event.complete('success');
        setOpen(false);
        succeed(event.paymentMethod);
      } catch (error) {
        if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
        const classified = classifyFreighterError(error);
        const raw = classified.cause ?? String(error);
        const insufficient = classified.kind === 'insufficient_balance';
        if (insufficient) {
          setPaymentStatus('insufficient');
          setStatusMessage('Insufficient balance. Top up XLM or USDC in Freighter, then retry.');
        } else if (classified.kind === 'network') {
          setPaymentStatus('timeout');
          setStatusMessage('The network response timed out. Check your connection and retry.');
        } else {
          setPaymentStatus('error');
          setStatusMessage(classified.message);
        }
        event.complete('fail');
        setOpen(false);
        fail(error);
      }
    };
    const handleCancel = () => setOpen(false);

    paymentRequest.on('paymentmethod', handlePaymentMethod);
    paymentRequest.on('cancel', handleCancel);
    return () => {
      paymentRequest.off('paymentmethod', handlePaymentMethod);
      paymentRequest.off('cancel', handleCancel);
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRequest]);

  if (!paymentRequest || !wallet) return null;

  const handleClick = (event: StripePaymentRequestButtonElementClickEvent) => {
    if (disabled || sheetOpen) {
      event.preventDefault();
      return;
    }
    setOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="wallet-payment">
      <div className={disabled && !sheetOpen ? 'pointer-events-none opacity-60' : undefined}>
        <PaymentRequestButtonElement
          options={{
            paymentRequest,
            style: { paymentRequestButton: { type: 'buy', theme: 'dark', height: '48px' } },
          }}
          onClick={handleClick}
        />
      </div>

      {(sheetOpen || paymentStatus === 'pending') && paymentStatus !== 'insufficient' && paymentStatus !== 'timeout' && paymentStatus !== 'error' && (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-ink-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {paymentStatus === 'pending' ? statusMessage : `Waiting for ${WALLET_LABELS[wallet]}…`}
        </p>
      )}

      {paymentStatus !== 'idle' && paymentStatus !== 'pending' && (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{paymentStatus === 'insufficient' ? 'Insufficient balance' : paymentStatus === 'timeout' ? 'Confirmation timeout' : 'Payment could not be completed'}</p>
              <p className="mt-1 text-xs text-red-700">{statusMessage}</p>
              <button
                type="button"
                onClick={() => { setPaymentStatus('idle'); setStatusMessage(''); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try payment again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-500">
        <span className="h-px flex-1 bg-ink-200" aria-hidden="true" />
        or pay with card
        <span className="h-px flex-1 bg-ink-200" aria-hidden="true" />
      </div>
    </div>
  );
}
