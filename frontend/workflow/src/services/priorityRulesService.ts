import priorityRulesApi from './priorityRulesApi';
import { PriorityRule, PriorityRuleCreate, PriorityRuleUpdate } from '../types';

export const priorityRulesService = {
  getAll: async (activeOnly: boolean = false): Promise<PriorityRule[]> => {
    const response = await priorityRulesApi.get<PriorityRule[]>('/priority-rules', {
      params: { activeOnly }
    });
    return response.data;
  },

  getById: async (id: number): Promise<PriorityRule> => {
    const response = await priorityRulesApi.get<PriorityRule>(`/priority-rules/${id}`);
    return response.data;
  },

  create: async (rule: PriorityRuleCreate): Promise<PriorityRule> => {
    const response = await priorityRulesApi.post<PriorityRule>('/priority-rules', rule);
    return response.data;
  },

  update: async (id: number, rule: PriorityRuleUpdate): Promise<PriorityRule> => {
    const response = await priorityRulesApi.put<PriorityRule>(`/priority-rules/${id}`, rule);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await priorityRulesApi.delete(`/priority-rules/${id}`);
  },
};

