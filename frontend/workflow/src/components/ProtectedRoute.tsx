import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !user.permissions?.includes(permission)) {
    return <Navigate to="/workflows" replace />;
  }

  return <>{children}</>;
};
