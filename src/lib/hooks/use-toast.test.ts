import { createElement, type PropsWithChildren } from 'react';
import { act, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { useToast } from './use-toast';

const wrapper = ({ children }: PropsWithChildren) => createElement(ToastProvider, null, children);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useToast (#405)', () => {
  it('starts empty and exposes all toast actions inside the provider', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    expect(result.current.toasts).toEqual([]);
    for (const action of ['push', 'dismiss', 'success', 'error', 'warning', 'info']) {
      expect(result.current[action as keyof typeof result.current]).toEqual(expect.any(Function));
    }
  });

  it('creates success and error notifications with suitable roles', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.success({ title: 'Saved', description: 'Changes stored' });
      result.current.error({ title: 'Failed', description: 'Please retry' });
    });

    expect(result.current.toasts).toMatchObject([
      { title: 'Saved', description: 'Changes stored', variant: 'success', role: 'status', duration: 4000 },
      { title: 'Failed', description: 'Please retry', variant: 'error', role: 'alert', duration: 4000 },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('supports warning, info and a custom default-free push', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.warning({ title: 'Warning' });
      result.current.info({ title: 'Information' });
      result.current.push({ title: 'Custom', duration: 650, role: 'alert' });
    });

    expect(result.current.toasts.map((toast) => toast.variant)).toEqual(['warning', 'info', 'info']);
    expect(result.current.toasts[2]).toMatchObject({ title: 'Custom', role: 'alert', duration: 650 });
    expect(screen.getByRole('alert')).toHaveTextContent('Custom');
  });

  it('dismisses a toast by ID and limits simultaneously visible notifications', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      for (let i = 1; i <= 4; i++) result.current.info({ title: `Notice ${i}` });
    });

    expect(result.current.toasts).toHaveLength(4);
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.queryByText('Notice 4')).not.toBeInTheDocument();

    const firstId = result.current.toasts[0].id;
    act(() => { result.current.dismiss(firstId); });
    expect(result.current.toasts).toHaveLength(3);
    expect(screen.getByText('Notice 4')).toBeInTheDocument();
  });

  it('automatically dismisses a notification after its configured duration', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => { result.current.info({ title: 'Temporary', duration: 100 }); });
    expect(screen.getByRole('status')).toHaveTextContent('Temporary');

    act(() => { vi.advanceTimersByTime(100); });
    act(() => { vi.advanceTimersByTime(220); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('throws a useful error outside ToastProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow('useToastContext must be used inside ToastProvider');
  });
});
