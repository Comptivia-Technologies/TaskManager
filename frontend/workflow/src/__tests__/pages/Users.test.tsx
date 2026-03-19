import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Users from '../../pages/Users';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ organizationId: 'o1', currentTenantId: null }),
}));
jest.mock('../../services/userService', () => ({
  userService: {
    getActiveOrganizationUsers: jest.fn().mockResolvedValue([]),
    getPendingInvitations: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../services/roleService', () => ({
  roleService: { getByOrganization: jest.fn().mockResolvedValue([]) },
}));

describe('Users', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <Users />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
