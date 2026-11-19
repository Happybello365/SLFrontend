import { isConnected, signTransaction, requestAccess, getNetwork, getPublicKey } from '@stellar/freighter-api';

/**
 * Thrown when the user explicitly rejects a signing or access request in the
 * Freighter popup. Distinct from generic errors (extension crash, network
 * issue) so callers can offer a "try again" path rather than a hard failure.
 *
 * The Freighter API throws a raw string on rejection rather than an Error
 * object. This class normalises that into a proper Error so it carries a
 * stack trace and works with `instanceof`.
 */
export class UserRejectedError extends Error {
  constructor(detail?: string) {
    super(
      detail
        ? `You rejected the request in Freighter: ${detail}. Click the button again when you are ready to sign.`
        : 'You rejected the request in Freighter. Click the button again when you are ready to sign.',
    );
    this.name = 'UserRejectedError';
  }
}

/**
 * Returns true when the value thrown by a Freighter API call looks like a
 * user-rejection rather than an unexpected error.
 *
 * The library throws a raw string (not an Error) when the user rejects.
 * Known rejection strings from the extension background script include
 * "Transaction was rejected", "User declined access", and similar phrases.
 */
function isRejection(thrown: unknown): boolean {
  const text = typeof thrown === 'string'
    ? thrown
    : thrown instanceof Error ? thrown.message : '';
  return /reject|declin|cancel|denied/i.test(text);
}

/**
 * Wraps any value thrown by a Freighter API call into a proper Error.
 * - Rejection-shaped values become a `UserRejectedError`.
 * - Existing `Error` objects pass through unchanged.
 * - Raw strings and other primitives are wrapped in `Error`.
 */
function normaliseFreighterError(thrown: unknown): Error {
  if (isRejection(thrown)) {
    const detail = typeof thrown === 'string' ? thrown
      : thrown instanceof Error ? thrown.message : undefined;
    return new UserRejectedError(detail);
  }
  if (thrown instanceof Error) return thrown;
  return new Error(typeof thrown === 'string' ? thrown : 'Freighter wallet error');
}

/** Resolves `false` instead of throwing when the Freighter extension is missing or unreachable. */
export async function isFreighterInstalled(): Promise<boolean> {
  try { return await isConnected(); }
  catch { return false; }
}

/**
 * Asks the user to grant this site access to Freighter, then resolves with the public key
 * of the selected account (a `G...` address).
 *
 * Throws `UserRejectedError` when the user clicks "Decline" in the Freighter popup.
 * Other Freighter errors are normalised to `Error` instances.
 */
export async function connectFreighter(): Promise<string> {
  try {
    await requestAccess();
    return getUserAddress();
  } catch (err) {
    throw normaliseFreighterError(err);
  }
}

/** Resolves with the public key (`G...`) of the account currently selected in Freighter. */
export async function getUserAddress(): Promise<string> {
  return await getPublicKey();
}

/** Resolves with the network name Freighter is set to, such as `TESTNET` or `PUBLIC`. */
export async function getWalletNetwork(): Promise<string> {
  return await getNetwork();
}

/**
 * Asks Freighter to sign a transaction envelope (base64 XDR) for `networkPassphrase`.
 * Resolves with the signed XDR.
 *
 * Throws `UserRejectedError` when the user clicks "Reject" in the Freighter popup.
 * Other Freighter errors (extension crash, passphrase mismatch reported by the
 * extension) are normalised to `Error` instances.
 *
 * The passphrase must match the network the transaction was built for.
 */
export async function signTx(xdr: string, networkPassphrase: string): Promise<string> {
  try {
    return await signTransaction(xdr, { networkPassphrase });
  } catch (err) {
    throw normaliseFreighterError(err);
  }
}

/**
 * Signs a one-operation transaction that stores `nonce` under the `sorobanlard_nonce` data key.
 * This proves the user controls the wallet without submitting anything to the network.
 *
 * Resolves with the signed XDR. Throws if `nonce` is longer than 64 bytes, the limit on a
 * `manageData` value.
 *
 * Throws `UserRejectedError` when the user rejects the signing prompt. Other wallet
 * errors propagate as normalised `Error` instances.
 */
export async function signNonce(nonce: string, networkPassphrase: string): Promise<string> {
  const { TransactionBuilder, BASE_FEE, Operation, Account } = await import('@stellar/stellar-sdk');
  const address = await getUserAddress();

  // A minimal sequence-0 account used only to build the nonce transaction;
  // it is never submitted to the network, so the sequence number does not matter.
  const dummyAccount = new Account(address, '0');

  const tx = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.manageData({ name: 'sorobanlard_nonce', value: Buffer.from(nonce) }))
    .setTimeout(30)
    .build();

  return signTx(tx.toXDR(), networkPassphrase);
}
