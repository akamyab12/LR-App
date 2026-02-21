export enum AppRole {
  PLATFORM_ADMIN = 'platform_admin',
  COMPANY_ADMIN = 'company_admin',
  EXHIBITOR = 'exhibitor',
}

export type AppRoleValue = `${AppRole}`;

export const APP_ROLE_VALUES: AppRoleValue[] = [
  AppRole.PLATFORM_ADMIN,
  AppRole.COMPANY_ADMIN,
  AppRole.EXHIBITOR,
];

export function isAppRole(value: unknown): value is AppRoleValue {
  return typeof value === 'string' && APP_ROLE_VALUES.includes(value as AppRoleValue);
}

export type LeadTag =
  | 'Budget'
  | 'Decision Maker'
  | 'Competitor Mentioned'
  | 'Timeline'
  | 'Product Demo'
  | 'Pricing Discussed'
  | 'Urgent timeline';

export interface LeadAiInsights {
  buyingSignals: string[];
  keyNeeds: string[];
  nextBestAction: string;
}

export interface LeadEnrichment {
  enriched_job_title?: string | null;
  enriched_seniority?: string | null;
  enriched_company_size?: string | null;
  enriched_industry?: string | null;
  enriched_linkedin_url?: string | null;
  enriched_company_domain?: string | null;
  enriched_score?: number | null;
}

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  isHot: boolean;
  badgeLabel: 'Hot' | 'Follow Up';
  priorityScore: number;
  stars: number;
  followUpDate: string;
  quickTags: LeadTag[];
  aiInsights: LeadAiInsights;
  enrichment?: LeadEnrichment;
}

export interface PriorityLead extends Lead {
  rank: number;
  highlights: string[];
}
