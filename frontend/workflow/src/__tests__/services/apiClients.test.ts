describe('api clients', () => {
  const savedApiUrl = process.env.REACT_APP_API_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    process.env.REACT_APP_API_URL = savedApiUrl || 'http://test';
  });

  afterAll(() => {
    if (savedApiUrl !== undefined) process.env.REACT_APP_API_URL = savedApiUrl;
  });

  const setupAxiosMock = () => {
    const instance: any = Object.assign(jest.fn(), {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    });
    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => instance) },
    }));
    return instance;
  };

  it('services/api sets request Authorization header from localStorage', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance = setupAxiosMock();

    jest.isolateModules(() => {
      require('../../services/api');
    });

    const requestFulfilled = instance.interceptors.request.use.mock.calls[0][0];
    localStorage.setItem('authToken', 't1');
    const config = { headers: {} as any };
    const out = await requestFulfilled(config);
    expect(out.headers.Authorization).toBe('Bearer t1');
  });

  it('services/api response interceptor refreshes token on 401', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance = setupAxiosMock();

    jest.doMock('../../services/authService', () => ({
      authService: { refreshAuthToken: jest.fn().mockResolvedValue('new-token') },
    }));

    await import('../../services/api');
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 401 }, config: { headers: {}, _retry: false } };
    await responseRejected(err);
    expect(err.config._retry).toBe(true);
    expect(err.config.headers.Authorization).toBe('Bearer new-token');
  });

  it('services/api response interceptor clears tokens and redirects on refresh failure', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance: any = setupAxiosMock();
    const { authService } = require('../../services/authService');
    (authService.refreshAuthToken as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    localStorage.setItem('authToken', 't');
    localStorage.setItem('authTokenExpiry', '1');

    await import('../../services/api');
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 401 }, config: { headers: {}, _retry: false } };
    await expect(responseRejected(err)).rejects.toBeTruthy();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('authTokenExpiry')).toBeNull();
  });

  it('services/api response interceptor passes through non-401 errors', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance: any = setupAxiosMock();
    await import('../../services/api');
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 500 }, config: { headers: {} } };
    await expect(responseRejected(err)).rejects.toBeTruthy();
  });

  it('services/api request interceptor leaves headers without token', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance = setupAxiosMock();
    jest.isolateModules(() => {
      require('../../services/api');
    });
    const requestFulfilled = instance.interceptors.request.use.mock.calls[0][0];
    const out = await requestFulfilled({ headers: {} as any });
    expect(out.headers.Authorization).toBeUndefined();
  });

  it('services/api request interceptor error handler rejects', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance = setupAxiosMock();
    jest.isolateModules(() => {
      require('../../services/api');
    });
    const requestRejected = instance.interceptors.request.use.mock.calls[0][1];
    await expect(requestRejected(new Error('bad'))).rejects.toThrow('bad');
  });

  it('services/api response 401 rejects when refresh returns null', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance: any = setupAxiosMock();
    jest.doMock('../../services/authService', () => ({
      authService: { refreshAuthToken: jest.fn().mockResolvedValue(null) },
    }));
    jest.isolateModules(() => {
      require('../../services/api');
    });
    const responseRejected = instance.interceptors.response.use.mock.calls[0][1];
    const err: any = { response: { status: 401 }, config: { headers: {}, _retry: false } };
    await expect(responseRejected(err)).rejects.toBe(err);
  });

  it('services/api response success passthrough', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    const instance: any = setupAxiosMock();
    jest.isolateModules(() => {
      require('../../services/api');
    });
    const responseOk = instance.interceptors.response.use.mock.calls[0][0];
    const res = { data: 'x' };
    expect(responseOk(res)).toBe(res);
  });

  it('services/api throws when REACT_APP_API_URL is missing', () => {
    jest.resetModules();
    delete process.env.REACT_APP_API_URL;
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        create: jest.fn(() => ({
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        })),
      },
    }));
    expect(() => {
      jest.isolateModules(() => {
        require('../../services/api');
      });
    }).toThrow('REACT_APP_API_URL');
    process.env.REACT_APP_API_URL = savedApiUrl || 'http://test';
  });

  it('services/authApi sets request Authorization header from localStorage', async () => {
    const instance = setupAxiosMock();
    await import('../../services/authApi');
    const requestFulfilled = instance.interceptors.request.use.mock.calls[0][0];
    localStorage.setItem('authToken', 't2');
    const config = { headers: {} as any };
    const out = await requestFulfilled(config);
    expect(out.headers.Authorization).toBe('Bearer t2');
  });

  it('services/priorityRulesApi and services/slaApi re-export api instance', async () => {
    (process.env as any).REACT_APP_API_URL = 'http://test';
    setupAxiosMock();
    const api = (await import('../../services/api')).default;
    const priorityRulesApi = (await import('../../services/priorityRulesApi')).default;
    const slaApi = (await import('../../services/slaApi')).default;
    expect(priorityRulesApi).toBe(api);
    expect(slaApi).toBe(api);
  });
});

