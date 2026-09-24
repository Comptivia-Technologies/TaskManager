import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../utils/roleUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requires?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requires }) => {
  const { user, loading, permissions, sessionLoading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requires) {
    // Waiting avoids bouncing a permitted user off the page before their role resolves.
    if (sessionLoading) {
      return (
        <div className="flex justify-center items-center h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      );
    }
    if (!hasPermission(permissions, requires)) {
      return <Navigate to="/enquiry" replace />;
    }
  }

  return <>{children}</>;
};
