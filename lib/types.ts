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
}

export interface PriorityLead extends Lead {
  rank: number;
  highlights: string[];
}
