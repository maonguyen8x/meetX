'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api-client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  locale: string;
  platformRole: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  mustChangePassword: boolean;
}

export interface SessionMembership {
  organizationId: string;
  name: string;
  orgRole: 'ORG_ADMIN' | 'ORG_MEMBER';
  isOwner: boolean;
  permissions: string[];
}

interface SessionState {
  status: 'loading' | 'authenticated' | 'anonymous';
  user?: SessionUser;
  permissions: string[];
  memberships: SessionMembership[];
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

interface MeResponse {
  user: SessionUser;
  permissions: string[];
  memberships: SessionMembership[];
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<SessionState, 'signOut'>>({
    status: 'loading',
    permissions: [],
    memberships: [],
  });

  useEffect(() => {
    let cancelled = false;
    void apiRequest<MeResponse>('/v1/me').then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setState({
          status: 'authenticated',
          user: result.data.user,
          permissions: result.data.permissions,
          memberships: result.data.memberships,
        });
      } else {
        setState({ status: 'anonymous', permissions: [], memberships: [] });
        router.replace(result.errorCode === 'PASSWORD_CHANGE_REQUIRED' ? '/change-password' : '/login');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }, [router]);

  const value = useMemo(() => ({ ...state, signOut }), [state, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

/** UI gating only; the API enforces every permission (docs/14). */
export function usePermissions() {
  const { permissions, memberships } = useSession();
  return useMemo(
    () => ({
      can: (permission: string, organizationId?: string) =>
        permissions.includes(permission) ||
        (organizationId !== undefined &&
          (memberships.find((m) => m.organizationId === organizationId)?.permissions.includes(permission) ??
            false)),
    }),
    [permissions, memberships],
  );
}

export function Can({
  permission,
  organizationId,
  children,
  fallback = null,
}: {
  permission: string;
  organizationId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(permission, organizationId) ? children : fallback}</>;
}
