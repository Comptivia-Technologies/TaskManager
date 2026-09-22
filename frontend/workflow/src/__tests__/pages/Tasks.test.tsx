import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Tasks from '../../pages/Tasks';
import { taskService } from '../../services/taskService';
import { workflowService } from '../../services/workflowService';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ organizationId: 'o1' }),
}));

jest.mock('../../services/taskService', () => ({
  taskService: {
    getAllPaginated: jest.fn(),
  },
}));

jest.mock('../../services/workflowService', () => ({
  workflowService: {
    getAll: jest.fn(),
  },
}));

const mockGetAllPaginated = taskService.getAllPaginated as jest.Mock;
const mockGetAllWorkflows = workflowService.getAll as jest.Mock;

describe('Tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllPaginated.mockResolvedValue({
      data: [],
      totalCount: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    mockGetAllWorkflows.mockResolvedValue([]);
  });

  it('renders without crashing and loads data', async () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetAllPaginated).toHaveBeenCalled();
    }, { timeout: 3000 });
    expect(document.body).toBeInTheDocument();
  });

  it('shows tasks content after loading', async () => {
    mockGetAllPaginated.mockResolvedValue({
      data: [{ taskId: '1', taskName: 'T1', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('T1')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('opens task details when a task row is clicked', async () => {
    mockGetAllPaginated.mockResolvedValue({
      data: [{ taskId: '1', taskName: 'T1', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Routes>
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<div>Task details</div>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByText('T1'));
    expect(await screen.findByText('Task details')).toBeInTheDocument();
  });
});
