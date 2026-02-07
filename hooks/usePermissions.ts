import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { canEdit, canView, getPermissionLevel } from '../utils/permissions';
import type { PermissionModule, PermissionLevel } from '../utils/permissions';

export interface UsePermissionsResult {
  permissions: string[];
  loading: boolean;
  error: string | null;
  canEdit: (module: PermissionModule) => boolean;
  canView: (module: PermissionModule) => boolean;
  hasPermission: (code: string) => boolean;
  getLevel: (module: PermissionModule) => PermissionLevel;
}

/**
 * Hook to access and check user permissions
 * 
 * Usage:
 *   const { canEdit, canView, permissions } = usePermissions();
 *   
 *   if (canEdit('projects')) {
 *     // Show edit button
 *   }
 *   
 *   if (!canView('biddings')) {
 *     return <div>Sem acesso a este módulo</div>;
 *   }
 */
export const usePermissions = (): UsePermissionsResult => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch permissions from user object (returns immediately on login)
  // or from API if needed
  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    // If user already has permissions (from login response), use them
    if (user.permissions && Array.isArray(user.permissions)) {
      setPermissions(user.permissions);
      setLoading(false);
      return;
    }

    // Otherwise, fallback would be to fetch from API
    // But since we're returning permissions in login, this shouldn't happen
    setPermissions([]);
    setLoading(false);
  }, [user]);

  const canEditModule = useCallback(
    (module: PermissionModule): boolean => {
      return canEdit(permissions, module);
    },
    [permissions],
  );

  const canViewModule = useCallback(
    (module: PermissionModule): boolean => {
      return canView(permissions, module);
    },
    [permissions],
  );

  const hasPermissionCode = useCallback(
    (code: string): boolean => {
      return permissions.includes(code);
    },
    [permissions],
  );

  const getLevel = useCallback(
    (module: PermissionModule): PermissionLevel => {
      return getPermissionLevel(permissions, module);
    },
    [permissions],
  );

  return {
    permissions,
    loading,
    error,
    canEdit: canEditModule,
    canView: canViewModule,
    hasPermission: hasPermissionCode,
    getLevel,
  };
};
