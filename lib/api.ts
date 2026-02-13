import { supabase } from '@/lib/supabase';
import { AppRole, type AppRoleValue, type Lead, type PriorityLead } from '@/lib/types';

const mockLeads: Lead[] = [
  {
    id: 'lead-1',
    name: 'Sarah Chen',
    title: 'VP of Engineering',
    company: 'Enterprise Solutions Inc.',
    isHot: true,
    badgeLabel: 'Hot',
    priorityScore: 95,
    stars: 4,
    followUpDate: '02/14/2026',
    quickTags: ['Budget', 'Decision Maker', 'Competitor Mentioned', 'Timeline', 'Product Demo'],
    aiInsights: {
      buyingSignals: ['Budget approved for Q1', 'Primary decision maker', 'Requested follow-up meeting'],
      keyNeeds: ['Engineering stack upgrade', 'Enterprise security', 'Vendor onboarding support'],
      nextBestAction:
        'Send a technical deep-dive plus ROI comparison today. Confirm stakeholder availability for next week.',
    },
  },
  {
    id: 'lead-2',
    name: 'Marcus Rodriguez',
    title: 'CTO',
    company: 'TechVentures LLC',
    isHot: false,
    badgeLabel: 'Follow Up',
    priorityScore: 88,
    stars: 4,
    followUpDate: '02/16/2026',
    quickTags: ['Timeline', 'Product Demo', 'Pricing Discussed'],
    aiInsights: {
      buyingSignals: ['Asked about implementation timeline', 'Engaged in product demo'],
      keyNeeds: ['Fast deployment', 'Transparent pricing'],
      nextBestAction: 'Share a rollout plan with milestones and send pricing tiers by Friday.',
    },
  },
  {
    id: 'lead-3',
    name: 'Lisa Martinez',
    title: 'CEO',
    company: 'InnovateTech',
    isHot: true,
    badgeLabel: 'Hot',
    priorityScore: 91,
    stars: 5,
    followUpDate: '02/15/2026',
    quickTags: ['Budget', 'Decision Maker', 'Urgent timeline'],
    aiInsights: {
      buyingSignals: ['Executive sponsor confirmed', 'Requested contract draft'],
      keyNeeds: ['Vendor consolidation', 'Executive reporting dashboard'],
      nextBestAction: 'Prepare a pilot proposal and schedule executive review within 48 hours.',
    },
  },
  {
    id: 'lead-4',
    name: 'David Kim',
    title: 'Head of Product',
    company: 'Northstar Labs',
    isHot: false,
    badgeLabel: 'Follow Up',
    priorityScore: 82,
    stars: 3,
    followUpDate: '02/20/2026',
    quickTags: ['Competitor Mentioned', 'Pricing Discussed'],
    aiInsights: {
      buyingSignals: ['Compared against competitor', 'Interested in roadmap alignment'],
      keyNeeds: ['Product analytics', 'API flexibility'],
      nextBestAction: 'Send a competitive comparison matrix and roadmap notes.',
    },
  },
  {
    id: 'lead-5',
    name: 'Nina Patel',
    title: 'Operations Director',
    company: 'Apex Commerce',
    isHot: false,
    badgeLabel: 'Follow Up',
    priorityScore: 78,
    stars: 3,
    followUpDate: '02/22/2026',
    quickTags: ['Timeline', 'Product Demo'],
    aiInsights: {
      buyingSignals: ['Requested team training plan', 'Wants a short procurement cycle'],
      keyNeeds: ['Cross-team adoption', 'Operational reporting'],
      nextBestAction: 'Propose a phased onboarding plan and share training assets.',
    },
  },
];

async function withLatency<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return value;
}

type EqCapableQuery<TQuery> = {
  eq: (column: string, value: unknown) => TQuery;
};

export type CompanyScope = {
  role: AppRoleValue | null;
  activeCompanyId: string | null;
};

function normalizeCompanyId(companyId: string | null): string | null {
  if (typeof companyId !== 'string') {
    return null;
  }

  const normalized = companyId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isPlatformAdminScope(scope: CompanyScope): boolean {
  return scope.role === AppRole.PLATFORM_ADMIN;
}

export function hasLeadQueryScope(scope: CompanyScope): boolean {
  return isPlatformAdminScope(scope) || normalizeCompanyId(scope.activeCompanyId) !== null;
}

export function applyLeadCompanyScope<TQuery extends EqCapableQuery<TQuery>>(
  query: TQuery,
  scope: CompanyScope
): TQuery | null {
  if (isPlatformAdminScope(scope)) {
    return query;
  }

  const companyId = normalizeCompanyId(scope.activeCompanyId);
  if (!companyId) {
    return null;
  }

  return query.eq('company_id', companyId);
}

export async function fetchLeadsByScope<TLeadRow = Record<string, unknown>>(
  scope: CompanyScope
) {
  const scopedQuery = applyLeadCompanyScope(supabase.from('leads').select('*'), scope);
  if (!scopedQuery) {
    return { data: [] as TLeadRow[], error: null };
  }

  return scopedQuery.order<TLeadRow>(
    'created_at',
    {
      ascending: false,
    }
  );
}

export async function fetchLeadByScopeAndId<TLeadRow = Record<string, unknown>>(
  scope: CompanyScope,
  leadId: string
) {
  const scopedQuery = applyLeadCompanyScope(supabase.from('leads').select('*'), scope);
  if (!scopedQuery) {
    return { data: null as TLeadRow | null, error: null };
  }

  return scopedQuery
    .eq('id', leadId)
    .single<TLeadRow>();
}

export async function fetchLeads(): Promise<Lead[]> {
  return withLatency(mockLeads);
}

export async function fetchLeadById(id: string): Promise<Lead | null> {
  const lead = mockLeads.find((item) => item.id === id) ?? null;
  return withLatency(lead);
}

export async function fetchPriorityLeads(): Promise<PriorityLead[]> {
  const ranked = [...mockLeads]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((lead, index) => ({
      ...lead,
      rank: index + 1,
      highlights: lead.quickTags.slice(0, 3),
    }));

  return withLatency(ranked);
}
