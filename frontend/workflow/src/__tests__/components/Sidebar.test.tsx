import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

const mockSignOut = jest.fn();
const mockNavigate = jest.fn();
let mockPermissions: string[] | null = null;

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    user: { uid: '1', email: 'a@b.com' },
    permissions: mockPermissions,
  }),
}));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = null;
  });

  it('renders and shows Workflows link', () => {
    renderSidebar();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
  });

  it('shows Teams and Members links', () => {
    renderSidebar();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('no longer offers a separate Tasks screen', () => {
    renderSidebar();
    expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
  });

  it('always shows Enquiries', () => {
    mockPermissions = [];
    renderSidebar();
    expect(screen.getByText('Enquiries')).toBeInTheDocument();
  });

  it('hides admin areas when the role grants no permissions', () => {
    mockPermissions = [];
    renderSidebar();
    expect(screen.queryByText('Workflows')).not.toBeInTheDocument();
    expect(screen.queryByText('Teams')).not.toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('shows only the areas the role grants', () => {
    mockPermissions = ['teams.view'];
    renderSidebar();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.queryByText('Workflows')).not.toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
  });

  it('shows User Management when any of its children is permitted', () => {
    mockPermissions = ['roles.view'];
    renderSidebar();
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });
});
