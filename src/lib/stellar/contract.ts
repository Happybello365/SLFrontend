/**
 * lib/stellar/contract.ts
 * Soroban contract calls for SorobanLard.
 * Students call enroll() to pay and get access.
 * Instructors call register_course() when submitting for review.
 */

import {
  Networks, SorobanRpc, Contract, TransactionBuilder,
  BASE_FEE, nativeToScVal, xdr, Address,
} from '@stellar/stellar-sdk';
import { getWalletNetwork, signTx, UserRejectedError } from './freighter';

// Re-export so UI components import from one place.
export { UserRejectedError } from './freighter';

const RPC_URL     = process.env.NEXT_PUBLIC_STELLAR_RPC_URL!;
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;
const NETWORK     = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
const PASSPHRASE  = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

/**
 * The expected Freighter network name for the app's configured network.
 * Freighter reports "TESTNET" for testnet and "PUBLIC" for mainnet.
 */
const EXPECTED_FREIGHTER_NETWORK = NETWORK === 'mainnet' ? 'PUBLIC' : 'TESTNET';

/**
 * Thrown when Freighter is set to a different network from the one the app is
 * configured for. This happens most often when a user has Mainnet selected in
 * Freighter while the app is running against Testnet.
 */
export class WrongNetworkError extends Error {
  /** The network Freighter reported (e.g. "PUBLIC"). */
  readonly walletNetwork: string;
  /** The network the app expects (e.g. "TESTNET"). */
  readonly expectedNetwork: string;

  constructor(walletNetwork: string, expectedNetwork: string) {
    const walletLabel    = walletNetwork  === 'PUBLIC' ? 'Mainnet' : walletNetwork;
    const expectedLabel  = expectedNetwork === 'PUBLIC' ? 'Mainnet' : expectedNetwork;
    super(
      `Your Freighter wallet is set to ${walletLabel}, but this app is running on ${expectedLabel}. ` +
      `Open Freighter, switch to ${expectedLabel}, and try again.`,
    );
    this.name             = 'WrongNetworkError';
    this.walletNetwork    = walletNetwork;
    this.expectedNetwork  = expectedNetwork;
  }
}

/**
 * Checks that Freighter is on the same network as the app. Throws
 * `WrongNetworkError` if they don't match so callers can surface a clear
 * message before any transaction is built or signed.
 */
export async function assertCorrectNetwork(): Promise<void> {
  const walletNetwork = await getWalletNetwork();
  // getWalletNetwork() returns values like "TESTNET" or "PUBLIC".
  // Normalise to uppercase for a case-insensitive comparison.
  if (walletNetwork.toUpperCase() !== EXPECTED_FREIGHTER_NETWORK) {
    throw new WrongNetworkError(walletNetwork.toUpperCase(), EXPECTED_FREIGHTER_NETWORK);
  }
}

let _rpc: SorobanRpc.Server;
const getRpc = () => (_rpc ??= new SorobanRpc.Server(RPC_URL, { allowHttp: true }));

async function invokeContract(caller: string, method: string, args: xdr.ScVal[]): Promise<string> {
  // Guard: fail fast and clearly if the wallet is on the wrong network.
  // This check runs before any transaction is built, so Freighter never shows
  // a signing popup that would fail silently with a passphrase mismatch.
  await assertCorrectNetwork();

  const rpc      = getRpc();
  const contract = new Contract(CONTRACT_ID);
  const account  = await rpc.getAccount(caller);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) throw new Error(`Simulation: ${sim.error}`);

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build();
  const signed    = await signTx(assembled.toXDR(), PASSPHRASE);

  const { Transaction } = await import('@stellar/stellar-sdk');
  const resp = await rpc.sendTransaction(new Transaction(signed, PASSPHRASE));
  if (resp.status === 'ERROR') throw new Error('Submission failed');

  return waitForTx(resp.hash);
}

async function waitForTx(hash: string): Promise<string> {
  const rpc = getRpc();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await rpc.getTransaction(hash);
    if (r.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return hash;
    if (r.status === SorobanRpc.Api.GetTransactionStatus.FAILED)
      throw new Error(`Transaction failed: ${hash}`);
  }
  throw new Error('Transaction not confirmed');
}

/**
 * Student enrolls in a course and pays the fee.
 * Payment is split automatically: platform fee to treasury, remainder to instructor.
 *
 * Resolves with the transaction hash once the transaction is confirmed on-chain.
 *
 * Rejects with an `Error` whose message says which step failed:
 * - `WrongNetworkError` when Freighter is on a different network from the app.
 *   The message explains what to do; no signing popup will have been shown.
 * - `UserRejectedError` when the user clicks "Reject" in the Freighter signing
 *   popup. The transaction has not been submitted. The user can retry safely.
 * - `Simulation: <reason>` when the contract rejects the call. Signing has not been requested yet.
 * - `Submission failed` when the RPC server rejects the signed transaction.
 * - `Transaction failed: <hash>` when the transaction is included but fails on-chain.
 * - `Transaction not confirmed` when it is still pending after about 40 seconds. It may still
 *   succeed, so look up the hash before retrying, or the learner could be charged twice.
 *
 * Errors from the wallet (for example the user declining to sign) and from RPC requests
 * propagate unchanged. Throws if `callerAddress` is not a valid Stellar address.
 */
export async function enrollInCourse(params: {
  callerAddress: string;
  courseId: string;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'enroll', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.courseId, { type: 'string' }),
  ]);
}

/**
 * Instructor registers a course on-chain (called before submitting for admin review).
 *
 * `price` is in the token's smallest unit. `platformFeePct` defaults to 0.
 * Resolves with the transaction hash and rejects in the same cases as `enrollInCourse`.
 */
export async function registerCourseOnChain(params: {
  callerAddress: string;
  courseId: string;
  price: bigint;
  tokenAddress: string;
  platformFeePct?: number;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'register_course', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.courseId, { type: 'string' }),
    nativeToScVal(params.price, { type: 'i128' }),
    new Address(params.tokenAddress).toScVal(),
    nativeToScVal(params.platformFeePct ?? 0, { type: 'u32' }),
  ]);
}
