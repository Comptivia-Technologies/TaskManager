import { authService } from '../../services/authService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockApi = api as jest.Mocked<typeof api>;

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('login stores token and user', async () => {
    const user = {
      userId: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      roleId: 'r1',
      roleName: 'Admin',
      isActive: true,
      permissions: ['tasks.view'],
    };
    mockApi.post.mockResolvedValue({ data: { token: 'tok', expiresAt: '2099-01-01', user } });

    const result = await authService.login('a@b.com', 'pw');

    expect(result).toEqual(user);
    expect(localStorage.getItem('authToken')).toBe('tok');
    expect(JSON.parse(localStorage.getItem('authUser')!)).toEqual(user);
  });

  it('getMe updates stored user', async () => {
    const user = {
      userId: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      roleId: 'r1',
      roleName: 'Admin',
      isActive: true,
      permissions: [],
    };
    mockApi.get.mockResolvedValue({ data: user });

    const result = await authService.getMe();

    expect(result).toEqual(user);
    expect(JSON.parse(localStorage.getItem('authUser')!)).toEqual(user);
  });

  it('getMe returns null on error', async () => {
    mockApi.get.mockRejectedValue(new Error('401'));
    const result = await authService.getMe();
    expect(result).toBeNull();
  });

  it('isAuthenticated reflects token presence', () => {
    expect(authService.isAuthenticated()).toBe(false);
    localStorage.setItem('authToken', 't');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('signOut clears storage', async () => {
    localStorage.setItem('authToken', 't');
    localStorage.setItem('authUser', '{}');
    await authService.signOut();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('authUser')).toBeNull();
  });

  it('hasPermission checks stored user permissions', () => {
    localStorage.setItem(
      'authUser',
      JSON.stringify({
        userId: 'u1',
        email: 'a@b.com',
        fullName: 'A',
        roleId: 'r1',
        roleName: 'Admin',
        isActive: true,
        permissions: ['tasks.view'],
      })
    );
    expect(authService.hasPermission('tasks.view')).toBe(true);
    expect(authService.hasPermission('tasks.manage')).toBe(false);
  });
});
