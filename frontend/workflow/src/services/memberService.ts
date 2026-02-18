import api from './api';
import { Member, MemberCreate, MemberUpdate } from '../types';

export const memberService = {
  getAll: async (): Promise<Member[]> => {
    const response = await api.get<Member[]>('/api/members');
    return response.data;
  },

  getById: async (id: string): Promise<Member> => {
    const response = await api.get<Member>(`/api/members/${id}`);
    return response.data;
  },

  create: async (member: MemberCreate): Promise<Member> => {
    const response = await api.post<Member>('/api/members', member);
    return response.data;
  },

  update: async (id: string, member: MemberUpdate): Promise<Member> => {
    const response = await api.put<Member>(`/api/members/${id}`, member);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/members/${id}`);
  },

  getTasks: async (memberId: string) => {
    const response = await api.get(`/api/members/${memberId}/tasks`);
    return response.data;
  },
};



