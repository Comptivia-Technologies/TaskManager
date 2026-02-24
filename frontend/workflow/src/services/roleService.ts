import api from './api';
import { Role, RoleCreate } from '../types';

interface RoleApiResponse {
  roleId: string;
  name: string;
  description?: string | null;
  organizationId: string;
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
  getByOrganization: async (organizationId: string): Promise<Role[]> => {
    const response = await api.get<RoleApiResponse[]>(`/api/roles/organization/${organizationId}`);
    return (response.data ?? []).map(mapToRole);
  },

  create: async (organizationId: string, data: RoleCreate): Promise<Role> => {
    const response = await api.post<RoleApiResponse>('/api/roles', {
      name: data.name,
      description: data.description ?? null,
      organizationId,
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
