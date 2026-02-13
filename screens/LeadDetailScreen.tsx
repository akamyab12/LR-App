import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import StarRating from '@/components/StarRating';
import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import SectionTitle from '@/components/ui/SectionTitle';
import { useCompany } from '@/lib/company-context';
import { supabase } from '@/lib/supabase';
import type { Lead, LeadAiInsights, LeadTag } from '@/lib/types';

type DbLeadDetailRow = {
  id?: string | number;
  name?: string | null;
  full_name?: string | null;
  title?: string | null;
  role?: string | null;
  company?: string | null;
  company_name?: string | null;
  is_hot?: boolean | null;
  badge_label?: string | null;
  priority_score?: number | null;
  priority?: number | null;
  stars?: number | null;
  follow_up_date?: string | null;
  quick_tags?: unknown;
  buying_signals?: unknown;
  key_needs?: unknown;
  next_best_action?: string | null;
};

const ALL_TAGS: LeadTag[] = [
  'Budget',
  'Decision Maker',
  'Competitor Mentioned',
  'Timeline',
  'Product Demo',
  'Pricing Discussed',
  'Urgent timeline',
];

const DEFAULT_AI_INSIGHTS: LeadAiInsights = {
  buyingSignals: ['Budget approved for Q1', 'Primary decision maker', 'Requested follow-up meeting'],
  keyNeeds: ['Engineering stack upgrade'],
  nextBestAction: 'Schedule technical deep-dive meeting next week. Emphasize enterprise features and ROI.',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isLeadTag(value: string): value is LeadTag {
  return ALL_TAGS.includes(value as LeadTag);
}

function normalizeQuickTags(value: unknown): LeadTag[] {
  if (!Array.isArray(value)) {
    return ALL_TAGS;
  }

  const tags = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(isLeadTag);

  return tags.length > 0 ? tags : ALL_TAGS;
}

function normalizeInsightList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : fallback;
}

function formatFollowUpDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'TBD';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const year = parsed.getFullYear();

  return `${month}/${day}/${year}`;
}

function mapRowToLead(row: DbLeadDetailRow): Lead {
  const priorityScore =
    typeof row.priority_score === 'number' && Number.isFinite(row.priority_score)
      ? row.priority_score
      : typeof row.priority === 'number' && Number.isFinite(row.priority)
        ? row.priority
        : 0;
  const stars =
    typeof row.stars === 'number' && Number.isFinite(row.stars)
      ? clamp(Math.round(row.stars), 0, 5)
      : clamp(Math.round(priorityScore / 20), 0, 5);
  const isHot = row.is_hot === true;
  const badgeLabel = isHot ? 'Hot' : 'Follow Up';

  return {
    id: row.id != null ? String(row.id) : '',
    name:
      (typeof row.name === 'string' && row.name.trim()) ||
      (typeof row.full_name === 'string' && row.full_name.trim()) ||
      'Unknown Lead',
    title:
      (typeof row.title === 'string' && row.title.trim()) ||
      (typeof row.role === 'string' && row.role.trim()) ||
      'No title',
    company:
      (typeof row.company === 'string' && row.company.trim()) ||
      (typeof row.company_name === 'string' && row.company_name.trim()) ||
      'Unknown Company',
    isHot,
    badgeLabel,
    priorityScore,
    stars,
    followUpDate: formatFollowUpDate(row.follow_up_date),
    quickTags: normalizeQuickTags(row.quick_tags),
    aiInsights: {
      buyingSignals: normalizeInsightList(row.buying_signals, DEFAULT_AI_INSIGHTS.buyingSignals),
      keyNeeds: normalizeInsightList(row.key_needs, DEFAULT_AI_INSIGHTS.keyNeeds),
      nextBestAction:
        (typeof row.next_best_action === 'string' && row.next_best_action.trim()) ||
        DEFAULT_AI_INSIGHTS.nextBestAction,
    },
  };
}

export default function LeadDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeCompanyId, isReady } = useCompany();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const leadId = useMemo(() => {
    const value = params.id;
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }, [params.id]);

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<LeadTag[]>([]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!leadId) {
      setLead(null);
      setSelectedTags([]);
      setIsLoading(false);
      return;
    }

    if (!activeCompanyId) {
      setLead(null);
      setSelectedTags([]);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);

    const loadLead = async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', activeCompanyId)
        .eq('id', leadId)
        .single<DbLeadDetailRow>();

      if (!isActive) {
        return;
      }

      const mappedLead = data ? mapRowToLead(data) : null;
      setLead(mappedLead);
      setSelectedTags(mappedLead ? mappedLead.quickTags.slice(0, 2) : []);
      setIsLoading(false);
    };

    loadLead()
      .catch(() => {
        if (isActive) {
          setLead(null);
          setSelectedTags([]);
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [leadId, activeCompanyId, isReady]);

  const toggleTag = (tag: LeadTag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((item) => item !== tag);
      }
      return [...prev, tag];
    });
  };

  const renderInsightRows = (items: string[]) => {
    return (
      <View style={styles.insightList}>
        {items.map((item, index) => (
          <View
            key={`${item}-${index}`}
            style={[styles.insightRow, index < items.length - 1 && styles.insightRowDivider]}>
            <View style={styles.insightDot} />
            <Text style={styles.insightItemText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      </SafeAreaView>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <AppHeader onBack={() => router.back()} />
        <View style={styles.stateWrap}>
          <Text style={styles.notFoundTitle}>{leadId ? 'Lead not found' : 'Missing lead id'}</Text>
          <Pressable style={styles.backFallbackButton} onPress={() => router.back()}>
            <Text style={styles.backFallbackText}>Back to Leads</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader onBack={() => router.back()} />

        <View style={styles.nameRow}>
          <Text style={styles.name}>{lead.name}</Text>
          {lead.isHot ? (
            <View style={styles.hotPill}>
              <Text style={styles.hotPillText}>HOT LEAD</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title}>{lead.title}</Text>
        <Text style={styles.company}>{lead.company}</Text>

        <View style={styles.starRow}>
          <StarRating value={lead.stars} size={44} />
        </View>

        <SectionTitle title="Quick Tags" titleStyle={styles.sectionTitle} style={styles.sectionSpacing} />
        <View style={styles.tagWrap}>
          {lead.quickTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <Pressable
                key={tag}
                style={[styles.tagPill, isSelected ? styles.tagPillSelected : styles.tagPillMuted]}
                onPress={() => toggleTag(tag)}>
                {isSelected ? <Ionicons name="checkmark" size={16} color="#ffffff" /> : null}
                <Text style={[styles.tagText, isSelected ? styles.tagTextSelected : styles.tagTextMuted]}>
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title="Follow-Up" titleStyle={styles.sectionTitle} style={styles.sectionSpacing} />
        <Card style={styles.followUpCard}>
          <View style={styles.followUpLeft}>
            <Ionicons name="calendar-outline" size={20} color="#4f46e5" />
            <Text style={styles.followUpDate}>{lead.followUpDate}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
        </Card>

        <SectionTitle title="Conversation Notes" titleStyle={styles.sectionTitle} style={styles.sectionSpacing} />
        <Card style={styles.conversationCard}>
          <View style={styles.bigMicButton}>
            <Ionicons name="mic-outline" size={32} color="#ffffff" />
          </View>
          <Text style={styles.conversationHint}>Tap to record conversation notes</Text>
        </Card>

        <View style={styles.aiCard}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiIconSquare}>
              <Ionicons name="flash-outline" size={18} color="#ffffff" />
            </View>
            <Text style={styles.aiTitle}>AI Insights</Text>
          </View>

          <Text style={styles.aiSectionTitle}>Buying Signals</Text>
          {renderInsightRows(lead.aiInsights.buyingSignals)}

          <Text style={[styles.aiSectionTitle, styles.aiSectionSpacing]}>Key Needs</Text>
          {renderInsightRows(lead.aiInsights.keyNeeds)}

          <Text style={styles.aiSectionTitle}>Recommended Approach</Text>
          <View style={styles.recommendationBox}>
            <Text style={styles.recommendationText}>{lead.aiInsights.nextBestAction}</Text>
          </View>

          <View style={styles.priorityScoreBox}>
            <Text
              style={styles.priorityLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}>
              Priority Score
            </Text>
            <View style={styles.priorityValueRow}>
              <Text
                style={styles.priorityValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}>
                {lead.priorityScore}
              </Text>
              <Text
                style={styles.priorityOutOf}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}>
                /100
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save & Return to Leads</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  notFoundTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: '#111827',
    fontWeight: '700',
  },
  backFallbackButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backFallbackText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  nameRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 50,
    lineHeight: 54,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.8,
  },
  hotPill: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  hotPillText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  title: {
    marginTop: 6,
    fontSize: 40,
    lineHeight: 44,
    color: '#1f2937',
    fontWeight: '700',
  },
  company: {
    marginTop: 3,
    fontSize: 32,
    lineHeight: 38,
    color: '#64748b',
    fontWeight: '600',
  },
  starRow: {
    marginTop: 14,
  },
  sectionSpacing: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 38,
    lineHeight: 40,
    color: '#111827',
    fontWeight: '800',
  },
  tagWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  tagPillSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  tagPillMuted: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  tagText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  tagTextSelected: {
    color: '#ffffff',
  },
  tagTextMuted: {
    color: '#4b5563',
  },
  followUpCard: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    shadowOpacity: 0,
    elevation: 0,
  },
  followUpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  followUpDate: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    color: '#111827',
  },
  conversationCard: {
    marginTop: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    alignItems: 'center',
    paddingVertical: 20,
    shadowOpacity: 0,
    elevation: 0,
  },
  bigMicButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
  },
  conversationHint: {
    marginTop: 14,
    fontSize: 27,
    lineHeight: 32,
    color: '#64748b',
    fontWeight: '700',
  },
  aiCard: {
    marginTop: 20,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#10153c',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: {
    color: '#ffffff',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
  },
  aiSectionTitle: {
    marginTop: 12,
    fontSize: 18,
    lineHeight: 22,
    color: '#e2e8f0',
    fontWeight: '700',
  },
  aiSectionSpacing: {
    marginTop: 14,
  },
  insightList: {
    marginTop: 6,
  },
  insightRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  insightRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.24)',
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    marginTop: 1,
  },
  insightItemText: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  recommendationBox: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recommendationText: {
    color: '#f1f5f9',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
  },
  priorityScoreBox: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.22)',
    paddingLeft: 14,
    paddingRight: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  priorityLabel: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '700',
    flexShrink: 1,
    paddingRight: 10,
  },
  priorityValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  priorityValue: {
    color: '#4f46e5',
    fontSize: 64,
    lineHeight: 64,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
    minWidth: 0,
  },
  priorityOutOf: {
    color: '#cbd5e1',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '700',
    marginLeft: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  saveButton: {
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
});
