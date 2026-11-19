import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';
import { authApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import * as freighterLib from '@/lib/stellar/freighter';

const mockPush = vi.fn();
const mockGetSearchParam = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGetSearchParam }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api/services', () => ({
  authApi: {
    loginWithEmail: vi.fn(),
    getNonce: vi.fn(),
    login: vi.fn(),
  },
}));

vi.mock('@/lib/stellar/freighter', () => ({
  isFreighterInstalled: vi.fn(),
  connectFreighter: vi.fn(),
  signNonce: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockIsFreighterInstalled = vi.mocked(freighterLib.isFreighterInstalled);
const mockConnectFreighter     = vi.mocked(freighterLib.connectFreighter);
const mockSignNonce            = vi.mocked(freighterLib.signNonce);

/** Renders the page and waits for the Freighter probe to settle. */
async function renderAndSettle() {
  render(<LoginPage />);
  // The component renders a "Checking for Freighter wallet…" state first;
  // wait until that spinner is gone before making assertions.
  await waitFor(() =>
    expect(screen.queryByTestId('freighter-checking')).not.toBeInTheDocument(),
  );
}

describe('LoginPage integration', () => {
  const loginWithEmailMock = vi.mocked(authApi.loginWithEmail);

  beforeEach(() => {
    mockPush.mockReset();
    mockGetSearchParam.mockReset();
    mockGetSearchParam.mockReturnValue(null);
    loginWithEmailMock.mockReset();
    vi.mocked(authApi.getNonce).mockReset();
    vi.mocked(authApi.login).mockReset();
    mockIsFreighterInstalled.mockReset();
    mockConnectFreighter.mockReset();
    mockSignNonce.mockReset();
    // Default: extension is installed, so email-only tests aren't blocked.
    mockIsFreighterInstalled.mockResolvedValue(true);
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  // ── Email / password form ───────────────────────────────────────────────────

  it('shows validation errors for both fields when the form is submitted empty', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(await screen.findByText('Password is required.')).toBeInTheDocument();
    expect(loginWithEmailMock).not.toHaveBeenCalled();
  });

  it('shows an email validation error for invalid email formats', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('shows a password validation error for short passwords', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('submits valid credentials and redirects to the dashboard', async () => {
    const user = userEvent.setup();
    loginWithEmailMock.mockResolvedValue({
      accessToken: 'token-123',
      user: { id: 'user-1', email: 'student@example.com' },
    } as any);
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(loginWithEmailMock).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
    expect(localStorage.getItem('sorobanlard_token')).toBe('token-123');
  });

  it('shows an inline error message when the API rejects with invalid credentials', async () => {
    const user = userEvent.setup();
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 401,
        data: { message: 'Invalid credentials' },
        statusText: 'Unauthorized',
        headers: {},
        config: {},
      } as any,
    );
    loginWithEmailMock.mockRejectedValue(error);
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  // ── Freighter not installed ─────────────────────────────────────────────────

  describe('Freighter extension not installed', () => {
    beforeEach(() => {
      mockIsFreighterInstalled.mockResolvedValue(false);
    });

    it('shows the not-installed banner and hides the connect button', async () => {
      await renderAndSettle();

      expect(screen.getByTestId('freighter-not-installed')).toBeInTheDocument();
      expect(screen.queryByTestId('wallet-connect-button')).not.toBeInTheDocument();
    });

    it('banner has role="alert" so screen readers announce it', async () => {
      await renderAndSettle();

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('banner contains a link to the Freighter install page', async () => {
      await renderAndSettle();

      const installLink = screen.getByTestId('freighter-install-link');
      expect(installLink).toHaveAttribute('href', 'https://freighter.app');
      expect(installLink).toHaveAttribute('target', '_blank');
      expect(installLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('banner contains text that explains what to do', async () => {
      await renderAndSettle();

      const banner = screen.getByTestId('freighter-not-installed');
      expect(banner).toHaveTextContent(/freighter/i);
      expect(banner).toHaveTextContent(/install/i);
    });

    it('"Check again" button re-probes and shows the connect button when extension appears', async () => {
      const user = userEvent.setup();
      // First probe: not installed. After the user installs and clicks retry: installed.
      mockIsFreighterInstalled
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await renderAndSettle();
      expect(screen.getByTestId('freighter-not-installed')).toBeInTheDocument();

      await user.click(screen.getByTestId('freighter-retry-probe'));

      await waitFor(() =>
        expect(screen.queryByTestId('freighter-not-installed')).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId('wallet-connect-button')).toBeInTheDocument();
    });

    it('"Check again" button re-probes and stays on the banner when extension is still missing', async () => {
      const user = userEvent.setup();
      mockIsFreighterInstalled.mockResolvedValue(false);

      await renderAndSettle();
      await user.click(screen.getByTestId('freighter-retry-probe'));

      await waitFor(() =>
        // After the second probe resolves the banner must still be visible.
        expect(screen.getByTestId('freighter-not-installed')).toBeInTheDocument(),
      );
    });
  });

  // ── Freighter installed ─────────────────────────────────────────────────────

  describe('Freighter extension installed', () => {
    beforeEach(() => {
      mockIsFreighterInstalled.mockResolvedValue(true);
    });

    it('shows the Connect Wallet button and hides the not-installed banner', async () => {
      await renderAndSettle();

      expect(screen.getByTestId('wallet-connect-button')).toBeInTheDocument();
      expect(screen.queryByTestId('freighter-not-installed')).not.toBeInTheDocument();
    });

    it('connect wallet flow succeeds and redirects to the dashboard', async () => {
      const user = userEvent.setup();
      const STUB_ADDRESS = 'GCL6KHXPXJTR47SMQQI7IGZBHPK7NRQAXLSJSLOQKGSL35RGOYN2JLUF';

      mockConnectFreighter.mockResolvedValue(STUB_ADDRESS);
      vi.mocked(authApi.getNonce).mockResolvedValue('nonce-abc');
      mockSignNonce.mockResolvedValue('signed-xdr');
      vi.mocked(authApi.login).mockResolvedValue({
        accessToken: 'wallet-token',
        user: { id: 'user-2', stellarAddress: STUB_ADDRESS },
      } as any);

      await renderAndSettle();
      await user.click(screen.getByTestId('wallet-connect-button'));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
      expect(localStorage.getItem('sorobanlard_token')).toBe('wallet-token');
    });

    it('connect wallet flow respects the callbackUrl query param', async () => {
      const user = userEvent.setup();
      mockGetSearchParam.mockReturnValue('/dashboard/courses/stellar-101');
      const STUB_ADDRESS = 'GCL6KHXPXJTR47SMQQI7IGZBHPK7NRQAXLSJSLOQKGSL35RGOYN2JLUF';

      mockConnectFreighter.mockResolvedValue(STUB_ADDRESS);
      vi.mocked(authApi.getNonce).mockResolvedValue('nonce-xyz');
      mockSignNonce.mockResolvedValue('signed-xdr');
      vi.mocked(authApi.login).mockResolvedValue({
        accessToken: 'wallet-token-2',
        user: { id: 'user-3', stellarAddress: STUB_ADDRESS },
      } as any);

      await renderAndSettle();
      await user.click(screen.getByTestId('wallet-connect-button'));

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/dashboard/courses/stellar-101'),
      );
    });

    it('shows an inline error when the user declines the Freighter access request', async () => {
      const user = userEvent.setup();
      mockConnectFreighter.mockRejectedValue(new Error('User declined access'));

      await renderAndSettle();
      await user.click(screen.getByTestId('wallet-connect-button'));

      const errorMsg = await screen.findByTestId('wallet-error');
      expect(errorMsg).toHaveTextContent(/declined/i);
      // Page must not have navigated away.
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows the inline error as a live region (role="alert")', async () => {
      const user = userEvent.setup();
      mockConnectFreighter.mockRejectedValue(new Error('User declined access'));

      await renderAndSettle();
      await user.click(screen.getByTestId('wallet-connect-button'));

      const errorEl = await screen.findByTestId('wallet-error');
      expect(errorEl).toHaveAttribute('role', 'alert');
    });

    it('re-enables the connect button after a failed attempt so the user can retry', async () => {
      const user = userEvent.setup();
      mockConnectFreighter.mockRejectedValue(new Error('User declined access'));

      await renderAndSettle();
      const btn = screen.getByTestId('wallet-connect-button');
      await user.click(btn);

      await screen.findByTestId('wallet-error');
      // Button must not be permanently disabled.
      expect(screen.getByTestId('wallet-connect-button')).not.toBeDisabled();
    });

    it('shows an inline error for generic wallet failures', async () => {
      const user = userEvent.setup();
      mockConnectFreighter.mockRejectedValue(new Error('Extension crashed'));

      await renderAndSettle();
      await user.click(screen.getByTestId('wallet-connect-button'));

      const errorEl = await screen.findByTestId('wallet-error');
      expect(errorEl).toHaveTextContent(/Extension crashed/);
    });
  });
});
