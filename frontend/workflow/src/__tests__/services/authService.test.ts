import { authService } from '../../services/authService';
import { auth } from '../../firebase/config';

jest.mock('../../firebase/config', () => ({
  auth: {
    currentUser: null,
    tenantId: null,
  },
}));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  setPersistence: jest.fn(),
  browserLocalPersistence: {},
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

const fb = require('firebase/auth');

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('setTenant stores tenantId in localStorage', async () => {
    await authService.setTenant('tenant-1');
    expect(localStorage.getItem('currentTenantId')).toBe('tenant-1');
  });

  it('setTenant null removes from localStorage', async () => {
    localStorage.setItem('currentTenantId', 't1');
    await authService.setTenant(null);
    expect(localStorage.getItem('currentTenantId')).toBeNull();
  });

  it('getTenantId returns stored tenantId', async () => {
    await authService.setTenant('t2');
    expect(authService.getTenantId()).toBe('t2');
  });

  it('signIn stores tenant and token when tenantId provided', async () => {
    const user = { uid: 'u1', getIdToken: jest.fn().mockResolvedValue('tok') };
    fb.signInWithEmailAndPassword.mockResolvedValue({ user });
    await authService.signIn('a@b.com', 'pw', 'tenant-1');
    expect(localStorage.getItem('currentTenantId')).toBe('tenant-1');
    expect(localStorage.getItem('tenant_u1')).toBe('tenant-1');
    expect(localStorage.getItem('authToken')).toBe('tok');
  });

  it('signIn clears tenant when tenantId not provided', async () => {
    const user = { uid: 'u1', getIdToken: jest.fn().mockResolvedValue('tok') };
    fb.signInWithEmailAndPassword.mockResolvedValue({ user });
    localStorage.setItem('currentTenantId', 't1');
    await authService.signIn('a@b.com', 'pw');
    expect(localStorage.getItem('currentTenantId')).toBeNull();
    expect((auth as any).tenantId).toBeNull();
  });

  it('resetPassword sets tenant when provided', async () => {
    await authService.resetPassword('a@b.com', 'tenant-2');
    expect(localStorage.getItem('currentTenantId')).toBe('tenant-2');
    expect(fb.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('signOut clears tenant and tokens', async () => {
    localStorage.setItem('currentTenantId', 't1');
    localStorage.setItem('authToken', 'tok');
    localStorage.setItem('authTokenExpiry', '1');
    await authService.signOut();
    expect(fb.signOut).toHaveBeenCalled();
    expect(localStorage.getItem('currentTenantId')).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('authTokenExpiry')).toBeNull();
    expect((auth as any).tenantId).toBeNull();
  });

  it('getAuthToken returns stored token if not expiring soon', async () => {
    (auth as any).currentUser = { getIdToken: jest.fn() };
    localStorage.setItem('authToken', 't');
    localStorage.setItem('authTokenExpiry', String(Date.now() + 60 * 60 * 1000));
    const token = await authService.getAuthToken();
    expect(token).toBe('t');
  });

  it('getAuthToken refreshes when expired', async () => {
    (auth as any).currentUser = { getIdToken: jest.fn().mockResolvedValue('new') };
    localStorage.setItem('authToken', 'old');
    localStorage.setItem('authTokenExpiry', String(Date.now() - 1000));
    const token = await authService.getAuthToken();
    expect(token).toBe('new');
    expect(localStorage.getItem('authToken')).toBe('new');
  });

  it('getAuthToken returns null and clears storage when no user', async () => {
    (auth as any).currentUser = null;
    localStorage.setItem('authToken', 'x');
    localStorage.setItem('authTokenExpiry', '1');
    const token = await authService.getAuthToken();
    expect(token).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('authTokenExpiry')).toBeNull();
  });

  it('refreshAuthToken forces refresh', async () => {
    (auth as any).currentUser = { getIdToken: jest.fn().mockResolvedValue('forced') };
    const token = await authService.refreshAuthToken();
    expect(token).toBe('forced');
    expect((auth as any).currentUser.getIdToken).toHaveBeenCalledWith(true);
  });

  it('getTenantId falls back to localStorage when instance tenant unset', async () => {
    await authService.setTenant(null);
    localStorage.setItem('currentTenantId', 'ls-tenant');
    expect(authService.getTenantId()).toBe('ls-tenant');
  });

  it('signIn logs error when getIdToken fails', async () => {
    const user = { uid: 'u1', getIdToken: jest.fn().mockRejectedValue(new Error('token-fail')) };
    fb.signInWithEmailAndPassword.mockResolvedValue({ user });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await authService.signIn('a@b.com', 'pw', 'tenant-1');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('signUp with tenant stores tenant and token', async () => {
    const user = { uid: 'u2', getIdToken: jest.fn().mockResolvedValue('tok2') };
    fb.createUserWithEmailAndPassword.mockResolvedValue({ user });
    await authService.signUp('n@b.com', 'pw', 'tenant-x');
    expect(localStorage.getItem('tenant_u2')).toBe('tenant-x');
    expect(localStorage.getItem('authToken')).toBe('tok2');
  });

  it('signUp without tenant clears stored tenant', async () => {
    const user = { uid: 'u3', getIdToken: jest.fn().mockResolvedValue('tok3') };
    fb.createUserWithEmailAndPassword.mockResolvedValue({ user });
    localStorage.setItem('currentTenantId', 'old');
    await authService.signUp('n2@b.com', 'pw');
    expect(localStorage.getItem('currentTenantId')).toBeNull();
    expect((auth as any).tenantId).toBeNull();
  });

  it('signUp logs error when getIdToken fails', async () => {
    const user = { uid: 'u4', getIdToken: jest.fn().mockRejectedValue(new Error('bad')) };
    fb.createUserWithEmailAndPassword.mockResolvedValue({ user });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await authService.signUp('n3@b.com', 'pw');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('resetPassword without tenant clears auth tenantId', async () => {
    (auth as any).tenantId = 'prev';
    await authService.resetPassword('a@b.com');
    expect((auth as any).tenantId).toBeNull();
    expect(fb.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('onAuthStateChange delegates to firebase', () => {
    const unsub = jest.fn();
    fb.onAuthStateChanged.mockReturnValue(unsub);
    const cb = jest.fn();
    const ret = authService.onAuthStateChange(cb);
    expect(fb.onAuthStateChanged).toHaveBeenCalledWith(auth, cb);
    expect(ret).toBe(unsub);
  });

  it('getCurrentUser returns auth.currentUser', () => {
    (auth as any).currentUser = { uid: 'cu' };
    expect(authService.getCurrentUser()).toEqual({ uid: 'cu' });
  });

  it('getAuthToken returns null when getIdToken throws', async () => {
    (auth as any).currentUser = { getIdToken: jest.fn().mockRejectedValue(new Error('x')) };
    localStorage.removeItem('authToken');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const token = await authService.getAuthToken();
    expect(token).toBeNull();
    spy.mockRestore();
  });

  it('refreshAuthToken returns null without current user', async () => {
    (auth as any).currentUser = null;
    expect(await authService.refreshAuthToken()).toBeNull();
  });

  it('refreshAuthToken returns null when getIdToken throws', async () => {
    (auth as any).currentUser = { getIdToken: jest.fn().mockRejectedValue(new Error('r')) };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await authService.refreshAuthToken()).toBeNull();
    spy.mockRestore();
  });
});
