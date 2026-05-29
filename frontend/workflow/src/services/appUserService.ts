import api from './api';

export interface AppUser {
  userId: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  permissions: string[];
}

export interface AppUserCreate {
  email: string;
  password: string;
  fullName: string;
  roleId: string;
  isActive?: boolean;
}

export interface AppUserUpdate {
  email: string;
  fullName?: string;
  roleId?: string;
  isActive?: boolean;
  password?: string;
}

export const appUserService = {
  getAll: async (): Promise<AppUser[]> => {
    const response = await api.get<AppUser[]>('/api/appusers');
    return response.data;
  },

  getById: async (id: string): Promise<AppUser> => {
    const response = await api.get<AppUser>(`/api/appusers/${id}`);
    return response.data;
  },

  create: async (data: AppUserCreate): Promise<AppUser> => {
    const response = await api.post<AppUser>('/api/appusers', data);
    return response.data;
  },

  update: async (id: string, data: AppUserUpdate): Promise<AppUser> => {
    const response = await api.put<AppUser>(`/api/appusers/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/appusers/${id}`);
  },
};
