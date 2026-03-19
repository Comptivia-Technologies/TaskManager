import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';

jest.mock('../../hooks/useTeams', () => ({
  useTeams: () => ({ teams: [], loading: false }),
}));
jest.mock('../../hooks/useMembers', () => ({
  useMembers: () => ({ members: [], loading: false }),
}));
jest.mock('../../hooks/useWorkflows', () => ({
  useWorkflows: () => ({ workflows: [], loading: false }),
}));

describe('Dashboard', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });

  it('shows Dashboard heading and stats', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Teams')).toBeInTheDocument();
    expect(screen.getByText('Recent Workflows')).toBeInTheDocument();
  });
});
