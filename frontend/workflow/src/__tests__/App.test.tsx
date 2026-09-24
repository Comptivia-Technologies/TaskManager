import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({ currentMember: null, permissions: null, sessionLoading: false }),
}));
jest.mock('../components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('../pages/Login', () => ({ Login: () => <div>Login Page</div> }));
jest.mock('../components/Sidebar', () => () => <div>Sidebar</div>);

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });
});
