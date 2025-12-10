import api from './api';
import { Task, TaskCreate, TaskUpdate } from '../types';

export const taskService = {
  getAll: async (): Promise<Task[]> => {
    const response = await api.get<Task[]>('/tasks');
    return response.data;
  },

  getById: async (id: number): Promise<Task> => {
    const response = await api.get<Task>(`/tasks/${id}`);
    return response.data;
  },

  create: async (task: TaskCreate): Promise<Task> => {
    const response = await api.post<Task>('/tasks', task);
    return response.data;
  },

  update: async (id: number, task: TaskUpdate): Promise<Task> => {
    const response = await api.put<Task>(`/tasks/${id}`, task);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },

  getByWorkflow: async (workflowId: number): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/tasks/workflow/${workflowId}`);
    return response.data;
  },

  getByStage: async (stageId: number): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/tasks/stage/${stageId}`);
    return response.data;
  },

  getByMember: async (memberId: number): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/tasks/member/${memberId}`);
    return response.data;
  },
};



