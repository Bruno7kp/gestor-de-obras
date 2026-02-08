import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService, type AuthUser, type LoginInput } from '../services/authService';
import { uiPreferences } from '../utils/uiPreferences';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadMe = async () => {
      try {
        const me = await authService.me();
        if (isMounted) {
          setUser(me);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMe();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const nextScope = `${user.instanceId}:${user.id}`;
    const prevScope = uiPreferences.getScope();
    if (prevScope && prevScope !== nextScope) {
      uiPreferences.clearScope(prevScope);
    }
    uiPreferences.setScope(nextScope);
  }, [user, loading]);

  const login = async (input: LoginInput) => {
    const response = await authService.login(input);
    setUser(response.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
