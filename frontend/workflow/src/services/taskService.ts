import api from './api';
import { Task, TaskCreate, TaskUpdate } from '../types';

export const taskService = {
  getAll: async (): Promise<Task[]> => {
    const response = await api.get<Task[]>('/api/tasks');
    return response.data;
  },

  getById: async (id: number): Promise<Task> => {
    const response = await api.get<Task>(`/api/tasks/${id}`);
    return response.data;
  },

  create: async (task: TaskCreate): Promise<Task> => {
    const response = await api.post<Task>('/api/tasks', task);
    return response.data;
  },

  update: async (id: number, task: TaskUpdate): Promise<Task> => {
    const response = await api.put<Task>(`/api/tasks/${id}`, task);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/tasks/${id}`);
  },

  getByWorkflow: async (workflowId: number): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/workflow/${workflowId}`);
    return response.data;
  },

  getByStage: async (stageId: number): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/stage/${stageId}`);
    return response.data;
  },

  getByMember: async (memberId: number): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/member/${memberId}`);
    return response.data;
  },
};



