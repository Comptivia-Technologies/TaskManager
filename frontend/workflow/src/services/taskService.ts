import api from './api';
import { Task, TaskUpdate, PaginatedTasksResponse, TaskStageHistory, TaskStageData, TaskAttachment } from '../types';

export const taskService = {
  getAll: async (): Promise<Task[]> => {
    const response = await api.get<PaginatedTasksResponse | Task[]>('/api/tasks');
    const raw = response.data;
    if (Array.isArray(raw)) return raw;
    return Array.isArray(raw?.data) ? raw.data : [];
  },

  getAllPaginated: async (priority?: string, page = 1, limit = 10): Promise<PaginatedTasksResponse> => {
    const params = new URLSearchParams();
    if (priority?.trim()) params.set('priority', priority.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));
    const response = await api.get<PaginatedTasksResponse | Task[]>(`/api/tasks?${params.toString()}`);
    const raw = response.data;
    if (Array.isArray(raw)) {
      return { data: raw, totalCount: raw.length, page: 1, limit: raw.length || 10, totalPages: raw.length ? 1 : 0 };
    }
    return {
      data: Array.isArray(raw?.data) ? raw.data : [],
      totalCount: raw?.totalCount ?? 0,
      page: raw?.page ?? 1,
      limit: raw?.limit ?? 10,
      totalPages: raw?.totalPages ?? 0
    };
  },

  getById: async (id: string): Promise<Task> => {
    const response = await api.get<Task>(`/api/tasks/${id}`);
    return response.data;
  },

  update: async (id: string, task: TaskUpdate): Promise<Task> => {
    const response = await api.put<Task>(`/api/tasks/${id}`, task);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/tasks/${id}`);
  },

  getByWorkflow: async (workflowId: string): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/workflow/${workflowId}`);
    return response.data;
  },

  getByStage: async (stageId: string): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/stage/${stageId}`);
    return response.data;
  },

  getByMember: async (memberId: string): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/api/tasks/member/${memberId}`);
    return response.data;
  },

  getByUserId: async (userId: string): Promise<Task[]> => {
    try {
      const response = await api.get<Task[]>(`/api/tasks/user/${userId}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      if (error?.response?.status === 404) return [];
      throw error;
    }
  },

  getHistory: async (id: string): Promise<TaskStageHistory[]> => {
    const response = await api.get<TaskStageHistory[]>(`/api/task-service/${id}/history`);
    return Array.isArray(response.data) ? response.data : [];
  },

  create: async (payload: {
    taskName: string;
    description?: string;
    taskType: string;
    taskData?: Record<string, unknown>;
    createdByMemberId?: string;
  }): Promise<{ taskId: string }> => {
    const response = await api.post<{ taskId: string }>('/api/task-service', payload);
    return response.data;
  },

  getStageData: async (id: string): Promise<TaskStageData[]> => {
    const response = await api.get<TaskStageData[]>(`/api/task-service/${id}/stage-data`);
    return Array.isArray(response.data) ? response.data : [];
  },

  completeStage: async (
    id: string,
    stageData?: Record<string, unknown>,
    nextStageMemberId?: string,
    stageNominations?: Record<string, string>
  ): Promise<void> => {
    await api.post(`/api/task-service/complete-stage/${id}`, {
      stageData: stageData ?? null,
      nextStageMemberId: nextStageMemberId || null,
      stageNominations: stageNominations && Object.keys(stageNominations).length > 0 ? stageNominations : null,
    });
  },

  returnStage: async (id: string, targetStageId: string, reason: string): Promise<void> => {
    await api.post(`/api/task-service/return-stage/${id}`, { targetStageId, reason });
  },

  escalateStage: async (id: string, reason: string): Promise<void> => {
    await api.post(`/api/task-service/escalate-stage/${id}`, { reason });
  },

  getAttachments: async (id: string): Promise<TaskAttachment[]> => {
    const response = await api.get<TaskAttachment[]>(`/api/task-service/${id}/attachments`);
    return Array.isArray(response.data) ? response.data : [];
  },

  uploadAttachment: async (id: string, file: File): Promise<TaskAttachment> => {
    const form = new FormData();
    form.append('file', file);
    // Content-Type is cleared so the browser supplies it with the multipart
    // boundary; the client's JSON default would make the body unparseable.
    const response = await api.post<TaskAttachment>(`/api/task-service/${id}/attachments`, form, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },

  // Downloads go through the API client so the request carries the auth token,
  // which a plain link could not do.
  downloadAttachment: async (attachmentId: string, fileName: string): Promise<void> => {
    const response = await api.get(`/api/task-service/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};



