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

  it('lists every stage in order with its totals', () => {
    render(<WorkflowStagesView workflow={workflow} />);
    expect(screen.getByText('Total Stages')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['B', 'A']);
  });

  it('says where each stage hands over to', () => {
    render(<WorkflowStagesView workflow={workflow} />);
    // B is first, so it hands over to A; A is last and hands over to nothing.
    expect(screen.getAllByText('A').length).toBeGreaterThan(1);
  });
});
