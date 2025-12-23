import taskManagerApi from './taskManagerApi';
import { ManagedTask, ManagedTaskCreate } from '../types';

export const taskManagerService = {
  getAll: async (): Promise<ManagedTask[]> => {
    const response = await taskManagerApi.get<ManagedTask[]>('/task-manager/tasks');
    return response.data;
  },

  getById: async (id: number): Promise<ManagedTask> => {
    const response = await taskManagerApi.get<ManagedTask>(`/task-manager/tasks/${id}`);
    return response.data;
  },

  create: async (task: ManagedTaskCreate): Promise<ManagedTask> => {
    const response = await taskManagerApi.post<ManagedTask>('/task-manager/tasks', task);
    return response.data;
  },
};


