import api from './api';

export interface PermissionRead {
  permissionId: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
}

export const permissionService = {
  getAll: async (): Promise<PermissionRead[]> => {
    const response = await api.get<PermissionRead[]>('/api/permissions');
    return response.data;
  },
};
