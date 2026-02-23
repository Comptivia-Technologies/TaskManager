import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../services/authService';
import { auth } from '../firebase/config';
import { fetchTenantIdByEmail } from '../services/tenantService';
import { getOrganizationIdFromToken } from '../utils/tokenUtils';
import { setOrganizationIdCookie, getOrganizationIdFromCookie, clearOrganizationIdCookie } from '../utils/cookieUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  organizationId: string | null;
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
        } catch (error) {
          console.error('Error storing auth token:', error);
        }
      } else {
        setCurrentTenantId(null);
        setOrganizationId(null);
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
    clearOrganizationIdCookie();
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
