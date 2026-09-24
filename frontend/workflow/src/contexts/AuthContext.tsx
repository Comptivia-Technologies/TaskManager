import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../services/authService';
import { auth } from '../firebase/config';
import { fetchTenantIdByEmail } from '../services/tenantService';
import { memberService } from '../services/memberService';
import { userService } from '../services/userService';
import { roleService } from '../services/roleService';
import { Member } from '../types';
import { getOrganizationIdFromToken } from '../utils/tokenUtils';
import { setOrganizationIdCookie, getOrganizationIdFromCookie, clearOrganizationIdCookie } from '../utils/cookieUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  organizationId: string | null;
  currentMember: Member | null;
  permissions: string[] | null;
  sessionLoading: boolean;
  refreshSession: () => Promise<void>;
  signIn: (email: string, password: string, tenantId?: string | null) => Promise<void>;
  signUp: (email: string, password: string, tenantId?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, tenantId?: string | null) => Promise<void>;
  currentTenantId: string | null;
  setTenant: (tenantId: string | null) => Promise<void>;
  fetchTenantId: (email: string) => Promise<string | null>;
  getAuthToken: () => Promise<string | null>;
  refreshAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  // Starts true so nothing gates on an unresolved session and briefly shows the
  // wrong navigation or redirects to the wrong landing page.
  const [sessionLoading, setSessionLoading] = useState(true);

  // Roles are defined in this app but assigned to users in Product Hub, so the
  // caller's permissions are resolved by following their Product Hub role
  // assignment back to the local role that owns the permission codes.
  const resolvePermissions = async (uid: string, orgId: string): Promise<string[] | null> => {
    const [orgUsers, roles] = await Promise.all([
      userService.getActiveOrganizationUsers(orgId),
      roleService.getByOrganization(orgId)
    ]);
    const me = orgUsers.find((u) => u.userId === uid);
    if (!me) return null;
    const role = roles.find((r) => r.roleId === me.roleId) ?? roles.find((r) => r.name === me.role);
    return role ? role.permissions ?? [] : null;
  };

  // A login with no linked Member is legitimate (e.g. an org admin who does no
  // stage work), so a miss here resolves to null rather than failing the session.
  const loadSession = async (uid: string, orgId: string | null) => {
    setSessionLoading(true);
    try {
      const [member, resolved] = await Promise.all([
        memberService.getByUserId(uid),
        orgId ? resolvePermissions(uid, orgId) : Promise.resolve(null)
      ]);
      setCurrentMember(member);
      setPermissions(resolved);
    } catch (error) {
      console.error('Error resolving session:', error);
      setCurrentMember(null);
      setPermissions(null);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    // Load tenant and org from storage if exists and restore on auth instance
    const savedTenant = localStorage.getItem('currentTenantId');
    if (savedTenant) {
      setCurrentTenantId(savedTenant);
      (auth as any).tenantId = savedTenant;
    }
    const savedOrgId = getOrganizationIdFromCookie();
    if (savedOrgId) setOrganizationId(savedOrgId);

    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange(async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        const userTenant = localStorage.getItem(`tenant_${user.uid}`);
        if (userTenant) {
          setCurrentTenantId(userTenant);
          (auth as any).tenantId = userTenant;
        }

        try {
          const idToken = await user.getIdToken();
          localStorage.setItem('authToken', idToken);
          localStorage.setItem('authTokenExpiry', String(Date.now() + 3600000));
          const orgId = getOrganizationIdFromToken(idToken);
          if (orgId) {
            setOrganizationId(orgId);
            setOrganizationIdCookie(orgId);
          }
          // Must follow the token write above — the API client reads it from storage.
          await loadSession(user.uid, orgId ?? savedOrgId);
        } catch (error) {
          console.error('Error storing auth token:', error);
          setSessionLoading(false);
        }
      } else {
        setCurrentTenantId(null);
        setOrganizationId(null);
        setCurrentMember(null);
        setPermissions(null);
        setSessionLoading(false);
        (auth as any).tenantId = null;
        clearOrganizationIdCookie();
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTokenExpiry');
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string, tenantId?: string | null) => {
    await authService.signIn(email, password, tenantId);
    if (tenantId) {
      setCurrentTenantId(tenantId);
    }
  };

  const signUp = async (email: string, password: string, tenantId?: string | null) => {
    await authService.signUp(email, password, tenantId);
    if (tenantId) {
      setCurrentTenantId(tenantId);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setCurrentTenantId(null);
    setOrganizationId(null);
    setCurrentMember(null);
    setPermissions(null);
    clearOrganizationIdCookie();
  };

  const refreshSession = async () => {
    if (user) await loadSession(user.uid, organizationId);
  };

  const resetPassword = async (email: string, tenantId?: string | null) => {
    await authService.resetPassword(email, tenantId);
  };

  const setTenant = async (tenantId: string | null) => {
    await authService.setTenant(tenantId);
    setCurrentTenantId(tenantId);
  };

  const fetchTenantId = async (email: string) => {
    const result = await fetchTenantIdByEmail(email);
    if (result.tenantId) {
      await setTenant(result.tenantId);
      return result.tenantId;
    }
    return null;
  };

  const getAuthToken = async () => {
    return await authService.getAuthToken();
  };

  const refreshAuthToken = async () => {
    return await authService.refreshAuthToken();
  };

  const value: AuthContextType = {
    user,
    loading,
    organizationId,
    currentMember,
    permissions,
    sessionLoading,
    refreshSession,
    signIn,
    signUp,
    signOut: handleSignOut,
    resetPassword,
    currentTenantId,
    setTenant,
    fetchTenantId,
    getAuthToken,
    refreshAuthToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
