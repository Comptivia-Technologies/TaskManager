import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../../pages/Login';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: jest.fn(),
    signUp: jest.fn(),
    setTenant: jest.fn(),
    fetchTenantId: jest.fn().mockResolvedValue(null),
    currentTenantId: null,
  }),
}));
jest.mock('../../services/tenantService', () => ({
  fetchTenantIdByEmail: jest.fn().mockResolvedValue({ tenantId: null, exists: false }),
}));

describe('Login', () => {
  it('renders login form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });
});
