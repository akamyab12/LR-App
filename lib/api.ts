import { getCompanyContextSnapshot } from '@/lib/company-context';
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
      nextBestAction: 'Send a competitive comparison matrix and roadmap context.',
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

export const LEADS_SELECT_COLUMNS =
  'id, company_id, event_id, owner_user_id, full_name, job_title, company_text, rating, priority_score, status, follow_up_date, enriched_job_title, enriched_seniority, enriched_company_size, enriched_industry, enriched_linkedin_url, enriched_company_domain, enriched_score, created_at, updated_at';

type InsertedLeadRow = {
  id?: string | number | null;
};

type UpdateableLeadRow = {
  id?: string | number | null;
  status?: string | null;
  priority_score?: number | null;
  priority?: number | null;
};

export type EventRow = {
  id?: string | number | null;
  name?: string | null;
  title?: string | null;
  event_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string | null;
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  [key: string]: unknown;
};

export type CreateLeadFromScanInput = {
  qr: string;
  audioUri?: string | null;
};

export type UpdateLeadInput = {
  priority_score?: number | null;
  follow_up_date?: string | null;
};

function isColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('column') ||
    normalized.includes('does not exist') ||
    normalized.includes('schema cache')
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeEventId(row: EventRow | Record<string, unknown> | null | undefined): string | null {
  if (!row) {
    return null;
  }

  const value = row.id;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

type ParsedScannedLeadPayload = {
  company_id: string | null;
  event_id: string | null;
  full_name: string | null;
  job_title: string | null;
  priority_score: number | null;
};

function normalizeContextId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function decodeQrPayload(value: string): string {
  if (!value.includes('%7B') && !value.includes('%22')) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeLeadText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeLeadPriority(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, 0, 100);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return clamp(parsed, 0, 100);
    }
  }

  return null;
}

function parseScannedLeadPayload(rawValue: string): ParsedScannedLeadPayload {
  const decoded = decodeQrPayload(rawValue).trim();
  if (!decoded.startsWith('{')) {
    return {
      company_id: null,
      event_id: null,
      full_name: null,
      job_title: null,
      priority_score: null,
    };
  }

  try {
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return {
      company_id: normalizeContextId(parsed.company_id ?? parsed.companyId),
      event_id: normalizeContextId(parsed.event_id ?? parsed.eventId),
      full_name: normalizeLeadText(parsed.full_name ?? parsed.fullName),
      job_title: normalizeLeadText(parsed.job_title ?? parsed.jobTitle),
      priority_score: normalizeLeadPriority(parsed.priority_score ?? parsed.priorityScore),
    };
  } catch {
    return {
      company_id: null,
      event_id: null,
      full_name: null,
      job_title: null,
      priority_score: null,
    };
  }
}

export function getEventId(row: EventRow | Record<string, unknown> | null | undefined): string {
  return normalizeEventId(row) ?? '';
}

function formatEventDateValue(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }

  return parsed.toLocaleDateString();
}

export function getEventName(row: EventRow | Record<string, unknown> | null | undefined): string {
  if (!row) {
    return '';
  }

  const candidates = [row.name, row.title, row.event_name];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

export function getEventDateRangeLabel(row: EventRow | Record<string, unknown> | null | undefined): string {
  if (!row) {
    return '';
  }

  const start = formatEventDateValue(row.start_date ?? row.starts_at);
  const end = formatEventDateValue(row.end_date ?? row.ends_at);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end;
}

export function getEventLocationLabel(row: EventRow | Record<string, unknown> | null | undefined): string {
  if (!row) {
    return '';
  }

  const directLocation = [row.location, row.venue]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(', ');
  if (directLocation.length > 0) {
    return directLocation;
  }

  const cityStateCountry = [row.city, row.state, row.country]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(', ');
  return cityStateCountry;
}

export async function fetchActiveEventByCompanyId(companyId: string) {
  const normalizedCompanyId = companyId.trim();
  if (!normalizedCompanyId) {
    return { data: null as EventRow | null, error: null };
  }

  return supabase
    .from('events')
    .select('*')
    .eq('company_id', normalizedCompanyId)
    .eq('is_active', true)
    .maybeSingle<EventRow>();
}

export async function fetchEventById(eventId: string) {
  const normalizedEventId = eventId.trim();
  if (!normalizedEventId) {
    return { data: null as EventRow | null, error: null };
  }

  return supabase
    .from('events')
    .select('*')
    .eq('id', normalizedEventId)
    .maybeSingle<EventRow>();
}

export function getLeadEventId(row: Record<string, unknown> | null | undefined): string {
  if (!row) {
    return '';
  }

  const value = row.event_id;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

export function getLeadEventName(row: Record<string, unknown> | null | undefined): string {
  if (!row) {
    return '';
  }

  const candidates = [row.event_name, row.event_title];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

export async function createLeadFromScan(input: CreateLeadFromScanInput): Promise<string> {
  const qrValue = input.qr.trim();
  if (!qrValue) {
    throw new Error('Scanned QR value is empty.');
  }

  const contextSnapshot = getCompanyContextSnapshot();
  const resolvedCompanyId = contextSnapshot.activeCompanyId ?? contextSnapshot.companyId;
  const resolvedContextUserId = contextSnapshot.userId;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const resolvedUserId = session?.user?.id ?? resolvedContextUserId;

  if (!resolvedCompanyId || !resolvedUserId) {
    throw new Error('Missing user or company context.');
  }

  const parsed = parseScannedLeadPayload(qrValue);
  const targetCompanyId = parsed.company_id ?? resolvedCompanyId;
  let targetEventId = parsed.event_id;

  if (!targetEventId) {
    const { data: activeEventRow, error: activeEventError } = await fetchActiveEventByCompanyId(targetCompanyId);
    if (activeEventError) {
      throw new Error(activeEventError.message ?? 'Unable to load active event.');
    }

    targetEventId = normalizeEventId(activeEventRow);
  }

  if (!targetEventId) {
    throw new Error('No active event. Ask admin to set one.');
  }

  const baseInsertPayload = {
    company_id: parsed.company_id ?? targetCompanyId,
    event_id: parsed.event_id ?? targetEventId,
    owner_user_id: resolvedUserId,
    full_name: parsed.full_name ?? 'Scanned Lead',
    job_title: parsed.job_title ?? '',
    priority_score: parsed.priority_score ?? 0,
    status: 'new',
  };
  const insertCandidates: Record<string, unknown>[] = [baseInsertPayload];

  let createdLead: InsertedLeadRow | null = null;
  let lastErrorMessage = 'Failed to create lead.';

  for (const insertPayload of insertCandidates) {
    console.log('SCAN_INSERT_PAYLOAD', insertPayload);
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('AUTH DEBUG user id =', sessionData?.session?.user?.id ?? null);
    const { data, error } = await supabase
      .from('leads')
      .insert(insertPayload)
      .select(LEADS_SELECT_COLUMNS)
      .single<InsertedLeadRow>();

    if (!error && data?.id != null) {
      createdLead = data;
      break;
    }

    if (error?.message) {
      lastErrorMessage = error.message;
      if (!isColumnError(error.message)) {
        break;
      }
    }
  }

  if (!createdLead?.id) {
    throw new Error(lastErrorMessage);
  }

  return String(createdLead.id);
}

export async function markLeadHotByScope<TLeadRow = UpdateableLeadRow>(
  scope: CompanyScope,
  leadId: string
): Promise<{ data: TLeadRow | null; error: { message?: string } | null }> {
  const updateCandidates: Record<string, unknown>[] = [{ status: 'hot' }];

  let lastError: { message?: string } | null = null;

  for (const patch of updateCandidates) {
    const scopedQuery = applyLeadCompanyScope(supabase.from('leads').update(patch), scope);
    if (!scopedQuery) {
      return { data: null, error: null };
    }

    const { data, error } = await scopedQuery
      .eq('id', leadId)
      .select(LEADS_SELECT_COLUMNS)
      .single<TLeadRow>();
    if (!error) {
      return { data: data ?? null, error: null };
    }

    lastError = { message: error.message ?? 'Failed to mark lead hot.' };
    if (!error.message || !isColumnError(error.message)) {
      break;
    }
  }

  return { data: null, error: lastError };
}

export async function updateLeadByScope<TLeadRow = Record<string, unknown>>(
  scope: CompanyScope,
  leadId: string,
  payload: UpdateLeadInput
): Promise<{ data: TLeadRow | null; error: { message?: string } | null }> {
  const basePayload: Record<string, unknown> = {};
  if (typeof payload.priority_score === 'number') {
    basePayload.priority_score = payload.priority_score;
  }
  if (payload.follow_up_date === null) {
    basePayload.follow_up_date = null;
  } else if (typeof payload.follow_up_date === 'string') {
    basePayload.follow_up_date = payload.follow_up_date;
  }
  const payloadCandidates: Record<string, unknown>[] = [
    { ...basePayload },
    { ...basePayload },
    { ...basePayload },
    { ...basePayload },
  ].filter((item) => Object.keys(item).length > 0);

  let lastError: { message?: string } | null = null;

  for (const patch of payloadCandidates) {
    const scopedQuery = applyLeadCompanyScope(supabase.from('leads').update(patch), scope);
    if (!scopedQuery) {
      return { data: null, error: null };
    }

    const { data, error } = await scopedQuery
      .eq('id', leadId)
      .select(LEADS_SELECT_COLUMNS)
      .single<TLeadRow>();
    if (!error) {
      return { data: data ?? null, error: null };
    }

    lastError = { message: error.message ?? 'Failed to save lead.' };
    if (!error.message || !isColumnError(error.message)) {
      break;
    }
  }

  return { data: null, error: lastError };
}

export function getLeadScannedValue(row: Record<string, unknown> | null | undefined): string {
  if (!row) {
    return '';
  }

  const candidates = [row.qr_value, row.raw_payload];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

export function getLeadCreatedAt(row: Record<string, unknown> | null | undefined): string {
  if (!row || typeof row.created_at !== 'string' || row.created_at.trim().length === 0) {
    return '';
  }

  const date = new Date(row.created_at);
  if (Number.isNaN(date.getTime())) {
    return row.created_at;
  }

  return date.toLocaleString();
}

export function isLeadHot(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) {
    return false;
  }

  const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
  return status === 'hot';
}

export function supportsMarkHot(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(row, 'status');
}

export function getLeadAudioUri(row: Record<string, unknown> | null | undefined): string {
  if (!row) {
    return '';
  }

  const candidates = [row.audio_uri];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

export function getLeadStatus(row: Record<string, unknown> | null | undefined): string {
  if (!row || typeof row.status !== 'string') {
    return 'new';
  }

  const normalized = row.status.trim();
  return normalized.length > 0 ? normalized : 'new';
}

export function starsFromPriorityScore(score: number | null | undefined): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 0;
  }
  if (score >= 95) {
    return 5;
  }
  if (score >= 80) {
    return 4;
  }
  if (score >= 60) {
    return 3;
  }
  if (score >= 40) {
    return 2;
  }
  if (score >= 20) {
    return 1;
  }
  return 0;
}

export function priorityScoreFromStars(stars: number): number {
  if (stars >= 5) {
    return 95;
  }
  if (stars === 4) {
    return 80;
  }
  if (stars === 3) {
    return 60;
  }
  if (stars === 2) {
    return 40;
  }
  if (stars === 1) {
    return 20;
  }
  return 0;
}

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
  const scopedQuery = applyLeadCompanyScope(supabase.from('leads').select(LEADS_SELECT_COLUMNS), scope);
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
  const scopedQuery = applyLeadCompanyScope(supabase.from('leads').select(LEADS_SELECT_COLUMNS), scope);
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
