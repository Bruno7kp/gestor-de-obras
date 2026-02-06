import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from '../App';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { SuperAdminPage } from '../pages/SuperAdminPage';

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
    <div className="text-center">
      <p className="text-lg font-semibold tracking-wide">Carregando...</p>
      <p className="text-sm text-slate-400">Preparando sua instancia</p>
    </div>
  </div>
);

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const RequireRole: React.FC<{ role: string; children: React.ReactElement }> = ({ role, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.roles.includes(role)) return <Navigate to="/app" replace />;
  return children;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route
      path="/superadmin"
      element={
        <RequireRole role="SUPER_ADMIN">
          <SuperAdminPage />
        </RequireRole>
      }
    />
    <Route
      path="/app/*"
      element={
        <RequireAuth>
          <App />
        </RequireAuth>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export const AppRouter: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);
