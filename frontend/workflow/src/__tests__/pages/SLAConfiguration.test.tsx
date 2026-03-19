import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SLAConfiguration from '../../pages/SLAConfiguration';

jest.mock('../../services/workflowService', () => ({
  workflowService: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../services/slaService', () => ({
  slaService: { getAll: jest.fn().mockResolvedValue([]) },
}));

describe('SLAConfiguration', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <SLAConfiguration />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
