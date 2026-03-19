import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkflowCreate from '../../components/WorkflowCreate';

jest.mock('../../hooks/useTeams', () => ({
  useTeams: () => ({ teams: [{ teamId: 't1', teamName: 'Team 1' }], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../../services/workflowService', () => ({
  workflowService: {
    create: jest.fn().mockResolvedValue({ workflowId: 'w1', workflowName: 'WF', description: '' }),
    updateJson: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/stageService', () => ({
  stageService: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('react-toastify', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('react-icons/fi', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: () => (props: any) => React.createElement('span', props),
    }
  );
});

describe('WorkflowCreate', () => {
  it('creates workflow and stages', async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();

    render(<WorkflowCreate onSuccess={onSuccess} onCancel={onCancel} />);

    fireEvent.change(screen.getByPlaceholderText('Enter workflow name'), { target: { value: 'WF 1' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByPlaceholderText(/To Do, In Progress, Done/i), { target: { value: 'To Do' } });
    const label = screen.getByText('Assign Team *');
    const select = label.parentElement?.querySelector('select');
    if (!select) throw new Error('Assign Team select not found');
    fireEvent.change(select, { target: { value: 't1' } });
    fireEvent.click(screen.getByText('Add Stage'));

    fireEvent.click(screen.getByRole('button', { name: 'Create Workflow' }));

    await waitFor(() => {
      const { workflowService } = require('../../services/workflowService');
      expect(workflowService.create).toHaveBeenCalled();
    });
  });
});

