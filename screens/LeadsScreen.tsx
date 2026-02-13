import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import StarRating from '@/components/StarRating';
import { fetchLeadsByScope, hasLeadQueryScope } from '@/lib/api';
import { useCompany } from '@/lib/company-context';

type DbLeadRow = {
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
  created_at?: string | null;
  [key: string]: unknown;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getLeadName(lead: DbLeadRow): string {
  return (
    (typeof lead.name === 'string' && lead.name.trim()) ||
    (typeof lead.full_name === 'string' && lead.full_name.trim()) ||
    'Unknown Lead'
  );
}

function getLeadTitle(lead: DbLeadRow): string {
  return (
    (typeof lead.title === 'string' && lead.title.trim()) ||
    (typeof lead.role === 'string' && lead.role.trim()) ||
    'No title'
  );
}

function getLeadCompany(lead: DbLeadRow): string {
  return (
    (typeof lead.company === 'string' && lead.company.trim()) ||
    (typeof lead.company_name === 'string' && lead.company_name.trim()) ||
    'Unknown Company'
  );
}

function getPriorityScore(lead: DbLeadRow): number {
  const value = typeof lead.priority_score === 'number' ? lead.priority_score : lead.priority;
  return Number.isFinite(value) ? Number(value) : 0;
}

function getStars(lead: DbLeadRow): number {
  if (typeof lead.stars === 'number' && Number.isFinite(lead.stars)) {
    return clamp(Math.round(lead.stars), 0, 5);
  }

  return clamp(Math.round(getPriorityScore(lead) / 20), 0, 5);
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

export default function LeadsScreen() {
  const router = useRouter();
  const { activeCompanyId, isReady, role } = useCompany();
  const [query, setQuery] = useState('');
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leads, setLeads] = useState<DbLeadRow[]>([]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const scope = { role, activeCompanyId };
    if (!hasLeadQueryScope(scope)) {
      setLeads([]);
      setIsLoadingLeads(false);
      return;
    }

    let isActive = true;

    const loadLeads = async () => {
      setIsLoadingLeads(true);

      const { data } = await fetchLeadsByScope<DbLeadRow>(scope);

      if (!isActive) {
        return;
      }

      setLeads(Array.isArray(data) ? (data as DbLeadRow[]) : []);
      setIsLoadingLeads(false);
    };

    loadLeads().catch(() => {
      if (isActive) {
        setLeads([]);
        setIsLoadingLeads(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [isReady, activeCompanyId, role]);

  const filteredLeads = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return leads;
    }

    return leads.filter((lead) => {
      const haystack = [getLeadName(lead), getLeadTitle(lead), getLeadCompany(lead)].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [leads, query]);

  const hotLeadCount = useMemo(() => leads.filter((lead) => lead.is_hot === true).length, [leads]);

  const isLoading = !isReady || isLoadingLeads;

  return (
    <View style={styles.page}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>All Leads</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{leads.length}</Text>
            <Text style={styles.statLabel}>Total Leads</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{hotLeadCount}</Text>
            <Text style={styles.statLabel}>Hot Leads</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <ScrollView
          style={styles.listArea}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {filteredLeads.map((lead, index) => {
            const id = lead.id != null ? String(lead.id) : '';
            const isHot = lead.is_hot === true;
            const badgeLabel =
              typeof lead.badge_label === 'string' && lead.badge_label.trim().length > 0
                ? lead.badge_label
                : isHot
                  ? 'Hot'
                  : 'Lead';
            const priority = getPriorityScore(lead);

            return (
              <Pressable
                key={id || `lead-${index}`}
                style={styles.leadCard}
                disabled={!id}
                onPress={() => (id ? router.push(`/(tabs)/leads/${encodeURIComponent(id)}` as never) : undefined)}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.name}>{getLeadName(lead)}</Text>
                  <View style={[styles.badge, isHot ? styles.hotBadge : styles.followUpBadge]}>
                    <Text style={styles.badgeText}>{badgeLabel}</Text>
                  </View>
                </View>

                <Text style={styles.titleText}>{getLeadTitle(lead)}</Text>
                <Text style={styles.company}>{getLeadCompany(lead)}</Text>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreBlock}>
                    <View style={styles.scoreValueRow}>
                      <Ionicons name="trending-up-outline" size={16} color="#4f46e5" />
                      <Text style={styles.scoreValue}>{priority}</Text>
                    </View>
                    <Text style={styles.scoreLabel}>Priority</Text>
                  </View>

                  <StarRating value={getStars(lead)} size={20} />
                </View>

                <View style={styles.followUpPill}>
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text style={styles.followUpText}>Follow up: {formatFollowUpDate(lead.follow_up_date)}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 42,
    letterSpacing: -1,
    fontWeight: '800',
    color: '#0f172a',
  },
  searchWrap: {
    marginTop: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  statsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    marginTop: 4,
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 16,
  },
  leadCard: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    color: '#0f172a',
  },
  badge: {
    borderRadius: 18,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hotBadge: {
    backgroundColor: '#ff234f',
  },
  followUpBadge: {
    backgroundColor: '#ff5a00',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  titleText: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
  },
  company: {
    marginTop: 2,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '600',
    color: '#6b7280',
  },
  scoreRow: {
    marginTop: 14,
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
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '800',
    color: '#0f172a',
  },
  scoreLabel: {
    marginTop: 2,
    fontSize: 18,
    color: '#64748b',
    fontWeight: '700',
  },
  followUpPill: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followUpText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  loadingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
