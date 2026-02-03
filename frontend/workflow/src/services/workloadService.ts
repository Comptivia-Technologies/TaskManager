import axios from 'axios';
import { WorkloadResponse } from '../types';

const workloadApi = axios.create({
  baseURL: 'http://localhost:5004/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const workloadService = {
  getByMemberId: async (memberId: number): Promise<WorkloadResponse> => {
    const response = await workloadApi.get<WorkloadResponse>(`/workload/${memberId}`);
    return response.data;
  },
};

