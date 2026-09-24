import api from './api';
import { User, UserStatus } from '../types';

type ApiStatus = 'active' | 'pending' | 'archived';

interface ApiUser {
  id?: string;
  user_id?: string;
  username?: string;
  email?: string;
  full_name?: string;
  organization_id?: string;
  role?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  product_role?: {
    role_name?: string;
    role_id?: string;
    product_id?: string;
    product_name?: string;
    subscription_id?: string;
    subscription_expiry_date?: string;
    subscription_created_at?: string;
  } | null;
}

interface UsersResponse {
  success: boolean;
  data: {
    users: ApiUser[];
  };
}

function mapApiUserToUser(apiUser: ApiUser, organisationId: string): User {
  const rawStatus = (apiUser.status || 'active').toLowerCase();
  const capitalStatus: UserStatus =
    rawStatus === 'active' ? 'Active' : rawStatus === 'pending' ? 'Pending' : rawStatus === 'archived' ? 'Archived' : 'Active';
  return {
    id: apiUser.id,
    userId: apiUser.user_id || apiUser.id || '',
    fullName: apiUser.full_name || apiUser.username || '',
    email: apiUser.email || '',
    organisationId: apiUser.organization_id || organisationId,
    role: apiUser.product_role?.role_name ?? apiUser.role ?? '',
    roleId: apiUser.product_role?.role_id,
    status: capitalStatus,
    createdAt: apiUser.created_at || new Date().toISOString(),
    updatedAt: apiUser.updated_at || new Date().toISOString(),
  };
}

interface ApiInvitation {
  id?: string;
  user_id?: string;
  email?: string;
  full_name?: string;
  organization_id?: string;
  role?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface InvitationsResponse {
  success: boolean;
  data?: {
    invitations?: ApiInvitation[];
    users?: ApiInvitation[];
  };
}

function mapInvitationToUser(inv: ApiInvitation, organisationId: string): User {
  return {
    userId: inv.user_id || inv.id || '',
    fullName: inv.full_name || '',
    email: inv.email || '',
    organisationId: inv.organization_id || organisationId,
    role: inv.role || '',
    status: 'Pending',
    createdAt: inv.created_at || new Date().toISOString(),
    updatedAt: inv.updated_at || new Date().toISOString(),
  };
}

export const userService = {
  getActiveOrganizationUsers: async (organizationId: string): Promise<User[]> => {
    const productId = process.env.REACT_APP_PRODUCT_ID;
    if (!productId) return [];
    const params = new URLSearchParams({
      product_id: productId,
      organization_id: organizationId,
    });
    const response = await api.get<UsersResponse | { data?: ApiUser[]; users?: ApiUser[] }>(
      `/api/auth/organizationuser?${params.toString()}`
    );
    const body = response.data as { data?: { users?: ApiUser[] } | ApiUser[]; users?: ApiUser[] } | undefined;
    const list =
      body?.data && typeof body.data === 'object' && 'users' in body.data
        ? body.data.users ?? []
        : Array.isArray(body?.data)
          ? (body?.data ?? [])
          : body?.users ?? [];
    return list.map((u: ApiUser) => mapApiUserToUser(u, organizationId));
  },

  getByOrganization: async (
    organizationId: string,
    status: UserStatus
  ): Promise<User[]> => {
    if (status === 'Archived') {
      return [];
    }
    const statusParam: ApiStatus = status === 'Active' ? 'active' : 'pending';
    const response = await api.get<UsersResponse>(
      `/api/auth/users/organization/${organizationId}?status=${statusParam}`
    );
    const list = response.data?.data?.users ?? [];
    return list.map((u) => mapApiUserToUser(u, organizationId));
  },

  getPendingInvitations: async (organizationId: string): Promise<User[]> => {
    const response = await api.get<InvitationsResponse>(
      `/api/auth/invitations/organization/${organizationId}?status=pending`
    );
    const data = response.data?.data;
    const list = data?.invitations ?? data?.users ?? [];
    return list.map((u) => mapInvitationToUser(u, organizationId));
  },

  createOrganizationUser: async (
    payload: CreateOrganizationUserPayload
  ): Promise<unknown> => {
    const response = await api.post<unknown>(
      '/api/auth/organizationuser/create',
      payload
    );
    return response.data;
  },

  updateOrganizationUser: async (
    userId: string,
    payload: UpdateOrganizationUserPayload
  ): Promise<unknown> => {
    const productId = process.env.REACT_APP_PRODUCT_ID;
    if (!productId) throw new Error('REACT_APP_PRODUCT_ID is not configured');
    const params = new URLSearchParams({ product_id: productId });
    const response = await api.put<unknown>(
      `/api/auth/organizationuser/${encodeURIComponent(userId)}?${params.toString()}`,
      payload
    );
    return response.data;
  },

  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/api/auth/users/${encodeURIComponent(userId)}`);
  },

  updateUserStatus: async (id: string, status: string): Promise<unknown> => {
    const response = await api.patch<unknown>(
      `/api/auth/users/${encodeURIComponent(id)}/status`,
      { status }
    );
    return response.data;
  },
};

export interface UpdateOrganizationUserPayload {
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
}

export interface CreateOrganizationUserPayload {
  organization_id: string;
  email: string;
  full_name: string;
  user_type: string;
  product_id: string;
  role_id: string;
  role_name: string;
}
