/**
 * src/lib/stellar/__tests__/contract.network.test.ts
 *
 * Unit tests for the wrong-network guard in lib/stellar/contract.ts.
 *
 * The Freighter API module is mocked so no browser extension or real network
 * is needed. Each test configures the mock's return value and verifies that
 * assertCorrectNetwork() / enrollInCourse() behave correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock the Freighter wrapper ────────────────────────────────────────────────
// We mock the whole module so individual tests can swap getWalletNetwork's
// resolved value without touching real extension code.
vi.mock('@/lib/stellar/freighter', () => ({
  getWalletNetwork: vi.fn(),
  signTx: vi.fn(),
  getUserAddress: vi.fn(),
  connectFreighter: vi.fn(),
  isFreighterInstalled: vi.fn(),
  signNonce: vi.fn(),
}));

// ─── Mock the Stellar SDK ──────────────────────────────────────────────────────
// invokeContract calls rpc.getAccount, rpc.simulateTransaction, etc.
// We only need them reachable if the network check passes, so we provide
// minimal mocks that keep the import chain happy.
vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: vi.fn().mockImplementation(() => ({
        getAccount: vi.fn().mockResolvedValue({ id: 'G123', sequence: '0', incrementSequenceNumber: vi.fn() }),
        simulateTransaction: vi.fn().mockRejectedValue(new Error('should not reach simulation')),
        sendTransaction: vi.fn(),
        getTransaction: vi.fn(),
      })),
    },
  };
});

import * as freighter from '@/lib/stellar/freighter';
import {
  assertCorrectNetwork,
  enrollInCourse,
  WrongNetworkError,
} from '@/lib/stellar/contract';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockGetWalletNetwork = freighter.getWalletNetwork as ReturnType<typeof vi.fn>;

/** Force the app to look like it is configured for testnet (the default). */
function setAppNetworkTestnet() {
  // The module reads NEXT_PUBLIC_STELLAR_NETWORK at module-load time, but the
  // constants are derived at module scope. We rely on the default ('testnet')
  // being in effect, which is the case because the env variable is not set
  // in the test environment.
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('assertCorrectNetwork()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves when Freighter is on TESTNET and app is testnet', async () => {
    mockGetWalletNetwork.mockResolvedValue('TESTNET');

    // Should not throw.
    await expect(assertCorrectNetwork()).resolves.toBeUndefined();
  });

  it('resolves when Freighter reports lower-case "testnet"', async () => {
    // Freighter sometimes returns lower-case values in certain versions.
    mockGetWalletNetwork.mockResolvedValue('testnet');

    await expect(assertCorrectNetwork()).resolves.toBeUndefined();
  });

  it('throws WrongNetworkError when Freighter is on PUBLIC (Mainnet) and app is testnet', async () => {
    mockGetWalletNetwork.mockResolvedValue('PUBLIC');

    await expect(assertCorrectNetwork()).rejects.toThrow(WrongNetworkError);
  });

  it('WrongNetworkError carries the wallet and expected network', async () => {
    mockGetWalletNetwork.mockResolvedValue('PUBLIC');

    let caughtError: WrongNetworkError | undefined;
    try {
      await assertCorrectNetwork();
    } catch (err) {
      if (err instanceof WrongNetworkError) caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.walletNetwork).toBe('PUBLIC');
    expect(caughtError!.expectedNetwork).toBe('TESTNET');
  });

  it('WrongNetworkError message names both networks and says how to recover', async () => {
    mockGetWalletNetwork.mockResolvedValue('PUBLIC');

    let message = '';
    try {
      await assertCorrectNetwork();
    } catch (err) {
      if (err instanceof WrongNetworkError) message = err.message;
    }

    // The message must mention the wallet network label (Mainnet).
    expect(message).toMatch(/mainnet/i);
    // The message must mention the expected network label (TESTNET).
    expect(message).toMatch(/testnet/i);
    // The message must tell the user what action to take.
    expect(message).toMatch(/open freighter|switch/i);
  });

  it('WrongNetworkError has name "WrongNetworkError"', async () => {
    mockGetWalletNetwork.mockResolvedValue('PUBLIC');

    let errorName = '';
    try {
      await assertCorrectNetwork();
    } catch (err) {
      errorName = (err as Error).name;
    }

    expect(errorName).toBe('WrongNetworkError');
  });

  it('propagates getWalletNetwork errors (e.g. extension unreachable)', async () => {
    const extensionError = new Error('Extension not found');
    mockGetWalletNetwork.mockRejectedValue(extensionError);

    await expect(assertCorrectNetwork()).rejects.toThrow('Extension not found');
  });
});

describe('enrollInCourse() – network guard integration', () => {
  // A valid Stellar G-address (generated from a random keypair, not a real account).
  const VALID_CALLER = 'GCL6KHXPXJTR47SMQQI7IGZBHPK7NRQAXLSJSLOQKGSL35RGOYN2JLUF';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws WrongNetworkError before signing when wallet is on Mainnet', async () => {
    mockGetWalletNetwork.mockResolvedValue('PUBLIC');

    const signTxMock = freighter.signTx as ReturnType<typeof vi.fn>;

    await expect(
      enrollInCourse({ callerAddress: VALID_CALLER, courseId: 'course-1' }),
    ).rejects.toThrow(WrongNetworkError);

    // signTx must NOT have been called — no Freighter popup should have appeared.
    expect(signTxMock).not.toHaveBeenCalled();
  });

  it('is an instance of Error as well as WrongNetworkError', async () => {
    mockGetWalletNetwork.mockResolvedValue('PUBLIC');

    let caughtError: unknown;
    try {
      await enrollInCourse({ callerAddress: VALID_CALLER, courseId: 'course-1' });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError).toBeInstanceOf(WrongNetworkError);
  });
});
