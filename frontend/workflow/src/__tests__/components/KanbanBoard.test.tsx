import React from 'react';
import { render, screen } from '@testing-library/react';
import KanbanBoard from '../../components/KanbanBoard';

// Stub dnd-kit top-level components to avoid drag runtime
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div data-testid="dnd">{children}</div>,
  DragOverlay: ({ children }: any) => <div data-testid="overlay">{children}</div>,
  closestCorners: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: () => {} }),
}));
jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable">{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
  arrayMove: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// Keep TaskCard light
jest.mock('../../components/TaskCard', () => (props: any) => <div data-testid={`task-${props.task.taskId}`}>{props.task.taskName}</div>);

describe('KanbanBoard', () => {
  const workflow = {
    workflowId: 'w1',
    workflowName: 'WF',
    createdAt: '',
    updatedAt: '',
    stages: [
      {
        stageId: 's1',
        stageName: 'Todo',
        stageOrder: 1,
        workflowId: 'w1',
        teamId: 't1',
        teamName: 'Team A',
        stageType: 'Process' as const,
        transitionPolicy: 'OnComplete' as const,
        createdAt: '',
      },
    ],
    tasks: [
      { taskId: '1', taskName: 'Task 1', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' },
      { taskId: '2', taskName: 'Task 2', status: 'Open', priority: 'Low', workflowId: 'w1', stageId: 's1', createdAt: '', updatedAt: '' },
    ],
  };

  it('renders columns and tasks', () => {
    render(
      <KanbanBoard
        workflow={workflow as any}
        onTaskMove={jest.fn()}
        onTaskUpdate={jest.fn()}
      />
    );
    // Unassigned count and stage title
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument();
    // Task cards rendered
    expect(screen.getByTestId('task-1')).toHaveTextContent('Task 1');
    expect(screen.getByTestId('task-2')).toHaveTextContent('Task 2');
  });
});

