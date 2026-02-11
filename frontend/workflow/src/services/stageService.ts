import api from './api';
import { Stage, StageCreate, StageUpdate } from '../types';

export const stageService = {
  getAll: async (): Promise<Stage[]> => {
    const response = await api.get<Stage[]>('/api/stages');
    return response.data;
  },

  getById: async (id: number): Promise<Stage> => {
    const response = await api.get<Stage>(`/api/stages/${id}`);
    return response.data;
  },

  create: async (stage: StageCreate): Promise<Stage> => {
    const response = await api.post<Stage>('/api/stages', stage);
    return response.data;
  },

  update: async (id: number, stage: StageUpdate): Promise<Stage> => {
    const response = await api.put<Stage>(`/api/stages/${id}`, stage);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/stages/${id}`);
  },

  getByWorkflow: async (workflowId: number): Promise<Stage[]> => {
    const response = await api.get<Stage[]>(`/api/stages/workflow/${workflowId}`);
    return response.data;
  },
};



