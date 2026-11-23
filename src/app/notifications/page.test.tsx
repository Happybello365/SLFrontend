import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationsApi } from '@/lib/api/services';
import type { Notification } from '@/types';
import NotificationsPage from './page';

vi.mock('@/lib/api/services', () => ({
  notificationsApi: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const item: Notification = {
  id: 'notice-1',
  title: 'Your certificate is ready',
  message: 'View your certificate now.',
  type: 'CERTIFICATE_ISSUED',
  data: null,
  read: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const meta = { total: 1, page: 1, limit: 20, totalPages: 1 };

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('Notifications page', () => {
  it('renders its heading while the notification request is pending', () => {
    vi.mocked(notificationsApi.list).mockReturnValue(new Promise(() => {}));

    render(<NotificationsPage />);

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(notificationsApi.list).toHaveBeenCalledOnce();
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
  });

  it('renders the empty notification state', async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue({ data: [], meta: { ...meta, total: 0 } });

    render(<NotificationsPage />);

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('renders an unread notice and marks it read on click', async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue({ data: [item], meta });
    vi.mocked(notificationsApi.markRead).mockResolvedValue(undefined);

    render(<NotificationsPage />);

    fireEvent.click(await screen.findByText('Your certificate is ready'));

    await waitFor(() => expect(notificationsApi.markRead).toHaveBeenCalledWith('notice-1'));
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument();
  });

  it('calls the bulk action and reloads the notification list', async () => {
    vi.mocked(notificationsApi.list)
      .mockResolvedValueOnce({ data: [item], meta })
      .mockResolvedValueOnce({ data: [{ ...item, read: true }], meta });
    vi.mocked(notificationsApi.markAllRead).mockResolvedValue(undefined);

    render(<NotificationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));

    await waitFor(() => expect(notificationsApi.list).toHaveBeenCalledTimes(2));
    expect(notificationsApi.markAllRead).toHaveBeenCalledOnce();
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
  });

  it('handles an API failure by finishing the loading state', async () => {
    const error = new Error('Notifications unavailable');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(notificationsApi.list).mockRejectedValue(error);

    render(<NotificationsPage />);

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith(error);
  });
});
