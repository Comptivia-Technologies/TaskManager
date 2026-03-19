describe('authApi', () => {
  const originalHref = window.location.href;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    delete (window as any).location;
    (window as any).location = { ...window.location, href: originalHref, assign: jest.fn(), replace: jest.fn() };
  });

  afterAll(() => {
    (window as any).location = { href: originalHref };
  });

  const createInstance = () => {
    const mockFn = jest.fn();
    const instance: any = Object.assign(mockFn, {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    });
    return instance;
  };

  it('request interceptor skips Authorization when no token', async () => {
    const instance = createInstance();
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    await import('../../services/authApi');
    const requestFulfilled = instance.interceptors.request.use.mock.calls[0][0];
    const config = { headers: {} as Record<string, string> };
    const out = await requestFulfilled(config);
    expect(out.headers.Authorization).toBeUndefined();
  });

  it('request interceptor error path rejects', async () => {
    const instance = createInstance();
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    await import('../../services/authApi');
    const requestRejected = instance.interceptors.request.use.mock.calls[0][1];
    await expect(requestRejected(new Error('req'))).rejects.toThrow('req');
  });

  it('response 401 retries when refresh returns token', async () => {
    const instance = createInstance();
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    jest.doMock('../../services/authService', () => ({
      authService: { refreshAuthToken: jest.fn().mockResolvedValue('fresh') },
    }));
    instance.mockResolvedValue({ data: 'retry-ok' });
    await import('../../services/authApi');
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 401 }, config: { headers: {} as any, _retry: false } };
    const res = await responseRejected(err);
    expect(err.config._retry).toBe(true);
    expect(err.config.headers.Authorization).toBe('Bearer fresh');
    expect(res).toEqual({ data: 'retry-ok' });
  });

  it('response 401 redirects and clears storage when refresh throws', async () => {
    const instance = createInstance();
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    jest.doMock('../../services/authService', () => ({
      authService: { refreshAuthToken: jest.fn().mockRejectedValue(new Error('refresh-fail')) },
    }));
    localStorage.setItem('authToken', 'x');
    localStorage.setItem('authTokenExpiry', '1');
    await import('../../services/authApi');
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 401 }, config: { headers: {} as any, _retry: false } };
    await expect(responseRejected(err)).rejects.toBeTruthy();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('response 401 rejects when refresh returns null', async () => {
    const instance = createInstance();
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    jest.doMock('../../services/authService', () => ({
      authService: { refreshAuthToken: jest.fn().mockResolvedValue(null) },
    }));
    await import('../../services/authApi');
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 401 }, config: { headers: {} as any, _retry: false } };
    await expect(responseRejected(err)).rejects.toBe(err);
  });

  it('response success passthrough', async () => {
    const instance = createInstance();
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    await import('../../services/authApi');
    const responseOk = instance.interceptors.response.use.mock.calls[0][0];
    const res = { data: 1 };
    expect(responseOk(res)).toBe(res);
  });

  it('response 401 does not retry when _retry already true', async () => {
    const instance = createInstance();
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    await import('../../services/authApi');
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 401 }, config: { headers: {} as any, _retry: true } };
    await expect(responseRejected(err)).rejects.toBe(err);
    expect(instance).not.toHaveBeenCalled();
  });
});
