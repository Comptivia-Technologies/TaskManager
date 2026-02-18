import api from './api';
import { Workflow, WorkflowCreate, WorkflowUpdate } from '../types';

export const workflowService = {
  getAll: async (): Promise<Workflow[]> => {
    const response = await api.get<Workflow[]>('/api/workflows');
    return response.data;
  },

  getById: async (id: string): Promise<Workflow> => {
    const response = await api.get<Workflow>(`/api/workflows/${id}`);
    return response.data;
  },

  create: async (workflow: WorkflowCreate): Promise<Workflow> => {
    const response = await api.post<Workflow>('/api/workflows', workflow);
    return response.data;
  },

  update: async (id: string, workflow: WorkflowUpdate): Promise<Workflow> => {
    const response = await api.put<Workflow>(`/api/workflows/${id}`, workflow);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/workflows/${id}`);
  },

  getStages: async (workflowId: string) => {
    const response = await api.get(`/api/workflows/${workflowId}/stages`);
    return response.data;
  },

  getTasks: async (workflowId: string) => {
    const response = await api.get(`/api/workflows/${workflowId}/tasks`);
    return response.data;
  },

  getJson: async (workflowId: string): Promise<Workflow> => {
    const response = await api.get<Workflow>(`/api/workflows/${workflowId}/json`);
    return response.data;
  },

  updateJson: async (workflowId: string): Promise<void> => {
    await api.post(`/api/workflows/${workflowId}/update-json`);
  },
};



