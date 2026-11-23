import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReferralsPage from './page';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Referrals dashboard page', () => {
  it('renders the referral link, actions, stats and empty rewards state', () => {
    render(<ReferralsPage />);

    expect(screen.getByRole('heading', { name: 'Refer & Earn' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your referral link' })).toBeInTheDocument();
    expect(screen.getByText('https://sorobanlard.com/ref/student')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LinkedIn' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Referral stats' })).toBeInTheDocument();
    expect(screen.getByText('Referrals sent')).toBeInTheDocument();
    expect(screen.getByText('Referrals enrolled')).toBeInTheDocument();
    expect(screen.getByText('Rewards earned')).toBeInTheDocument();
    expect(screen.getByText(/haven't earned any referral rewards yet/i)).toBeInTheDocument();
  });

  it('copies the page referral link when the user clicks the CTA', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { userAgent: navigator.userAgent, clipboard: { writeText } });

    render(<ReferralsPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });

    expect(writeText).toHaveBeenCalledWith('https://sorobanlard.com/ref/student');
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('keeps the copy action available if clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard blocked'));
    vi.stubGlobal('navigator', { userAgent: navigator.userAgent, clipboard: { writeText } });

    render(<ReferralsPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
  });
});
