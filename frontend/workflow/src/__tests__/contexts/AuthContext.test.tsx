import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

jest.mock('../../services/authService', () => ({
  authService: {
    isAuthenticated: jest.fn(),
    getStoredUser: jest.fn(),
    getMe: jest.fn(),
    login: jest.fn(),
    signOut: jest.fn(),
  },
}));

const { authService } = require('../../services/authService');

const Consumer = () => {
  const { loading, user, hasPermission } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="perm">{String(hasPermission('tasks.view'))}</span>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.isAuthenticated.mockReturnValue(false);
    authService.getStoredUser.mockReturnValue(null);
    authService.getMe.mockResolvedValue(null);
  });

  it('finishes loading with no user when not authenticated', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('loads stored user and refreshes from API', async () => {
    const user = {
      userId: 'u1',
      email: 'admin@test.com',
      fullName: 'Admin',
      roleId: 'r1',
      roleName: 'Administrator',
      isActive: true,
      permissions: ['tasks.view'],
    };
    authService.isAuthenticated.mockReturnValue(true);
    authService.getStoredUser.mockReturnValue(user);
    authService.getMe.mockResolvedValue(user);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('admin@test.com'));
    expect(screen.getByTestId('perm')).toHaveTextContent('true');
  });
});
