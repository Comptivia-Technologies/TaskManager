import api from './api';
import { Task, TaskUpdate, PaginatedTasksResponse, TaskStageHistory } from '../types';

export const taskService = {
  getAll: async (): Promise<Task[]> => {
    const response = await api.get<PaginatedTasksResponse | Task[]>('/api/tasks');
    const raw = response.data;
    if (Array.isArray(raw)) return raw;
    return Array.isArray(raw?.data) ? raw.data : [];
  },

  getAllPaginated: async (priority?: string, page = 1, limit = 10): Promise<PaginatedTasksResponse> => {
    const params = new URLSearchParams();
    if (priority?.trim()) params.set('priority', priority.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));
    const response = await api.get<PaginatedTasksResponse | Task[]>(`/api/tasks?${params.toString()}`);
    const raw = response.data;
    if (Array.isArray(raw)) {
      return { data: raw, totalCount: raw.length, page: 1, limit: raw.length || 10, totalPages: raw.length ? 1 : 0 };
    }
    return {
      data: Array.isArray(raw?.data) ? raw.data : [],
      totalCount: raw?.totalCount ?? 0,
      page: raw?.page ?? 1,
      limit: raw?.limit ?? 10,
      totalPages: raw?.totalPages ?? 0
    };
  },

  getById: async (id: string): Promise<Task> => {
    const response = await api.get<Task>(`/api/tasks/${id}`);
    return response.data;
  },

  update: async (id: string, task: TaskUpdate): Promise<Task> => {
    const response = await api.put<Task>(`/api/tasks/${id}`, task);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/tasks/${id}`);
  },

  getByWorkflow: async (workflowId: string): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/workflow/${workflowId}`);
    return response.data;
  },

  getByStage: async (stageId: string): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/stage/${stageId}`);
    return response.data;
  },

  getByMember: async (memberId: string): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/member/${memberId}`);
    return response.data;
  },

  getHistory: async (id: string): Promise<TaskStageHistory[]> => {
    const response = await api.get<TaskStageHistory[]>(`/api/task-service/${id}/history`);
    return Array.isArray(response.data) ? response.data : [];
  },
};



