/**
 * src/lib/stellar/__tests__/freighter.rejection.test.ts
 *
 * Unit tests for the user-rejection handling added to freighter.ts.
 *
 * The @stellar/freighter-api module is mocked entirely so no browser extension
 * is required. Tests cover:
 *
 *  1. UserRejectedError class contract
 *  2. signTx() – raw-string rejection, Error rejection, generic errors, success
 *  3. connectFreighter() – raw-string rejection, Error rejection, success
 *  4. signNonce() – rejection propagated through signTx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the Freighter API ───────────────────────────────────────────────────
vi.mock('@stellar/freighter-api', () => ({
  isConnected:      vi.fn(),
  signTransaction:  vi.fn(),
  requestAccess:    vi.fn(),
  getNetwork:       vi.fn(),
  getPublicKey:     vi.fn(),
}));

// ─── Mock the Stellar SDK for signNonce ──────────────────────────────────────
vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();

  // Both TransactionBuilder and Account are called with `new`, so they must
  // be real classes, not arrow functions.
  class MockAccount {
    constructor(public id: string, public sequence: string) {}
  }

  const mockTxObj = {
    addOperation: vi.fn().mockReturnThis() as any,
    setTimeout:   vi.fn().mockReturnThis() as any,
    build: vi.fn().mockReturnValue({ toXDR: () => 'mock-xdr' }),
  };

  class MockTransactionBuilder {
    addOperation = vi.fn().mockReturnThis();
    setTimeout   = vi.fn().mockReturnThis();
    build        = vi.fn().mockReturnValue({ toXDR: () => 'mock-xdr' });
  }

  return {
    ...actual,
    TransactionBuilder: MockTransactionBuilder,
    Operation: { manageData: vi.fn() },
    Account: MockAccount,
  };
});

import * as freighterApi from '@stellar/freighter-api';
import {
  UserRejectedError,
  signTx,
  connectFreighter,
  signNonce,
} from '@/lib/stellar/freighter';

const mockSignTransaction = vi.mocked(freighterApi.signTransaction);
const mockRequestAccess   = vi.mocked(freighterApi.requestAccess);
const mockGetPublicKey    = vi.mocked(freighterApi.getPublicKey);

const STUB_PASSPHRASE = 'Test SDF Network ; September 2015';
const STUB_ADDRESS    = 'GCL6KHXPXJTR47SMQQI7IGZBHPK7NRQAXLSJSLOQKGSL35RGOYN2JLUF';
const STUB_SIGNED_XDR = 'AAAAAQAAAAAAAAAA';

// ─── 1. UserRejectedError class ───────────────────────────────────────────────

describe('UserRejectedError', () => {
  it('is an instance of Error', () => {
    expect(new UserRejectedError()).toBeInstanceOf(Error);
  });

  it('has name "UserRejectedError"', () => {
    expect(new UserRejectedError().name).toBe('UserRejectedError');
  });

  it('message mentions "Freighter" and how to retry', () => {
    const msg = new UserRejectedError().message;
    expect(msg).toMatch(/freighter/i);
    expect(msg).toMatch(/again/i);
  });

  it('incorporates the detail string when provided', () => {
    const err = new UserRejectedError('Transaction was rejected');
    expect(err.message).toContain('Transaction was rejected');
  });

  it('has a stack trace', () => {
    expect(new UserRejectedError().stack).toBeDefined();
  });
});

// ─── 2. signTx() ─────────────────────────────────────────────────────────────

describe('signTx()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves with the signed XDR on success', async () => {
    mockSignTransaction.mockResolvedValue(STUB_SIGNED_XDR);

    await expect(signTx('some-xdr', STUB_PASSPHRASE)).resolves.toBe(STUB_SIGNED_XDR);
    expect(mockSignTransaction).toHaveBeenCalledWith('some-xdr', {
      networkPassphrase: STUB_PASSPHRASE,
    });
  });

  it('throws UserRejectedError when the library throws a raw "Transaction was rejected" string', async () => {
    // Freighter API throws a bare string on rejection, not an Error object.
    mockSignTransaction.mockRejectedValue('Transaction was rejected');

    await expect(signTx('xdr', STUB_PASSPHRASE)).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('throws UserRejectedError for the "User declined" string variant', async () => {
    mockSignTransaction.mockRejectedValue('User declined the request');

    await expect(signTx('xdr', STUB_PASSPHRASE)).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('throws UserRejectedError for the "cancel" string variant', async () => {
    mockSignTransaction.mockRejectedValue('Request cancelled by user');

    await expect(signTx('xdr', STUB_PASSPHRASE)).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('throws UserRejectedError when the library throws a rejection-shaped Error object', async () => {
    mockSignTransaction.mockRejectedValue(new Error('Transaction was rejected'));

    await expect(signTx('xdr', STUB_PASSPHRASE)).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('UserRejectedError message includes the detail from the raw string', async () => {
    mockSignTransaction.mockRejectedValue('Transaction was rejected');

    let caught: UserRejectedError | undefined;
    try { await signTx('xdr', STUB_PASSPHRASE); } catch (e) {
      if (e instanceof UserRejectedError) caught = e;
    }
    expect(caught?.message).toContain('Transaction was rejected');
  });

  it('UserRejectedError is also instanceof Error', async () => {
    mockSignTransaction.mockRejectedValue('Transaction was rejected');

    let caught: unknown;
    try { await signTx('xdr', STUB_PASSPHRASE); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(UserRejectedError);
  });

  it('propagates an unrelated Error object unchanged', async () => {
    const unexpected = new Error('RPC timeout');
    mockSignTransaction.mockRejectedValue(unexpected);

    let caught: unknown;
    try { await signTx('xdr', STUB_PASSPHRASE); } catch (e) { caught = e; }

    expect(caught).toBe(unexpected);
    expect(caught).not.toBeInstanceOf(UserRejectedError);
  });

  it('wraps an unrelated raw string in a plain Error', async () => {
    mockSignTransaction.mockRejectedValue('Extension crashed unexpectedly');

    let caught: unknown;
    try { await signTx('xdr', STUB_PASSPHRASE); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(UserRejectedError);
    expect((caught as Error).message).toContain('Extension crashed unexpectedly');
  });
});

// ─── 3. connectFreighter() ────────────────────────────────────────────────────

describe('connectFreighter()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves with the wallet address on success', async () => {
    mockRequestAccess.mockResolvedValue(STUB_ADDRESS);
    mockGetPublicKey.mockResolvedValue(STUB_ADDRESS);

    await expect(connectFreighter()).resolves.toBe(STUB_ADDRESS);
  });

  it('throws UserRejectedError when requestAccess returns a "User declined access" raw string', async () => {
    mockRequestAccess.mockRejectedValue('User declined access');

    await expect(connectFreighter()).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('throws UserRejectedError when requestAccess throws a rejection-shaped Error', async () => {
    mockRequestAccess.mockRejectedValue(new Error('User declined access'));

    await expect(connectFreighter()).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('UserRejectedError from connectFreighter includes retry guidance', async () => {
    mockRequestAccess.mockRejectedValue('User declined access');

    let caught: UserRejectedError | undefined;
    try { await connectFreighter(); } catch (e) {
      if (e instanceof UserRejectedError) caught = e;
    }
    expect(caught?.message).toMatch(/again/i);
  });

  it('wraps an unexpected error from requestAccess in a plain Error', async () => {
    mockRequestAccess.mockRejectedValue('Something else went wrong');

    let caught: unknown;
    try { await connectFreighter(); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(UserRejectedError);
  });
});

// ─── 4. signNonce() – rejection propagated through signTx ────────────────────

describe('signNonce()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('propagates UserRejectedError when signTransaction rejects', async () => {
    mockGetPublicKey.mockResolvedValue(STUB_ADDRESS);
    mockSignTransaction.mockRejectedValue('Transaction was rejected');

    await expect(signNonce('nonce-value', STUB_PASSPHRASE)).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('propagates plain Error from signTransaction unchanged', async () => {
    mockGetPublicKey.mockResolvedValue(STUB_ADDRESS);
    const originalError = new Error('Passphrase mismatch');
    mockSignTransaction.mockRejectedValue(originalError);

    let caught: unknown;
    try { await signNonce('nonce-value', STUB_PASSPHRASE); } catch (e) { caught = e; }

    expect(caught).toBe(originalError);
  });
});
