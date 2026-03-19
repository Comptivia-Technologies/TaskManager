import React from 'react';
import { render, screen } from '@testing-library/react';
import KanbanColumn from '../../components/KanbanColumn';

// Mock dnd-kit hooks/components used inside the column
jest.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: () => {} }),
}));
jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable">{children}</div>,
  verticalListSortingStrategy: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

describe('KanbanColumn', () => {
  const stage = {
    stageId: 's1',
    stageName: 'Todo',
    stageOrder: 1,
    workflowId: 'w1',
    teamId: 't1',
    teamName: 'Team A',
    stageType: 'Process' as const,
    transitionPolicy: 'OnComplete' as const,
    createdAt: '',
  };

  it('renders with no tasks', () => {
    render(
      <KanbanColumn
        stage={stage}
        tasks={[]}
        onTaskUpdate={jest.fn()}
      />
    );
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('No tasks in this stage')).toBeInTheDocument();
  });

  it('renders count of tasks', () => {
    const tasks = [{
      taskId: '1',
      taskName: 'Task 1',
      status: 'Open',
      priority: 'High',
      workflowId: 'w1',
      stageId: 's1',
      createdAt: '',
      updatedAt: '',
    }];
    render(
      <KanbanColumn
        stage={stage}
        tasks={tasks as any}
        onTaskUpdate={jest.fn()}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

