import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../utils/roleUtils';
import { FlowLoader } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requires?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requires }) => {
  const { user, loading, permissions, sessionLoading } = useAuth();

  // Before the shell exists there is nothing to anchor a small loader to, so the
  // session check fills the screen.
  if (loading) {
    return <FlowLoader fullScreen label="Signing you in" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requires) {
    // Waiting avoids bouncing a permitted user off the page before their role resolves.
    if (sessionLoading) {
      return <FlowLoader fullScreen label="Checking your access" />;
    }
    if (!hasPermission(permissions, requires)) {
      return <Navigate to="/enquiry" replace />;
    }
  }

  return <>{children}</>;
};
