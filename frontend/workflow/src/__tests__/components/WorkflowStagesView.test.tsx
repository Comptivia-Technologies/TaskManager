import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkflowStagesView from '../../components/WorkflowStagesView';

jest.mock('react-icons/fi', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: () => (props: any) => React.createElement('span', props),
    }
  );
});

describe('WorkflowStagesView', () => {
  it('renders overview and stages count', () => {
    jest.useFakeTimers();
    const workflow: any = {
      workflowId: 'w1',
      workflowName: 'WF',
      description: '',
      createdAt: new Date().toISOString(),
      stages: [
        { stageId: 's1', stageName: 'A', stageOrder: 2, teamId: 't1', teamName: 'Team 1', createdAt: '', updatedAt: '' },
        { stageId: 's2', stageName: 'B', stageOrder: 1, teamId: 't1', teamName: 'Team 1', createdAt: '', updatedAt: '' },
      ],
    };

    const { unmount } = render(<WorkflowStagesView workflow={workflow} />);
    expect(screen.getByText('Workflow Overview')).toBeInTheDocument();
    expect(screen.getByText('Total Stages')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();

    jest.runOnlyPendingTimers();
    unmount();
    jest.useRealTimers();
  });
});

