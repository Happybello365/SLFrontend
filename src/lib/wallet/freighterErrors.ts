/**
 * Freighter transaction-failure classification (#208).
 *
 * Step 3 of instructor course creation signs a Stellar transaction via
 * Freighter. Three failure modes have very different user-facing stories:
 *
 * - **rejected**: the user clicked "Reject" in Freighter. Not an error — a
 *   deliberate choice. Message: "You cancelled the signature request." The
 *   action: open Freighter and try again when ready.
 * - **submission_failed**: the signature was obtained but Horizon or the
 *   Soroban RPC rejected the submitted transaction (insufficient balance,
 *   bad sequence, trustline missing, Soroban invocation returned a contract
 *   error). The action: read the specific operation result and fix the
 *   root cause (top up XLM, re-fetch sequence, etc.).
 * - **network**: the extension never returned (timeout, connection reset,
 *   fetch failure contacting the RPC). The action: check network and
 *   retry; the transaction may or may not have landed.
 *
 * Callers (`instructor/courses/new/page.tsx`, retry banners, toasts) should
 * use {@link classifyFreighterError} once and render on the resulting
 * `kind`. The returned `message` is UI-safe (no private keys, no secret
 * seeds, no raw hashes beyond what Horizon returns publicly).
 */

export type FreighterErrorKind =
  | 'rejected'
  | 'submission_failed'
  | 'network'
  | 'unknown';

export interface ClassifiedFreighterError {
  kind: FreighterErrorKind;
  /** Short, user-facing summary suitable for a toast or inline banner. */
  message: string;
  /** Next-step prompt shown under the summary. */
  action: string;
  /**
   * `true` when retrying the exact same call has a reasonable chance of
   * succeeding (network/rejected). `false` when the user needs to fix
   * something first (insufficient balance, bad sequence).
   */
  retryable: boolean;
  /** The underlying error message — kept for the console, never shown raw. */
  cause?: string;
}

const REJECTED_PATTERNS: RegExp[] = [
  /user (?:declined|denied|rejected)/i,
  /rejected (?:by|in) (?:the )?user/i,
  /user cancell?ed/i,
  /signature (?:request )?cancell?ed/i,
  /denied by user/i,
];

const NETWORK_PATTERNS: RegExp[] = [
  /network (?:error|request failed)/i,
  /failed to fetch/i,
  /timed? ?out/i,
  /connection (?:reset|refused|failed|aborted)/i,
  /load failed/i,
];

const SUBMISSION_PATTERNS: RegExp[] = [
  /tx_(?:failed|bad_seq|insufficient_balance|no_source_account|insufficient_fee)/i,
  /op_(?:no_destination|underfunded|no_trust|not_authorized)/i,
  /horizon/i,
  /soroban rpc/i,
  /contract(?: invocation)? error/i,
  /sequence (?:number )?(?:mismatch|is wrong|bad)/i,
  /trustline (?:missing|required)/i,
  /insufficient (?:balance|fee|reserve)/i,
];

function extractMessage(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'object') {
    const anyErr = error as Record<string, unknown>;
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.error === 'string') return anyErr.error;
    if (anyErr.data && typeof anyErr.data === 'object') {
      const data = anyErr.data as Record<string, unknown>;
      if (typeof data.title === 'string') return data.title;
      if (typeof data.detail === 'string') return data.detail;
    }
  }
  return '';
}

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(message));
}

/**
 * Classifies a Freighter / Stellar failure into a user-facing category.
 * Inspect the `kind` to decide which UI banner / toast to render; never
 * surface the raw `cause` to the user.
 */
export function classifyFreighterError(error: unknown): ClassifiedFreighterError {
  const message = extractMessage(error);

  // Rejection check first: a user clicking Reject is never "a problem to
  // report" — don't dress it up as an error.
  if (matchesAny(message, REJECTED_PATTERNS)) {
    return {
      kind: 'rejected',
      message: 'You cancelled the signature request.',
      action: 'Open Freighter and approve the transaction to continue registering the course.',
      retryable: true,
      cause: message,
    };
  }

  // Network before submission: distinguishing timeout from a landed-but-
  // unseen tx is the caller's job; we flag both as retryable at this layer.
  if (matchesAny(message, NETWORK_PATTERNS)) {
    return {
      kind: 'network',
      message: 'Couldn\'t reach the Stellar network.',
      action: 'Check your connection and try again. The course was not submitted on-chain.',
      retryable: true,
      cause: message,
    };
  }

  if (matchesAny(message, SUBMISSION_PATTERNS)) {
    return {
      kind: 'submission_failed',
      message: 'The on-chain submission was rejected by the network.',
      action:
        'Fix the reported issue (top up XLM, create the trustline, retry with the right sequence) and run step 3 again.',
      retryable: false,
      cause: message,
    };
  }

  return {
    kind: 'unknown',
    message: 'Something went wrong while registering the course on Stellar.',
    action: 'Please try again. If this keeps happening, contact support with the time of the attempt.',
    retryable: true,
    cause: message,
  };
}
