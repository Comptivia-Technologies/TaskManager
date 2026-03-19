import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from '../../components/TaskCard';

jest.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

const task = {
  taskId: '1',
  taskName: 'Test Task',
  status: 'Open',
  priority: 'High',
  workflowId: 'w1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('TaskCard', () => {
  it('renders task name', () => {
    const onUpdate = jest.fn();
    render(<TaskCard task={task} onUpdate={onUpdate} />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('calls onUpdate when save is clicked in edit mode', () => {
    const onUpdate = jest.fn();
    render(<TaskCard task={task} onUpdate={onUpdate} />);
    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    expect(onUpdate).toHaveBeenCalledWith({ status: 'Open', priority: 'High' });
  });
});
