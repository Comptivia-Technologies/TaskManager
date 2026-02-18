import axios from 'axios';
import { WorkloadResponse } from '../types';

if (!process.env.REACT_APP_API_URL) {
  throw new Error('REACT_APP_API_URL environment variable is required');
}

const workloadApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const workloadService = {
  getByMemberId: async (memberId: string): Promise<WorkloadResponse> => {
    const response = await workloadApi.get<WorkloadResponse>(`/api/workload/${memberId}`);
    return response.data;
  },
};

