import api from './api';
import { Team, TeamCreate, TeamUpdate } from '../types';

export const teamService = {
  getAll: async (): Promise<Team[]> => {
    const response = await api.get<Team[]>('/api/teams');
    return response.data;
  },

  getById: async (id: string): Promise<Team> => {
    const response = await api.get<Team>(`/api/teams/${id}`);
    return response.data;
  },

  create: async (team: TeamCreate): Promise<Team> => {
    const response = await api.post<Team>('/api/teams', team);
    return response.data;
  },

  update: async (id: string, team: TeamUpdate): Promise<Team> => {
    const response = await api.put<Team>(`/api/teams/${id}`, team);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/teams/${id}`);
  },

  getMembers: async (teamId: string) => {
    const response = await api.get(`/api/teams/${teamId}/members`);
    return response.data;
  },

  getWorkflows: async (teamId: string) => {
    const response = await api.get(`/api/teams/${teamId}/workflows`);
    return response.data;
  },
};



