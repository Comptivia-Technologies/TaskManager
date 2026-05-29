import api from './api';

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  permissions: string[];
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

class AuthServiceImpl {
  async login(email: string, password: string): Promise<AuthUser> {
    const response = await api.post<LoginResponse>('/api/auth/login', { email, password });
    const { token, user } = response.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  async getMe(): Promise<AuthUser | null> {
    try {
      const response = await api.get<AuthUser>('/api/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(response.data));
      return response.data;
    } catch {
      return null;
    }
  }

  getStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  hasPermission(permission: string): boolean {
    const user = this.getStoredUser();
    return user?.permissions?.includes(permission) ?? false;
  }
}

export const authService = new AuthServiceImpl();
