import axios from 'axios';
import { ManagedTask, ManagedTaskCreate } from './types';

const api = axios.create({
  baseURL: 'http://localhost:5004/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const taskManagerService = {
  getAll: async (): Promise<ManagedTask[]> => {
    const response = await api.get<ManagedTask[]>('/task-manager/tasks');
    return response.data;
  },

  getById: async (id: number): Promise<ManagedTask> => {
    const response = await api.get<ManagedTask>(`/task-manager/tasks/${id}`);
    return response.data;
  },

  create: async (task: ManagedTaskCreate): Promise<ManagedTask> => {
    const response = await api.post<ManagedTask>('/task-manager/tasks', task);
    return response.data;
  },
};


