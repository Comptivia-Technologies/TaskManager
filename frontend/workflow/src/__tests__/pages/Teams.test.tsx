import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Teams from '../../pages/Teams';

jest.mock('../../hooks/useTeams', () => ({
  useTeams: () => ({ teams: [], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../../hooks/useMembers', () => ({
  useMembers: () => ({ members: [], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

describe('Teams', () => {
  it('renders without crashing', async () => {
    render(
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Teams')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(document.body).toBeInTheDocument();
  });
});
