import { create } from 'zustand';
import type { User } from '@/types';
import { usersApi } from '@/lib/api/services';

const AUTH_TOKEN_KEY = 'sorobanlard_token';
const AUTH_ADDRESS_KEY = 'sorobanlard_address';

const readCookie = (name: string) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

const clearPersistedAuth = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_ADDRESS_KEY);
  document.cookie = `${AUTH_TOKEN_KEY}=; path=/; max-age=0`;
};

/**
 * Normalises a Stellar address for comparison. Freighter sometimes returns
 * the address with surrounding whitespace or in muxed/G... form; the store
 * compares as the raw G... account id so a flapping case or prefix doesn't
 * trigger a false mismatch (#212).
 */
export function normaliseAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

/**
 * Compares a session address with the wallet's current one. Returns
 * `true` when both sides have resolved and they do NOT match — the UI
 * must re-prompt / re-auth. Returns `false` when one side is unknown
 * (wallet locked, not yet connected) so the UI does not nag users who
 * simply haven't opened Freighter yet.
 */
export function detectAddressMismatch(
  sessionAddress: string | null | undefined,
  walletAddress: string | null | undefined,
): boolean {
  const a = normaliseAddress(sessionAddress);
  const b = normaliseAddress(walletAddress);
  if (!a || !b) return false;
  return a !== b;
}

interface AuthState {
  address:     string | null;
  token:       string | null;
  user:        User | null;
  isConnected: boolean;
  /**
   * `true` when the Freighter extension reports an account different from
   * the one the session was created for (#212). Mutually exclusive with
   * `isConnected`: reconnecting or logging out clears it.
   */
  accountMismatch: boolean;
  setAuth:     (address: string, token: string, user: User, rememberMe?: boolean) => void;
  setAddress:  (address: string) => void;
  updateUser:  (patch: Partial<User>) => void;
  deleteAccount: (password: string) => Promise<void>;
  /**
   * Call with the current address Freighter reports. If it differs from
   * the stored session address, flip `accountMismatch` to true and clear
   * `isConnected` so protected pages re-auth. The persisted cookie/
   * localStorage are untouched so a user who switches back can keep
   * going without re-signing.
   */
  reconcileWalletAddress: (walletAddress: string | null) => void;
  /**
   * Call once the user has re-approved the switched account (or switched
   * back in the extension). Clears the mismatch flag.
   */
  clearAccountMismatch: () => void;
  logout:      () => void;
  rehydrate:   () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  address: null, token: null, user: null, isConnected: false, accountMismatch: false,

  setAuth: (address, token, user, rememberMe = false) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_ADDRESS_KEY, address);
      const maxAge = rememberMe ? 30 * 24 * 3600 : 24 * 3600;
      document.cookie = `${AUTH_TOKEN_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
    set({ address, token, user, isConnected: true, accountMismatch: false });
  },

  setAddress: (address) => set({ address, isConnected: true, accountMismatch: false }),

  updateUser: (patch) =>
    set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),

  deleteAccount: async (password) => {
    await usersApi.deleteAccount(password);
    clearPersistedAuth();
    set({ address: null, token: null, user: null, isConnected: false, accountMismatch: false });
  },

  reconcileWalletAddress: (walletAddress) => {
    const current = get().address;
    const mismatch = detectAddressMismatch(current, walletAddress);
    if (mismatch) {
      // Keep the persisted token/address intact so a user who switches
      // back in the extension does not have to re-sign. Only flip the
      // live connection flags: protected pages will detect
      // `accountMismatch` and re-auth.
      set({ isConnected: false, accountMismatch: true });
    } else if (get().accountMismatch) {
      set({ accountMismatch: false, isConnected: true });
    }
  },

  clearAccountMismatch: () => set({ accountMismatch: false, isConnected: true }),

  logout: () => {
    clearPersistedAuth();
    set({ address: null, token: null, user: null, isConnected: false, accountMismatch: false });
  },

  rehydrate: () => {
    if (typeof window === 'undefined') return;

    const cookieToken = readCookie(AUTH_TOKEN_KEY);
    const storageToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const address = localStorage.getItem(AUTH_ADDRESS_KEY);

    if (!cookieToken || !storageToken || !address || cookieToken !== storageToken) {
      if (storageToken || address) {
        clearPersistedAuth();
      }
      set({ address: null, token: null, user: null, isConnected: false, accountMismatch: false });
      return;
    }

    set({ token: storageToken, address, isConnected: true, accountMismatch: false });
  },
}));
