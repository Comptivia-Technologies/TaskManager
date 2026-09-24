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
    getStageData: jest.fn(),
    getAttachments: jest.fn(),
    uploadAttachment: jest.fn(),
    downloadAttachment: jest.fn(),
    completeStage: jest.fn(),
    returnStage: jest.fn(),
    escalateStage: jest.fn(),
  },
}));

let mockCurrentMember: { memberId: string } | null = null;
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentMember: mockCurrentMember, permissions: null }),
}));

jest.mock('../../services/teamService', () => ({
  teamService: {
    getMembers: () =>
      Promise.resolve([
        { memberId: 'm-next', firstName: 'Nina', lastName: 'Rao', email: 'n@x.com', role: 'Manager', skillLevel: 3, createdAt: '', updatedAt: '' },
      ]),
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
    mockCurrentMember = null;
    (taskService.getStageData as jest.Mock).mockResolvedValue([]);
    (taskService.getAttachments as jest.Mock).mockResolvedValue([]);
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

  describe('stage actions', () => {
    const renderDetail = () =>
      render(
        <MemoryRouter initialEntries={['/tasks/1']}>
          <Routes>
            <Route path="/tasks/:id" element={<TaskDetail />} />
          </Routes>
        </MemoryRouter>
      );

    const assignToCurrentMember = () => {
      mockCurrentMember = { memberId: 'm9' };
      mockGetTask.mockResolvedValue({
        taskId: '1',
        taskName: 'Review packet',
        status: 'InProgress',
        priority: 'High',
        workflowId: 'w1',
        stageId: 's2',
        stageName: 'Team Lead',
        assignedToMemberId: 'm9',
        assignedToMemberName: 'Sreejith',
        createdAt: '2026-09-22T04:00:00Z',
        updatedAt: '2026-09-22T04:00:00Z',
      });
    };

    it('hides the actions when the viewer is not the assignee', async () => {
      renderDetail();
      expect(await screen.findByText('Review packet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /complete stage/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /send back/i })).not.toBeInTheDocument();
    });

    it('offers the actions to the assignee', async () => {
      assignToCurrentMember();
      renderDetail();
      expect(await screen.findByRole('button', { name: /complete stage/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send back/i })).toBeInTheDocument();
    });

    it('completes the current stage', async () => {
      assignToCurrentMember();
      (taskService.completeStage as jest.Mock).mockResolvedValue(undefined);
      renderDetail();

      const button = await screen.findByRole('button', { name: /complete stage/i });
      button.click();

      await waitFor(() =>
        expect(taskService.completeStage).toHaveBeenCalledWith(
          '1',
          expect.any(Object),
          undefined,
          expect.any(Object)
        )
      );
    });

    it('will not send back without a reason', async () => {
      assignToCurrentMember();
      renderDetail();

      (await screen.findByRole('button', { name: /send back/i })).click();
      const dialogButton = await screen.findByRole('button', { name: /^send back$/i });
      dialogButton.click();

      await waitFor(() => expect(taskService.returnStage).not.toHaveBeenCalled());
    });

    // The intake data is captured at registration and stored on the task, not as a
    // stage submission, so without a fallback stage 1 asked for everything twice.
    it('pre-fills the first stage from the enquiry record', async () => {
      mockCurrentMember = { memberId: 'm9' };
      mockGetTask.mockResolvedValue({
        taskId: '1',
        taskName: 'Review packet',
        status: 'InProgress',
        priority: 'High',
        workflowId: 'w1',
        stageId: 's1',
        stageName: 'Admin',
        assignedToMemberId: 'm9',
        dataJson: JSON.stringify({ notes: 'captured at registration' }),
        createdAt: '2026-09-22T04:00:00Z',
        updatedAt: '2026-09-22T04:00:00Z',
      });

      renderDetail();

      expect(await screen.findByDisplayValue('captured at registration')).toBeInTheDocument();
      // and the read-only record card is not repeated above the same fields
      expect(screen.queryByText('Enquiry record')).not.toBeInTheDocument();
    });

    it('shows the enquiry record on later stages', async () => {
      mockCurrentMember = { memberId: 'm9' };
      mockGetTask.mockResolvedValue({
        taskId: '1',
        taskName: 'Review packet',
        status: 'InProgress',
        priority: 'High',
        workflowId: 'w1',
        stageId: 's2',
        stageName: 'Team Lead',
        assignedToMemberId: 'm9',
        dataJson: JSON.stringify({ client: 'Tabins' }),
        createdAt: '2026-09-22T04:00:00Z',
        updatedAt: '2026-09-22T04:00:00Z',
      });

      renderDetail();

      expect(await screen.findByText('Enquiry record')).toBeInTheDocument();
      expect(screen.getByText('Tabins')).toBeInTheDocument();
    });

    it('offers uploading only to the assignee', async () => {
      renderDetail();
      expect(await screen.findByText('Documents')).toBeInTheDocument();
      expect(screen.queryByText('Add file')).not.toBeInTheDocument();

      assignToCurrentMember();
      renderDetail();
      expect(await screen.findByText('Add file')).toBeInTheDocument();
    });

    it('lists attachments with their size and stage', async () => {
      (taskService.getAttachments as jest.Mock).mockResolvedValue([
        {
          attachmentId: 'a1',
          taskId: '1',
          stageId: 's1',
          fileName: 'site-visit.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
          uploadedAt: '2026-09-22T05:00:00Z',
        },
      ]);
      renderDetail();
      expect(await screen.findByText('site-visit.pdf')).toBeInTheDocument();
      expect(screen.getByText(/2 KB/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });

    it('only offers earlier stages as send-back targets', async () => {
      assignToCurrentMember();
      renderDetail();

      (await screen.findByRole('button', { name: /send back/i })).click();
      expect(await screen.findByRole('option', { name: /1\. Admin/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /3\. Director/ })).not.toBeInTheDocument();
    });
  });
});