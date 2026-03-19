import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Workflows from '../../pages/Workflows';

jest.mock('../../hooks/useWorkflows', () => ({
  useWorkflows: () => ({ workflows: [], loading: false, error: null, refetch: jest.fn() }),
}));

describe('Workflows', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <Workflows />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
