import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationDropdown } from './NotificationDropdown';
import * as notificationStoreModule from '@/lib/hooks/use-notification-store';

const mockNotifications = [
  {
    id: '1',
    type: 'ENROLLMENT_CONFIRMED' as const,
    title: 'Enrollment Confirmed',
    message: 'You enrolled in a course',
    data: { courseId: 'course-1' },
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'COURSE_COMPLETED' as const,
    title: 'Course Completed',
    message: 'You completed a course',
    data: { courseId: 'course-2' },
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe('NotificationDropdown', () => {
  describe('Loading state', () => {
    beforeEach(() => {
      vi.spyOn(notificationStoreModule, 'useNotificationStore').mockReturnValue({
        notifications: [],
        loading: true,
        fetched: false,
        error: null,
        fetchNotifications: vi.fn(),
        markRead: vi.fn(),
        markAllRead: vi.fn(),
      });
    });

    it('shows loading spinner when fetching', async () => {
      render(<NotificationDropdown />);

      const trigger = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();
      expect(screen.queryByText(/you're all caught up/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    beforeEach(() => {
      vi.spyOn(notificationStoreModule, 'useNotificationStore').mockReturnValue({
        notifications: [],
        loading: false,
        fetched: true,
        error: new Error('API request failed'),
        fetchNotifications: vi.fn(),
        markRead: vi.fn(),
        markAllRead: vi.fn(),
      });
    });

    it('shows error state when API fails', async () => {
      render(<NotificationDropdown />);

      const trigger = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/api request failed/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.queryByText(/you're all caught up/i)).not.toBeInTheDocument();
    });

    it('calls fetchNotifications when retry button is clicked', async () => {
      const mockFetch = vi.fn();
      vi.spyOn(notificationStoreModule, 'useNotificationStore').mockReturnValue({
        notifications: [],
        loading: false,
        fetched: true,
        error: new Error('API request failed'),
        fetchNotifications: mockFetch,
        markRead: vi.fn(),
        markAllRead: vi.fn(),
      });

      render(<NotificationDropdown />);

      const trigger = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Empty state', () => {
    beforeEach(() => {
      vi.spyOn(notificationStoreModule, 'useNotificationStore').mockReturnValue({
        notifications: [],
        loading: false,
        fetched: true,
        error: null,
        fetchNotifications: vi.fn(),
        markRead: vi.fn(),
        markAllRead: vi.fn(),
      });
    });

    it('shows empty state when there are no notifications', async () => {
      render(<NotificationDropdown />);

      const trigger = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
      expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
      expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
    });
  });

  describe('Success state', () => {
    beforeEach(() => {
      vi.spyOn(notificationStoreModule, 'useNotificationStore').mockReturnValue({
        notifications: mockNotifications,
        loading: false,
        fetched: true,
        error: null,
        fetchNotifications: vi.fn(),
        markRead: vi.fn(),
        markAllRead: vi.fn(),
      });
    });

    it('renders notifications when data is available', async () => {
      render(<NotificationDropdown />);

      const trigger = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/enrollment confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/course completed/i)).toBeInTheDocument();
      expect(screen.queryByText(/you're all caught up/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
    });

    it('shows mark all read button when there are unread notifications', async () => {
      render(<NotificationDropdown />);

      const trigger = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
    });
  });
});
