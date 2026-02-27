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
    userId: apiUser.user_id || apiUser.id || '',
    fullName: apiUser.full_name || apiUser.username || '',
    email: apiUser.email || '',
    organisationId: apiUser.organization_id || organisationId,
    role: apiUser.role || '',
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
  getActiveOrganizationUsers: async (organizationId: string, tenantId?: string | null): Promise<User[]> => {
    const productId = process.env.REACT_APP_PRODUCT_ID;
    if (!productId) return [];
    const params = new URLSearchParams({ product_id: productId });
    if (tenantId?.trim()) params.set('tenant_id', tenantId.trim());
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
};

export interface CreateOrganizationUserPayload {
  organization_id: string;
  email: string;
  full_name: string;
  user_type: string;
  role: string;
  products_data: { product_id: string; role_id: string; role_name: string }[];
}
