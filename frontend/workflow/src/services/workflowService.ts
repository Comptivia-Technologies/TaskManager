import api from './api';
import { Workflow, WorkflowCreate, WorkflowUpdate } from '../types';

export const workflowService = {
  getAll: async (): Promise<Workflow[]> => {
    const response = await api.get<Workflow[]>('/api/workflows');
    return response.data;
  },

  getById: async (id: number): Promise<Workflow> => {
    const response = await api.get<Workflow>(`/api/workflows/${id}`);
    return response.data;
  },

  create: async (workflow: WorkflowCreate): Promise<Workflow> => {
    const response = await api.post<Workflow>('/api/workflows', workflow);
    return response.data;
  },

  update: async (id: number, workflow: WorkflowUpdate): Promise<Workflow> => {
    const response = await api.put<Workflow>(`/api/workflows/${id}`, workflow);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/workflows/${id}`);
  },

  getStages: async (workflowId: number) => {
    const response = await api.get(`/api/workflows/${workflowId}/stages`);
    return response.data;
  },

  getTasks: async (workflowId: number) => {
    const response = await api.get(`/api/workflows/${workflowId}/tasks`);
    return response.data;
  },

  getJson: async (workflowId: number): Promise<Workflow> => {
    const response = await api.get<Workflow>(`/api/workflows/${workflowId}/json`);
    return response.data;
  },

  updateJson: async (workflowId: number): Promise<void> => {
    await api.post(`/api/workflows/${workflowId}/update-json`);
  },
};



