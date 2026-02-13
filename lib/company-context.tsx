import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type DbUserRow = {
  id?: string | null;
  company_id?: string | null;
  role?: string | null;
};

type CompanyContextValue = {
  userId: string | null;
  companyId: string | null;
  role: string | null;
  isReady: boolean;
  refreshCompanyContext: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refreshCompanyContext = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      setUserId(null);
      setCompanyId(null);
      setRole(null);
      setIsReady(true);
      return;
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', sessionUserId)
      .maybeSingle<DbUserRow>();

    setUserId(sessionUserId);
    setCompanyId(typeof userRow?.company_id === 'string' ? userRow.company_id : null);
    setRole(typeof userRow?.role === 'string' ? userRow.role : null);
    setIsReady(true);
  }, []);

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

  const value = useMemo(
    () => ({
      userId,
      companyId,
      role,
      isReady,
      refreshCompanyContext,
    }),
    [userId, companyId, role, isReady, refreshCompanyContext]
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
