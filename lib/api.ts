import type { Lead, PriorityLead } from '@/lib/types';

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
