import api from './api';
import { Workflow, WorkflowCreate, WorkflowUpdate } from '../types';

export const workflowService = {
  getAll: async (): Promise<Workflow[]> => {
    const response = await api.get<Workflow[]>('/workflows');
    return response.data;
  },

  getById: async (id: number): Promise<Workflow> => {
    const response = await api.get<Workflow>(`/workflows/${id}`);
    return response.data;
  },

  create: async (workflow: WorkflowCreate): Promise<Workflow> => {
    const response = await api.post<Workflow>('/workflows', workflow);
    return response.data;
  },

  update: async (id: number, workflow: WorkflowUpdate): Promise<Workflow> => {
    const response = await api.put<Workflow>(`/workflows/${id}`, workflow);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/workflows/${id}`);
  },

  getStages: async (workflowId: number) => {
    const response = await api.get(`/workflows/${workflowId}/stages`);
    return response.data;
  },

  getTasks: async (workflowId: number) => {
    const response = await api.get(`/workflows/${workflowId}/tasks`);
    return response.data;
  },

  getJson: async (workflowId: number): Promise<Workflow> => {
    const response = await api.get<Workflow>(`/workflows/${workflowId}/json`);
    return response.data;
  },

  updateJson: async (workflowId: number): Promise<void> => {
    await api.post(`/workflows/${workflowId}/update-json`);
  },
};



