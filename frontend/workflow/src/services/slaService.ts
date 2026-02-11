import slaApi from './slaApi';
import { SLAConfiguration, SLAConfigurationCreate, SLAConfigurationUpdate } from '../types';

export const slaService = {
  getAll: async (): Promise<SLAConfiguration[]> => {
    const response = await slaApi.get<SLAConfiguration[]>('/api/sla-configurations');
    return response.data;
  },

  getByWorkflowId: async (workflowId: number): Promise<SLAConfiguration> => {
    const response = await slaApi.get<SLAConfiguration>(`/api/sla-configurations/workflow/${workflowId}`);
    return response.data;
  },

  create: async (slaConfig: SLAConfigurationCreate): Promise<SLAConfiguration> => {
    const response = await slaApi.post<SLAConfiguration>('/api/sla-configurations', slaConfig);
    return response.data;
  },

  update: async (workflowId: number, slaConfig: SLAConfigurationUpdate): Promise<SLAConfiguration> => {
    const response = await slaApi.put<SLAConfiguration>(`/api/sla-configurations/workflow/${workflowId}`, slaConfig);
    return response.data;
  },

  delete: async (workflowId: number): Promise<void> => {
    await slaApi.delete(`/api/sla-configurations/workflow/${workflowId}`);
  },
};

