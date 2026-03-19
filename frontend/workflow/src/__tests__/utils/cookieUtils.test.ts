import {
  setOrganizationIdCookie,
  getOrganizationIdFromCookie,
  clearOrganizationIdCookie,
} from '../../utils/cookieUtils';

describe('cookieUtils', () => {
  const originalCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');

  beforeEach(() => {
    let cookieStore = '';
    Object.defineProperty(document, 'cookie', {
      get: () => cookieStore,
      set: (v: string) => {
        if (v.includes('max-age=0')) {
          cookieStore = '';
          return;
        }
        cookieStore = v.split(';')[0];
      },
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalCookieDesc) {
      Object.defineProperty(document, 'cookie', originalCookieDesc);
    }
  });

  it('setOrganizationIdCookie sets cookie', () => {
    setOrganizationIdCookie('org-1');
    expect(document.cookie).toContain('organizationId=');
    expect(document.cookie).toContain('org-1');
  });

  it('getOrganizationIdFromCookie returns value when set', () => {
    setOrganizationIdCookie('org-2');
    expect(getOrganizationIdFromCookie()).toBe('org-2');
  });

  it('getOrganizationIdFromCookie returns null when not set', () => {
    expect(getOrganizationIdFromCookie()).toBeNull();
  });

  it('clearOrganizationIdCookie clears cookie', () => {
    setOrganizationIdCookie('org-3');
    clearOrganizationIdCookie();
    expect(getOrganizationIdFromCookie()).toBeNull();
  });
});
