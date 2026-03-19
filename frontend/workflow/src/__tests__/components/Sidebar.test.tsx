import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

const mockSignOut = jest.fn();
const mockNavigate = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ signOut: mockSignOut, user: { uid: '1', email: 'a@b.com' } }),
}));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and shows Workflows link', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('Workflows')).toBeInTheDocument();
  });

  it('shows Tasks, Teams, Members links', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });
});
