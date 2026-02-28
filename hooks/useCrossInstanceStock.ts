import { useState, useEffect, useCallback, useMemo } from 'react';
import { globalStockApi } from '../services/globalStockApi';
import { usePermissions } from './usePermissions';
import { canView as checkView, canEdit as checkEdit } from '../utils/permissions';
import type { PermissionModule } from '../utils/permissions';

interface AccessibleInstance {
  instanceId: string;
  instanceName: string;
  permissions: string[];
}

interface CrossInstanceStockResult {
  /** Instancias externas acessíveis (always fetched) */
  accessibleInstances: AccessibleInstance[];
  /** Resolved canView — uses cross-instance perms when externalInstanceId present */
  canView: (module: PermissionModule) => boolean;
  /** Resolved canEdit — uses cross-instance perms when externalInstanceId present */
  canEdit: (module: PermissionModule) => boolean;
  /** Whether we're viewing an external instance */
  isExternal: boolean;
  /** Cross-instance permissions array (empty when home) */
  crossPermissions: string[];
}

/**
 * Hook that resolves stock permissions for cross-instance access.
 *
 * When externalInstanceId is provided, permissions come from the
 * accessible-instances endpoint (ProjectMember roles) instead of the JWT.
 * When absent, falls back to normal home-instance permissions.
 */
export function useCrossInstanceStock(
  externalInstanceId?: string,
): CrossInstanceStockResult {
  const homePerms = usePermissions();
  const [accessibleInstances, setAccessibleInstances] = useState<AccessibleInstance[]>([]);

  // Always fetch accessible instances (regardless of home permissions)
  useEffect(() => {
    globalStockApi.listAccessibleInstances()
      .then(setAccessibleInstances)
      .catch(() => {});
  }, []);

  const isExternal = !!externalInstanceId;

  // Find cross-instance permissions for the target instance
  const crossPermissions = useMemo(() => {
    if (!externalInstanceId) return [];
    const inst = accessibleInstances.find(i => i.instanceId === externalInstanceId);
    return inst?.permissions ?? [];
  }, [externalInstanceId, accessibleInstances]);

  const canView = useCallback(
    (module: PermissionModule): boolean => {
      if (!isExternal) return homePerms.canView(module);
      return checkView(crossPermissions, module);
    },
    [isExternal, homePerms, crossPermissions],
  );

  const canEdit = useCallback(
    (module: PermissionModule): boolean => {
      if (!isExternal) return homePerms.canEdit(module);
      return checkEdit(crossPermissions, module);
    },
    [isExternal, homePerms, crossPermissions],
  );

  return {
    accessibleInstances,
    canView,
    canEdit,
    isExternal,
    crossPermissions,
  };
}
