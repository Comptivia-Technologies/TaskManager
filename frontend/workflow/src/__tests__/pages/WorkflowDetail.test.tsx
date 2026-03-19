import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkflowDetail from '../../pages/WorkflowDetail';

jest.mock('../../services/workflowService', () => ({
  workflowService: { getById: jest.fn().mockRejectedValue(new Error('not found')) },
}));

describe('WorkflowDetail', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/workflows/1']}>
        <Routes>
          <Route path="/workflows/:id" element={<WorkflowDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
