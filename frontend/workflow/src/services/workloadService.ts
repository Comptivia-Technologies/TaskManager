import api from './api';
import { WorkloadResponse } from '../types';

export const workloadService = {
  getByMemberId: async (memberId: string): Promise<WorkloadResponse> => {
    const response = await api.get<WorkloadResponse>(`/api/workload/${memberId}`);
    return response.data;
  },
};

