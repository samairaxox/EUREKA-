jest.mock('axios', () => {
  const client = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    post: jest.fn(),
  };
  return { create: jest.fn(() => client) };
});

import { api, getAccessToken, refreshSession } from './client';

afterEach(() => {
  jest.clearAllMocks();
  delete navigator.locks;
});

test('coordinates refresh-token rotation across tabs with the browser lock', async () => {
  const requestLock = jest.fn((_name, _options, callback) => callback());
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: requestLock } });
  api.post.mockResolvedValue({ data: { access_token: 'memory-only-access-token', user: { id: 1 } } });

  const result = await refreshSession();

  expect(requestLock).toHaveBeenCalledWith('eureka-refresh-token', { mode: 'exclusive' }, expect.any(Function));
  expect(api.post).toHaveBeenCalledWith('/auth/refresh', null, expect.objectContaining({
    headers: { 'X-Requested-With': 'eureka' }, _retried: true,
  }));
  expect(result.user.id).toBe(1);
  expect(getAccessToken()).toBe('memory-only-access-token');
});
