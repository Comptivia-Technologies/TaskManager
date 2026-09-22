import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetail from '../../pages/TaskDetail';
import { taskService } from '../../services/taskService';
import { workflowService } from '../../services/workflowService';

jest.mock('../../services/taskService', () => ({
  taskService: {
    getById: jest.fn(),
    getHistory: jest.fn(),
  },
}));

jest.mock('../../services/workflowService', () => ({
  workflowService: {
    getById: jest.fn(),
    getStages: jest.fn(),
  },
}));

const mockGetTask = taskService.getById as jest.Mock;
const mockGetHistory = taskService.getHistory as jest.Mock;
const mockGetWorkflow = workflowService.getById as jest.Mock;

describe('TaskDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTask.mockResolvedValue({
      taskId: '1',
      taskName: 'Review packet',
      description: 'Check the packet',
      status: 'InProgress',
      priority: 'High',
      workflowId: 'w1',
      stageId: 's2',
      stageName: 'Team Lead',
      assignedToMemberName: 'Sreejith',
      createdAt: '2026-09-22T04:00:00Z',
      updatedAt: '2026-09-22T04:00:00Z',
    });
    mockGetWorkflow.mockResolvedValue({
      workflowId: 'w1',
      workflowName: 'Onboarding',
      createdAt: '',
      updatedAt: '',
      stages: [
        { stageId: 's1', stageName: 'Admin', stageOrder: 1, workflowId: 'w1', teamId: 't1', teamName: 'Ops', stageType: 'Process', transitionPolicy: 'OnComplete', createdAt: '', updatedAt: '' },
        { stageId: 's2', stageName: 'Team Lead', stageOrder: 2, workflowId: 'w1', teamId: 't2', teamName: 'Leads', stageType: 'Process', transitionPolicy: 'OnComplete', createdAt: '', updatedAt: '' },
        { stageId: 's3', stageName: 'Director', stageOrder: 3, workflowId: 'w1', teamId: 't3', teamName: 'Directors', stageType: 'Process', transitionPolicy: 'OnComplete', createdAt: '', updatedAt: '' },
      ],
      tasks: [],
    });
    mockGetHistory.mockResolvedValue([
      { historyId: 'h1', sequence: 1, action: 'Completed', stageId: 's1', stageName: 'Admin', stageOrder: 1, memberId: 'm1', memberName: 'Asha', fromStageId: 's1', fromStageName: 'Admin', toStageId: 's2', toStageName: 'Team Lead', occurredAt: '2026-09-22T04:00:00Z' },
    ]);
  });

  it('shows the workflow, every stage, the current assignee, and who completed earlier stages', async () => {
    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Review packet')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getAllByText('Sreejith').length).toBeGreaterThan(0);
    expect(screen.getByText('1. Admin')).toBeInTheDocument();
    expect(screen.getByText('2. Team Lead')).toBeInTheDocument();
    expect(screen.getByText('3. Director')).toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('[data-status="upcoming"]')).toBeInTheDocument();
      expect(document.querySelector('[data-status="completed"]')).toBeInTheDocument();
      expect(document.querySelector('[data-current="true"]')).toHaveTextContent('Team Lead');
    });
  });

  it('uses history when the task payload has no stage id', async () => {
    mockGetTask.mockResolvedValue({
      taskId: '1',
      taskName: 'Review packet',
      status: 'InProgress',
      priority: 'High',
      workflowId: 'w1',
      createdAt: '2026-09-22T04:00:00Z',
      updatedAt: '2026-09-22T04:00:00Z',
    });
    mockGetHistory.mockResolvedValue([
      { historyId: 'h1', sequence: 1, action: 'Assigned', stageId: 's1', stageName: 'Admin', stageOrder: 1, memberId: 'm1', memberName: 'Shilpa S', toStageId: 's1', toStageName: 'Admin', occurredAt: '2026-09-22T04:00:00Z' },
      { historyId: 'h2', sequence: 2, action: 'Completed', stageId: 's1', stageName: 'Admin', stageOrder: 1, memberId: 'm1', memberName: 'Shilpa S', fromStageId: 's1', fromStageName: 'Admin', toStageId: 's2', toStageName: 'Team Lead', occurredAt: '2026-09-22T04:10:00Z' },
      { historyId: 'h3', sequence: 3, action: 'Assigned', stageId: 's2', stageName: 'Team Lead', stageOrder: 2, memberId: 'm2', memberName: 'Ajith PR', toStageId: 's2', toStageName: 'Team Lead', occurredAt: '2026-09-22T04:19:00Z' },
    ]);

    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('1. Admin')).toBeInTheDocument();
    expect(screen.getByText('1. Admin').closest('tr')).toHaveTextContent('Completed');
    expect(screen.getByText('1. Admin').closest('tr')).toHaveTextContent('Shilpa S');
    expect(screen.getByText('2. Team Lead').closest('tr')).toHaveTextContent('Current');
    expect(screen.getByText('2. Team Lead').closest('tr')).toHaveTextContent('Ajith PR');
    expect(screen.getByText('Working now').parentElement).toHaveTextContent('Ajith PR');
    expect(screen.getByText('3. Director').closest('tr')).toHaveTextContent('Upcoming');
  });
});