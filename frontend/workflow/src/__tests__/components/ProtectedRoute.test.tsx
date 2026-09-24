import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../../components/ProtectedRoute';

const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading when loading is true', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <span>Child</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Signing you in/);
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('redirects to login when not loading and no user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <span>Child</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('renders children when user is present', () => {
    mockUseAuth.mockReturnValue({ user: { uid: '1' } as any, loading: false });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <span>Child</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
  });
});
