import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  detectAddressMismatch,
  normaliseAddress,
  useAuthStore,
} from '@/lib/hooks/use-auth-store';

/**
 * Wallet account-switched-mid-session (#212).
 *
 * The auth store exposes two pieces to make this testable without a real
 * Freighter: `detectAddressMismatch` (pure comparison) and
 * `reconcileWalletAddress` (store action). The acceptance criterion
 * "Add a unit/component test mocking the Freighter API response for this
 * case" maps to the latter — we feed what Freighter would return and
 * assert how the store reacts.
 */

const ADDR_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 56 chars
const ADDR_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function hydrateSession(address: string) {
  useAuthStore.setState({
    address,
    token: 't',
    user: null,
    isConnected: true,
    accountMismatch: false,
  });
}

beforeEach(() => {
  useAuthStore.setState({
    address: null,
    token: null,
    user: null,
    isConnected: false,
    accountMismatch: false,
  });
});

describe('normaliseAddress', () => {
  it('returns null for missing input', () => {
    expect(normaliseAddress(null)).toBeNull();
    expect(normaliseAddress(undefined)).toBeNull();
    expect(normaliseAddress('')).toBeNull();
    expect(normaliseAddress('   ')).toBeNull();
  });

  it('upper-cases and trims so case/whitespace does not look like a switch', () => {
    expect(normaliseAddress('  gaaa...  ')).toBe('GAAA...');
  });
});

describe('detectAddressMismatch', () => {
  it('returns false when either side is unknown (wallet locked, not connected yet)', () => {
    expect(detectAddressMismatch(ADDR_A, null)).toBe(false);
    expect(detectAddressMismatch(null, ADDR_A)).toBe(false);
  });

  it('returns false when the two addresses match (case-insensitive)', () => {
    expect(detectAddressMismatch(ADDR_A, ADDR_A.toLowerCase())).toBe(false);
  });

  it('returns true when a different wallet account is active', () => {
    expect(detectAddressMismatch(ADDR_A, ADDR_B)).toBe(true);
  });
});

describe('useAuthStore — account switch detection (#212)', () => {
  it('reconcileWalletAddress with the same address is a no-op', () => {
    hydrateSession(ADDR_A);
    useAuthStore.getState().reconcileWalletAddress(ADDR_A);
    const s = useAuthStore.getState();
    expect(s.accountMismatch).toBe(false);
    expect(s.isConnected).toBe(true);
  });

  it('flips accountMismatch and clears isConnected when Freighter reports a different account', () => {
    hydrateSession(ADDR_A);
    useAuthStore.getState().reconcileWalletAddress(ADDR_B);
    const s = useAuthStore.getState();
    expect(s.accountMismatch).toBe(true);
    expect(s.isConnected).toBe(false);
    // The session address and token are NOT wiped — a user who switches
    // back in Freighter can keep going without re-signing.
    expect(s.address).toBe(ADDR_A);
    expect(s.token).toBe('t');
  });

  it('clearAccountMismatch marks the session active again after re-auth', () => {
    hydrateSession(ADDR_A);
    useAuthStore.getState().reconcileWalletAddress(ADDR_B);
    expect(useAuthStore.getState().accountMismatch).toBe(true);

    useAuthStore.getState().clearAccountMismatch();
    const s = useAuthStore.getState();
    expect(s.accountMismatch).toBe(false);
    expect(s.isConnected).toBe(true);
  });

  it('switching back to the session account auto-clears the mismatch', () => {
    hydrateSession(ADDR_A);
    useAuthStore.getState().reconcileWalletAddress(ADDR_B);
    expect(useAuthStore.getState().accountMismatch).toBe(true);

    // Freighter now reports the original account again — the UI's polling
    // layer will call reconcileWalletAddress with the same address.
    useAuthStore.getState().reconcileWalletAddress(ADDR_A);
    const s = useAuthStore.getState();
    expect(s.accountMismatch).toBe(false);
    expect(s.isConnected).toBe(true);
  });

  it('wallet going silent (returning null) does NOT clear or raise a mismatch', () => {
    hydrateSession(ADDR_A);
    useAuthStore.getState().reconcileWalletAddress(null);
    const s = useAuthStore.getState();
    expect(s.accountMismatch).toBe(false);
    expect(s.isConnected).toBe(true);
  });

  it('logout wipes the mismatch flag along with everything else', () => {
    hydrateSession(ADDR_A);
    useAuthStore.getState().reconcileWalletAddress(ADDR_B);
    expect(useAuthStore.getState().accountMismatch).toBe(true);

    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.accountMismatch).toBe(false);
    expect(s.isConnected).toBe(false);
    expect(s.address).toBeNull();
    expect(s.token).toBeNull();
  });
});

describe('Freighter polling integration shape (#212)', () => {
  it('a mocked Freighter that returns a switched account triggers the mismatch flow', () => {
    const freighter = {
      getPublicKey: vi.fn().mockResolvedValue(ADDR_B),
    };
    hydrateSession(ADDR_A);

    return freighter.getPublicKey().then((reported) => {
      useAuthStore.getState().reconcileWalletAddress(reported);
      expect(useAuthStore.getState().accountMismatch).toBe(true);
    });
  });
});
