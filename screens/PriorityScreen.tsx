import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import StarRating from '@/components/StarRating';
import ScreenContainer from '@/components/ui/ScreenContainer';
import {
  fetchActiveEventByCompanyId,
  fetchLeadsByScope,
  hasLeadQueryScope,
  starsFromPriorityScore,
} from '@/lib/api';
import { useCompany } from '@/lib/company-context';

type DbPriorityLeadRow = {
  id?: string | number | null;
  name?: string | null;
  full_name?: string | null;
  title?: string | null;
  job_title?: string | null;
  role?: string | null;
  company?: string | null;
  company_name?: string | null;
  priority_score?: number | null;
  priority?: number | null;
  stars?: number | null;
  status?: string | null;
  quick_tags?: unknown;
  event_id?: string | number | null;
};

type PriorityLeadView = {
  id: string;
  name: string;
  title: string;
  company: string;
  priorityScore: number;
  stars: number;
  highlights: string[];
};

const cardThemes = [
  { base: '#ff2f6d', top: '#ff6197', bottom: '#d61557' },
  { base: '#5448e6', top: '#786fff', bottom: '#3730a3' },
  { base: '#111827', top: '#334155', bottom: '#020617' },
  { base: '#0f172a', top: '#1e293b', bottom: '#030712' },
];

function getPriorityScore(row: DbPriorityLeadRow): number {
  const candidate =
    typeof row.priority_score === 'number' && Number.isFinite(row.priority_score)
      ? row.priority_score
      : typeof row.priority === 'number' && Number.isFinite(row.priority)
        ? row.priority
        : 0;
  return Math.max(0, Math.min(100, Math.round(candidate)));
}

function getLeadName(row: DbPriorityLeadRow): string {
  return (
    (typeof row.name === 'string' && row.name.trim()) ||
    (typeof row.full_name === 'string' && row.full_name.trim()) ||
    'Unknown Lead'
  );
}

function getLeadTitle(row: DbPriorityLeadRow): string {
  return (
    (typeof row.title === 'string' && row.title.trim()) ||
    (typeof row.job_title === 'string' && row.job_title.trim()) ||
    (typeof row.role === 'string' && row.role.trim()) ||
    'No title'
  );
}

function getLeadCompany(row: DbPriorityLeadRow): string {
  return (
    (typeof row.company === 'string' && row.company.trim()) ||
    (typeof row.company_name === 'string' && row.company_name.trim()) ||
    'Unknown Company'
  );
}

function getHighlights(row: DbPriorityLeadRow): string[] {
  if (Array.isArray(row.quick_tags)) {
    return row.quick_tags
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 3);
  }

  const status = typeof row.status === 'string' ? row.status.trim() : '';
  return status ? [status] : [];
}

function normalizeEventId(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

export default function PriorityScreen() {
  const router = useRouter();
  const { activeCompanyId, isReady, role } = useCompany();
  const [leads, setLeads] = useState<PriorityLeadView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeEventLabel, setActiveEventLabel] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!isReady) {
        return () => undefined;
      }

      const scope = { role, activeCompanyId };
      if (!hasLeadQueryScope(scope)) {
        setLeads([]);
        setIsLoading(false);
        setActiveEventLabel('');
        return () => undefined;
      }

      let isActive = true;

      const loadPriorityLeads = async () => {
        setIsLoading(true);

        let activeEventId = '';
        if (typeof activeCompanyId === 'string' && activeCompanyId.trim().length > 0) {
          const { data: eventRow } = await fetchActiveEventByCompanyId(activeCompanyId);
          if (!isActive) {
            return;
          }
          activeEventId = normalizeEventId(eventRow?.id);
          setActiveEventLabel(activeEventId ? 'Close These First' : 'Top Priority Leads');
        } else {
          setActiveEventLabel('Top Priority Leads');
        }

        const { data } = await fetchLeadsByScope<DbPriorityLeadRow>(scope);
        if (!isActive) {
          return;
        }

        const rows = Array.isArray(data) ? (data as DbPriorityLeadRow[]) : [];
        const eventScopedRows =
          activeEventId.length > 0
            ? rows.filter((row) => normalizeEventId(row.event_id) === activeEventId)
            : rows;

        const mapped = eventScopedRows
          .map((row) => {
            const priorityScore = getPriorityScore(row);
            const stars =
              typeof row.stars === 'number' && Number.isFinite(row.stars) && row.stars > 0
                ? Math.max(0, Math.min(5, Math.round(row.stars)))
                : starsFromPriorityScore(priorityScore);

            return {
              id: row.id != null ? String(row.id) : '',
              name: getLeadName(row),
              title: getLeadTitle(row),
              company: getLeadCompany(row),
              priorityScore,
              stars,
              highlights: getHighlights(row),
            };
          })
          .filter((row) => row.id.length > 0)
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .slice(0, 6);

        setLeads(mapped);
        setIsLoading(false);
      };

      loadPriorityLeads().catch(() => {
        if (isActive) {
          setLeads([]);
          setIsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [isReady, role, activeCompanyId])
  );

  const sectionTitle = useMemo(() => activeEventLabel || 'Close These First', [activeEventLabel]);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.content}>
      <View style={styles.pageHeader}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="flash-outline" size={22} color="#ffffff" />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.pageTitle}>Priority</Text>
          <Text style={styles.subtitle}>AI-ranked by revenue potential</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionHeader}>
        <Ionicons name="flame-outline" size={20} color="#fb7185" />
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : leads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No prioritized leads yet.</Text>
        </View>
      ) : (
        <View style={styles.cardStack}>
          {leads.map((lead, index) => {
            const theme = cardThemes[index] ?? cardThemes[cardThemes.length - 1];

            return (
              <Pressable
                key={lead.id}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/leads/[id]',
                    params: { id: lead.id },
                  } as never)
                }
                style={[styles.priorityCard, { backgroundColor: theme.base }]}>
                <View style={[styles.glowTop, { backgroundColor: theme.top }]} />
                <View style={[styles.glowBottom, { backgroundColor: theme.bottom }]} />

                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>

                <Text style={styles.name}>{lead.name}</Text>
                <Text style={styles.title}>{lead.title}</Text>
                <Text style={styles.company}>{lead.company}</Text>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreBlock}>
                    <View style={styles.scoreValueRow}>
                      <Ionicons name="trending-up-outline" size={16} color="#ffffff" />
                      <Text style={styles.scoreValue}>{lead.priorityScore}</Text>
                    </View>
                    <Text style={styles.scoreLabel}>Priority</Text>
                  </View>

                  <StarRating
                    value={lead.stars}
                    size={20}
                    filledColor="#ffffff"
                    emptyColor="rgba(255,255,255,0.45)"
                  />
                </View>

                <View style={styles.tagRow}>
                  {lead.highlights.map((tag) => (
                    <View key={`${lead.id}-${tag}`} style={styles.tagPill}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 26,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  sectionHeader: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  cardStack: {
    marginTop: 14,
    gap: 14,
  },
  priorityCard: {
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#020617',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  glowTop: {
    position: 'absolute',
    top: -58,
    right: -38,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.45,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    opacity: 0.44,
  },
  rankBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    paddingRight: 66,
  },
  title: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.94)',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  company: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  scoreRow: {
    marginTop: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreBlock: {
    alignItems: 'flex-start',
  },
  scoreValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 52,
    lineHeight: 52,
    fontWeight: '800',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  tagRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  loadingArea: {
    marginTop: 28,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyState: {
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
