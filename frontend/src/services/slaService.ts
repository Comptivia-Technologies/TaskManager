import api from './api';
import { SLAConfiguration, SLAConfigurationCreate, SLAConfigurationUpdate } from '../types';

export const slaService = {
  getAll: async (): Promise<SLAConfiguration[]> => {
    const response = await api.get<SLAConfiguration[]>('/sla-configurations');
    return response.data;
  },

  getByWorkflowId: async (workflowId: number): Promise<SLAConfiguration> => {
    const response = await api.get<SLAConfiguration>(`/sla-configurations/workflow/${workflowId}`);
    return response.data;
  },

  create: async (slaConfig: SLAConfigurationCreate): Promise<SLAConfiguration> => {
    const response = await api.post<SLAConfiguration>('/sla-configurations', slaConfig);
    return response.data;
  },

  update: async (workflowId: number, slaConfig: SLAConfigurationUpdate): Promise<SLAConfiguration> => {
    const response = await api.put<SLAConfiguration>(`/sla-configurations/workflow/${workflowId}`, slaConfig);
    return response.data;
  },

  delete: async (workflowId: number): Promise<void> => {
    await api.delete(`/sla-configurations/workflow/${workflowId}`);
  },
};

