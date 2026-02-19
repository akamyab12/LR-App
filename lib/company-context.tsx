import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { AppRole, isAppRole, type AppRoleValue } from '@/lib/types';

const DEV_ACTIVE_COMPANY_ID_OVERRIDE = __DEV__
  ? (process.env.EXPO_PUBLIC_DEV_ACTIVE_COMPANY_ID ?? '').trim()
  : '';

type DbUserRow = {
  id?: string | null;
  company_id?: string | null;
  role?: string | null;
};

type CompanyContextValue = {
  userId: string | null;
  companyId: string | null;
  activeCompanyId: string | null;
  role: AppRoleValue | null;
  canSwitchCompany: boolean;
  setActiveCompanyId: (companyId: string | null) => void;
  isReady: boolean;
  refreshCompanyContext: () => Promise<void>;
};

type CompanyContextSnapshot = {
  userId: string | null;
  companyId: string | null;
  activeCompanyId: string | null;
  role: AppRoleValue | null;
  isReady: boolean;
};

let currentCompanyContextSnapshot: CompanyContextSnapshot = {
  userId: null,
  companyId: null,
  activeCompanyId: null,
  role: null,
  isReady: false,
};

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [role, setRole] = useState<AppRoleValue | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refreshCompanyContext = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      setUserId(null);
      setCompanyId(null);
      setActiveCompanyIdState(null);
      setRole(null);
      setIsReady(true);
      return;
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', sessionUserId)
      .maybeSingle<DbUserRow>();

    const resolvedCompanyId = typeof userRow?.company_id === 'string' ? userRow.company_id : null;
    const resolvedRole = isAppRole(userRow?.role) ? userRow.role : null;

    setUserId(sessionUserId);
    setCompanyId(resolvedCompanyId);
    setRole(resolvedRole);
    setActiveCompanyIdState((prev) => {
      if (resolvedRole === AppRole.PLATFORM_ADMIN) {
        if (DEV_ACTIVE_COMPANY_ID_OVERRIDE.length > 0) {
          return DEV_ACTIVE_COMPANY_ID_OVERRIDE;
        }
        return prev ?? resolvedCompanyId;
      }
      return resolvedCompanyId;
    });
    setIsReady(true);
  }, []);

  const setActiveCompanyId = useCallback(
    (nextCompanyId: string | null) => {
      setActiveCompanyIdState(() => {
        if (role !== AppRole.PLATFORM_ADMIN) {
          return companyId;
        }

        if (nextCompanyId === null) {
          return companyId;
        }

        const normalized = nextCompanyId.trim();
        return normalized.length > 0 ? normalized : companyId;
      });
    },
    [role, companyId]
  );

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      try {
        await refreshCompanyContext();
      } finally {
        if (isActive) {
          setIsReady(true);
        }
      }
    };

    bootstrap().catch(() => {
      if (isActive) {
        setUserId(null);
        setCompanyId(null);
        setActiveCompanyIdState(null);
        setRole(null);
        setIsReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshCompanyContext().catch(() => {
        if (isActive) {
          setUserId(null);
          setCompanyId(null);
          setActiveCompanyIdState(null);
          setRole(null);
          setIsReady(true);
        }
      });
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [refreshCompanyContext]);

  useEffect(() => {
    currentCompanyContextSnapshot = {
      userId,
      companyId,
      activeCompanyId,
      role,
      isReady,
    };
  }, [userId, companyId, activeCompanyId, role, isReady]);

  const value = useMemo(
    () => ({
      userId,
      companyId,
      activeCompanyId,
      role,
      canSwitchCompany: role === AppRole.PLATFORM_ADMIN,
      setActiveCompanyId,
      isReady,
      refreshCompanyContext,
    }),
    [userId, companyId, activeCompanyId, role, setActiveCompanyId, isReady, refreshCompanyContext]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);

  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }

  return context;
}

export function getCompanyContextSnapshot(): CompanyContextSnapshot {
  return currentCompanyContextSnapshot;
}
