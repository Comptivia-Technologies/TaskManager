import priorityRulesApi from './priorityRulesApi';
import { PriorityRule, PriorityRuleCreate, PriorityRuleUpdate } from '../types';

export const priorityRulesService = {
  getAll: async (activeOnly: boolean = false): Promise<PriorityRule[]> => {
    const response = await priorityRulesApi.get<PriorityRule[]>('/api/priority-rules', {
      params: { activeOnly }
    });
    return response.data;
  },

  getById: async (id: number): Promise<PriorityRule> => {
    const response = await priorityRulesApi.get<PriorityRule>(`/api/priority-rules/${id}`);
    return response.data;
  },

  create: async (rule: PriorityRuleCreate): Promise<PriorityRule> => {
    const response = await priorityRulesApi.post<PriorityRule>('/api/priority-rules', rule);
    return response.data;
  },

  update: async (id: number, rule: PriorityRuleUpdate): Promise<PriorityRule> => {
    const response = await priorityRulesApi.put<PriorityRule>(`/api/priority-rules/${id}`, rule);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await priorityRulesApi.delete(`/api/priority-rules/${id}`);
  },
};

