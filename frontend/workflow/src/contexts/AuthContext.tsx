import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { authService, AuthUser } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setUser(null);
      return;
    }
    const me = await authService.getMe();
    setUser(me ?? authService.getStoredUser());
  }, []);

  useEffect(() => {
    const init = async () => {
      const stored = authService.getStoredUser();
      if (stored && authService.isAuthenticated()) {
        setUser(stored);
        await refreshUser();
      }
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  const signIn = async (email: string, password: string) => {
    const loggedIn = await authService.login(email, password);
    setUser(loggedIn);
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  const hasPermission = (permission: string) =>
    user?.permissions?.includes(permission) ?? false;

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
