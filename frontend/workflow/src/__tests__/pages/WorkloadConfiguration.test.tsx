import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkloadConfiguration from '../../pages/WorkloadConfiguration';

jest.mock('../../services/memberService', () => ({
  memberService: { getAll: jest.fn().mockResolvedValue([]) },
}));

describe('WorkloadConfiguration', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <WorkloadConfiguration />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
