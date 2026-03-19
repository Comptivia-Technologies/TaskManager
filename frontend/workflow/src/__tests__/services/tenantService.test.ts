const originalEnv = process.env;

describe('tenantService', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    (global as any).fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns error when REACT_APP_API_URL is not set', async () => {
    process.env.REACT_APP_API_URL = '';
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.error).toContain('not configured');
    expect(result.tenantId).toBeNull();
    expect(result.exists).toBe(false);
  });

  it('returns tenantId when API returns single tenant', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { tenantId: 't1', hasTenant: true, organizationName: 'Org1' } }),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.tenantId).toBe('t1');
    expect(result.exists).toBe(true);
  });

  it('returns multiple tenants when organizations length > 1', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { hasTenant: true, organizations: [{ tenantId: 't1', organizationName: 'O1' }, { tenantId: 't2', organizationName: 'O2' }] } }),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.multipleTenants).toBe(true);
    expect(result.tenants).toHaveLength(2);
  });

  it('returns permission error on 403', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Permission denied' }),
      text: () => Promise.resolve('Permission denied'),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.error).toContain('permissions');
    expect(result.exists).toBe(false);
  });

  it('returns not found message on 404', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'not found' }),
      text: () => Promise.resolve('not found'),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.error).toContain('not found');
    expect(result.exists).toBe(false);
  });

  it('returns exists=true but hasTenant=false message', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { hasTenant: false } }),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.exists).toBe(true);
    expect(result.error).toContain('does not belong');
  });

  it('uses text body when error json parse fails', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('bad json')),
      text: () => Promise.resolve('plain err'),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.exists).toBe(false);
    expect(result.error).toContain('plain err');
  });

  it('throws mapped message for non-403/404 errors with json message', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'srv' }),
      text: () => Promise.resolve(''),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.exists).toBe(false);
    expect(result.error).toContain('srv');
  });

  it('returns tenant from single organizations[0]', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            hasTenant: true,
            organizations: [{ tenantId: 't-only', organizationName: 'One' }],
          },
        }),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.tenantId).toBe('t-only');
    expect(result.displayName).toBe('One');
  });

  it('unwraps top-level response without data wrapper', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tenantId: 'top', hasTenant: true, organizationName: 'O' }),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.tenantId).toBe('top');
  });

  it('returns error when tenant info missing in ok response', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { hasTenant: true } }),
    });
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.error).toContain('not found in response');
  });

  it('returns catch-shaped error when fetch throws', async () => {
    process.env.REACT_APP_API_URL = 'https://api.test';
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    const result = await fetchTenantIdByEmail('a@b.com');
    expect(result.exists).toBe(false);
    expect(result.error).toContain('network');
  });
});
