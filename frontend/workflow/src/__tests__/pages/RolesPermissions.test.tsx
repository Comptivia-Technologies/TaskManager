import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RolesPermissions from '../../pages/RolesPermissions';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ organizationId: 'o1' }),
}));
jest.mock('../../services/roleService', () => ({
  roleService: { getByOrganization: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../services/permissionService', () => ({
  permissionService: { getAll: jest.fn().mockResolvedValue([]) },
}));

describe('RolesPermissions', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <RolesPermissions />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
