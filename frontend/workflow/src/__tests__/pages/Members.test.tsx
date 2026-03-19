import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Members from '../../pages/Members';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ organizationId: 'o1' }),
}));
jest.mock('../../hooks/useMembers', () => ({
  useMembers: () => ({ members: [], loading: false, error: null, refetch: jest.fn() }),
}));

describe('Members', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <Members />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
