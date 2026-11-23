import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './client';

function response(config: InternalAxiosRequestConfig, status = 200): AxiosResponse {
  return {
    data: { success: true },
    status,
    statusText: status === 200 ? 'OK' : 'Unavailable',
    headers: {},
    config,
  };
}

function httpError(config: InternalAxiosRequestConfig, status: number): AxiosError {
  return new AxiosError(
    `HTTP ${status}`,
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    response(config, status),
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('apiClient', () => {
  it('uses the configured API URL, JSON headers and a 20-second timeout', () => {
    expect(apiClient.defaults.baseURL).toBe(
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
    );
    expect(apiClient.defaults.timeout).toBe(20_000);
    expect(apiClient.defaults.headers.common).toBeDefined();
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('attaches a stored bearer token to outgoing requests', async () => {
    localStorage.setItem('sorobanlard_token', 'test-token');
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config));

    await apiClient.get('/courses', { adapter });

    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('does not attach an authorization header when the token is absent', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config));

    await apiClient.get('/courses', { adapter });

    expect(adapter.mock.calls[0][0].headers.has('Authorization')).toBe(false);
  });

  it('does not retry non-retryable client errors', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw httpError(config, 400);
    });

    await expect(apiClient.get('/bad-request', { adapter })).rejects.toMatchObject({
      response: { status: 400 },
    });
    expect(adapter).toHaveBeenCalledOnce();
  });

  it('retries transient 503 failures with incremental retry headers', async () => {
    vi.useFakeTimers();
    const retryHeaders: Array<string | undefined> = [];
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      retryHeaders.push(config.headers.get('X-Retry-Count')?.toString());
      if (retryHeaders.length < 3) throw httpError(config, 503);
      return response(config);
    });

    const request = apiClient.get('/temporary-outage', { adapter });
    await vi.advanceTimersByTimeAsync(3000); // 1s + 2s exponential back-off.

    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(adapter).toHaveBeenCalledTimes(3);
    expect(retryHeaders).toEqual([undefined, '1', '2']);
  });

  it('stops after three retries when the network remains unavailable', async () => {
    vi.useFakeTimers();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Network timeout', 'ECONNABORTED', config);
    });

    const request = apiClient.get('/offline', { adapter });
    const rejection = expect(request).rejects.toMatchObject({ code: 'ECONNABORTED' });
    await vi.runAllTimersAsync();

    await rejection;
    expect(adapter).toHaveBeenCalledTimes(4);
  });
});
