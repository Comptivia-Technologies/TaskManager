import api from './api';
import { Role, RoleCreate } from '../types';

interface RoleApiResponse {
  roleId: string;
  name: string;
  description?: string | null;
  permissionCodes: string[];
}

function mapToRole(r: RoleApiResponse): Role {
  return {
    roleId: r.roleId,
    name: r.name,
    description: r.description ?? undefined,
    permissions: r.permissionCodes ?? [],
  };
}

export const roleService = {
  getAll: async (): Promise<Role[]> => {
    const response = await api.get<RoleApiResponse[]>('/api/roles');
    return (response.data ?? []).map(mapToRole);
  },

  create: async (data: RoleCreate): Promise<Role> => {
    const response = await api.post<RoleApiResponse>('/api/roles', {
      name: data.name,
      description: data.description ?? null,
      permissionCodes: data.permissions ?? [],
    });
    return mapToRole(response.data);
  },

  update: async (roleId: string, data: Pick<RoleCreate, 'name' | 'description' | 'permissions'>): Promise<Role> => {
    const response = await api.put<RoleApiResponse>(`/api/roles/${roleId}`, {
      name: data.name,
      description: data.description ?? null,
      permissionCodes: data.permissions ?? [],
    });
    return mapToRole(response.data);
  },

  delete: async (roleId: string): Promise<void> => {
    await api.delete(`/api/roles/${roleId}`);
  },
};
