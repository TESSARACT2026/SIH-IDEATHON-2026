import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 font-medium animate-pulse text-sm">
          Loading MargDarshak...
        </div>
      </div>
    );
  }

  // Only allow access if user is authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
