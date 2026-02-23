import { jwtDecode } from 'jwt-decode';

export interface DecodedToken {
  organizationId?: string;
  user_id?: string;
  email?: string;
  sub?: string;
  [key: string]: unknown;
}

export function getOrganizationIdFromToken(token: string): string | null {
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    return decoded.organizationId ?? null;
  } catch {
    return null;
  }
}
