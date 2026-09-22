import React from 'react';
import { render, screen } from '@testing-library/react';
import TaskHistoryGraph, { buildStageGraph } from '../../components/TaskHistoryGraph';
import { TaskStageHistory } from '../../types';

const entry = (partial: Partial<TaskStageHistory> & Pick<TaskStageHistory, 'historyId' | 'sequence' | 'action' | 'stageId' | 'stageName' | 'stageOrder'>): TaskStageHistory => ({
  memberId: 'm1',
  memberName: 'Sreejith',
  occurredAt: '2026-09-22T04:00:00Z',
  ...partial,
});

const history: TaskStageHistory[] = [
  entry({ historyId: 'h1', sequence: 1, action: 'Assigned', stageId: 's1', stageName: 'L1', stageOrder: 1, toStageId: 's1', toStageName: 'L1' }),
  entry({ historyId: 'h2', sequence: 2, action: 'Completed', stageId: 's1', stageName: 'L1', stageOrder: 1, fromStageId: 's1', fromStageName: 'L1', toStageId: 's2', toStageName: 'L2' }),
  entry({ historyId: 'h3', sequence: 3, action: 'Assigned', stageId: 's2', stageName: 'L2', stageOrder: 2, toStageId: 's2', toStageName: 'L2' }),
  entry({ historyId: 'h4', sequence: 4, action: 'Completed', stageId: 's2', stageName: 'L2', stageOrder: 2, fromStageId: 's2', fromStageName: 'L2', toStageId: 's3', toStageName: 'L3' }),
  entry({ historyId: 'h5', sequence: 5, action: 'Assigned', stageId: 's3', stageName: 'L3', stageOrder: 3, toStageId: 's3', toStageName: 'L3' }),
  entry({ historyId: 'h6', sequence: 6, action: 'Returned', stageId: 's3', stageName: 'L3', stageOrder: 3, fromStageId: 's3', fromStageName: 'L3', toStageId: 's2', toStageName: 'L2' }),
  entry({ historyId: 'h7', sequence: 7, action: 'Completed', stageId: 's2', stageName: 'L2', stageOrder: 2, fromStageId: 's2', fromStageName: 'L2', toStageId: 's3', toStageName: 'L3' }),
];

describe('TaskHistoryGraph', () => {
  it('draws the first forward pass on the center line and routes a return above', () => {
    const graph = buildStageGraph(history);

    expect(graph.nodes.map((node) => node.name)).toEqual(['L1', 'L2', 'L3']);
    expect(graph.edges.map((edge) => edge.kind)).toEqual(['center', 'center', 'backward', 'forward']);
    expect(graph.edges[2]).toMatchObject({ from: 2, to: 1, kind: 'backward' });
    expect(graph.edges[3]).toMatchObject({ from: 1, to: 2, kind: 'forward' });
  });

  it('includes workflow stages the task has not reached', () => {
    const graph = buildStageGraph(history, [
      { stageId: 's1', stageName: 'L1', stageOrder: 1 },
      { stageId: 's2', stageName: 'L2', stageOrder: 2 },
      { stageId: 's3', stageName: 'L3', stageOrder: 3 },
      { stageId: 's4', stageName: 'L4', stageOrder: 4 },
    ]);

    expect(graph.nodes.map((node) => node.name)).toEqual(['L1', 'L2', 'L3', 'L4']);
  });

  it('renders stage names and a returned path', () => {
    render(<TaskHistoryGraph history={history} />);

    const diagram = screen.getByRole('img', { name: 'L1, L2, L3, back to L2, L3' });
    expect(diagram).toBeInTheDocument();
    expect(diagram.querySelectorAll('tspan')).toHaveLength(3);
    expect(Array.from(diagram.querySelectorAll('tspan')).map((node) => node.textContent)).toEqual(['L1', 'L2', 'L3']);
    expect(document.querySelector('[data-kind="backward"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-kind="center"]')).toHaveLength(2);
    expect(document.querySelector('[data-kind="forward"]')).toBeInTheDocument();
    expect(diagram.querySelector('[data-current="true"]')).toHaveTextContent('L3');
  });

  it('glows the task current stage', () => {
    render(<TaskHistoryGraph history={history} currentStageId="s2" />);
    expect(screen.getByRole('img').querySelector('[data-current="true"]')).toHaveTextContent('L2');
  });
});
