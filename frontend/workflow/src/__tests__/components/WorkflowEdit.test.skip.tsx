import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkflowEdit from '../../components/WorkflowEdit';

jest.mock('../../hooks/useTeams', () => ({
  useTeams: () => ({ teams: [{ teamId: 't1', teamName: 'Team 1' }], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../../services/workflowService', () => ({
  workflowService: {
    update: jest.fn().mockResolvedValue(undefined),
    updateJson: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/stageService', () => ({
  stageService: {
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue(undefined),
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

describe('WorkflowEdit', () => {
  it('submits updates', async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    const workflow: any = {
      workflowId: 'w1',
      workflowName: 'WF 1',
      description: 'd',
      createdAt: new Date().toISOString(),
      stages: [
        { stageId: 's1', stageName: 'To Do', stageOrder: 1, teamId: 't1', teamName: 'Team 1' },
      ],
    };

    render(<WorkflowEdit workflow={workflow} onSuccess={onSuccess} onCancel={onCancel} />);

    fireEvent.change(screen.getByDisplayValue('WF 1'), { target: { value: 'WF 2' } });
    fireEvent.click(screen.getByText('Update Workflow'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

