import api from './api';
import { Member, MemberCreate, MemberUpdate } from '../types';

export const memberService = {
  getAll: async (): Promise<Member[]> => {
    const response = await api.get<Member[]>('/members');
    return response.data;
  },

  getById: async (id: number): Promise<Member> => {
    const response = await api.get<Member>(`/members/${id}`);
    return response.data;
  },

  create: async (member: MemberCreate): Promise<Member> => {
    const response = await api.post<Member>('/members', member);
    return response.data;
  },

  update: async (id: number, member: MemberUpdate): Promise<Member> => {
    const response = await api.put<Member>(`/members/${id}`, member);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/members/${id}`);
  },

  getTasks: async (memberId: number) => {
    const response = await api.get(`/members/${memberId}/tasks`);
    return response.data;
  },
};



