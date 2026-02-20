import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FollowUpDatePicker from '@/components/FollowUpDatePicker';
import StarRating from '@/components/StarRating';
import { priorityScoreFromStars, starsFromPriorityScore } from '@/lib/api';
import { useCompany } from '@/lib/company-context';
import { supabase } from '@/lib/supabase';

type DbLeadRow = {
  id?: string | number;
  full_name?: string | null;
  job_title?: string | null;
  company_text?: string | null;
  priority_score?: number | null;
  rating?: number | null;
  temperature?: string | null;
  status?: string | null;
  follow_up_date?: string | null;
  company_id?: string | number | null;
  event_id?: string | number | null;
  created_at?: string | null;
  [key: string]: unknown;
};

function getLeadStatusValue(lead: DbLeadRow): string {
  if (typeof lead.status !== 'string') {
    return '';
  }
  return lead.status.trim().toLowerCase();
}

function formatLeadStatusLabel(status: string): string {
  if (!status) {
    return '';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getLeadName(lead: DbLeadRow): string {
  return (typeof lead.full_name === 'string' && lead.full_name.trim()) || 'Unknown Lead';
}

function getLeadTitle(lead: DbLeadRow): string {
  return (typeof lead.job_title === 'string' && lead.job_title.trim()) || 'No title';
}

function getLeadCompany(lead: DbLeadRow): string {
  return (typeof lead.company_text === 'string' && lead.company_text.trim()) || 'Unknown Company';
}

function getPriorityScore(lead: DbLeadRow): number {
  const value = lead.priority_score;
  return Number.isFinite(value) ? Number(value) : 0;
}

function getStars(lead: DbLeadRow): number {
  if (typeof lead.rating === 'number' && Number.isFinite(lead.rating) && lead.rating > 0) {
    return Math.max(0, Math.min(5, Math.round(lead.rating)));
  }

  return starsFromPriorityScore(getPriorityScore(lead));
}

function toFollowUpInput(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeEntityId(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

export default function LeadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isReady, activeCompanyId } = useCompany();
  const [query, setQuery] = useState('');
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leads, setLeads] = useState<DbLeadRow[]>([]);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editCompanyText, setEditCompanyText] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [editTemperature, setEditTemperature] = useState<'hot' | 'medium' | 'cold'>('medium');
  const [editFollowUpDate, setEditFollowUpDate] = useState<string | null>(null);
  const [editLeadOriginal, setEditLeadOriginal] = useState<DbLeadRow | null>(null);

  const loadLeads = useCallback(async () => {
    if (!isReady) {
      return;
    }

    setIsLoadingLeads(true);
    const CURRENT_COMPANY_ID =
      typeof activeCompanyId === 'string' && activeCompanyId.trim().length > 0
        ? activeCompanyId.trim()
        : null;

    if (!CURRENT_COMPANY_ID) {
      setLeads([]);
      setIsLoadingLeads(false);
      return;
    }

    const leadsBaseQuery = supabase
      .from('leads')
      .select(
        'id, full_name, job_title, priority_score, rating, temperature, status, follow_up_date, company_text, company_id, owner_user_id, created_at'
      ) as unknown as {
      eq: (column: string, value: unknown) => {
        order: (column: string, options?: { ascending?: boolean }) => {
          limit: (value: number) => Promise<{ data: DbLeadRow[] | null; error: unknown }>;
        };
      };
      order: (column: string, options?: { ascending?: boolean }) => {
        limit: (value: number) => Promise<{ data: DbLeadRow[] | null; error: unknown }>;
      };
    };

    const leadsScopedQuery = leadsBaseQuery.eq('company_id', CURRENT_COMPANY_ID) as unknown as {
      order: (column: string, options?: { ascending?: boolean }) => {
        limit: (value: number) => Promise<{ data: DbLeadRow[] | null; error: unknown }>;
      };
    };

    const { data } = await leadsScopedQuery
      .order('created_at', { ascending: false })
      .limit(100);

    setLeads(data ?? []);

    setIsLoadingLeads(false);
  }, [isReady, activeCompanyId]);

  useFocusEffect(
    useCallback(() => {
      loadLeads().catch(() => {
        setLeads([]);
        setIsLoadingLeads(false);
      });
      return () => undefined;
    }, [loadLeads])
  );

  const openEditModal = useCallback(
    async (lead: DbLeadRow) => {
      const id = lead.id != null ? String(lead.id) : '';
      if (!id) {
        return;
      }

      const fallbackCompany = getLeadCompany(lead);
      let resolvedCompany = fallbackCompany;
      const companyId = normalizeEntityId(lead.company_id);

      if ((!resolvedCompany || resolvedCompany === 'Unknown Company') && companyId) {
        const { data: companyRow } = await supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .maybeSingle<{ name?: string | null }>();
        if (typeof companyRow?.name === 'string' && companyRow.name.trim().length > 0) {
          resolvedCompany = companyRow.name.trim();
        }
      }

      setEditLeadId(id);
      setEditFullName(getLeadName(lead));
      setEditJobTitle((typeof lead.job_title === 'string' && lead.job_title.trim()) || '');
      const leadCompanyText =
        typeof lead.company_text === 'string' && lead.company_text.trim().length > 0
          ? lead.company_text.trim()
          : resolvedCompany || '';
      setEditCompanyText(leadCompanyText);
      setEditLeadOriginal(lead);

      setEditRating(getStars(lead));
      const normalizedTemperature =
        typeof lead.temperature === 'string' ? lead.temperature.trim().toLowerCase() : 'medium';
      setEditTemperature(
        normalizedTemperature === 'hot' || normalizedTemperature === 'cold' ? normalizedTemperature : 'medium'
      );
      setEditFollowUpDate(toFollowUpInput(lead.follow_up_date) || null);
      setIsEditVisible(true);
    },
    []
  );

  const closeEditModal = useCallback(() => {
    if (isEditSaving) {
      return;
    }
    setIsEditVisible(false);
    setEditLeadId(null);
    setEditLeadOriginal(null);
  }, [isEditSaving]);

  const updateLeadInState = useCallback((leadId: string, patch: Partial<DbLeadRow>) => {
    setLeads((currentLeads) =>
      currentLeads.map((lead) => {
        const currentId = lead.id != null ? String(lead.id) : '';
        if (currentId !== leadId) {
          return lead;
        }
        return {
          ...lead,
          ...patch,
        };
      })
    );
  }, []);

  const saveLeadPatch = useCallback(
    async (leadId: string, patch: Partial<DbLeadRow>, rollbackPatch: Partial<DbLeadRow>) => {
      updateLeadInState(leadId, patch);

      const { error } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', leadId)
        .select('id')
        .single<{ id: string }>();

      if (error) {
        updateLeadInState(leadId, rollbackPatch);
        Alert.alert('Update failed', error.message ?? 'Unable to update lead.');
        return false;
      }

      return true;
    },
    [updateLeadInState]
  );

  const handleCardRatingChange = useCallback(
    async (leadId: string, nextRating: number, currentRating: number) => {
      if (!leadId || nextRating === currentRating) {
        return;
      }

      const currentLead = leads.find((lead) => (lead.id != null ? String(lead.id) : '') === leadId);
      const currentPriorityScore =
        currentLead && typeof currentLead.priority_score === 'number' && Number.isFinite(currentLead.priority_score)
          ? currentLead.priority_score
          : priorityScoreFromStars(currentRating);
      const nextPriorityScore = priorityScoreFromStars(nextRating);

      await saveLeadPatch(
        leadId,
        { rating: nextRating, priority_score: nextPriorityScore },
        { rating: currentRating, priority_score: currentPriorityScore }
      );
    },
    [leads, saveLeadPatch]
  );

  const handleCardFollowUpChange = useCallback(
    async (leadId: string, nextDate: string | null, currentDate: string | null) => {
      if (!leadId) {
        return;
      }

      const normalizedNextDate =
        typeof nextDate === 'string' && nextDate.trim().length > 0 ? nextDate.trim() : null;
      const normalizedCurrentDate =
        typeof currentDate === 'string' && currentDate.trim().length > 0 ? currentDate.trim() : null;

      if (normalizedNextDate === normalizedCurrentDate) {
        return;
      }

      await saveLeadPatch(
        leadId,
        { follow_up_date: normalizedNextDate },
        { follow_up_date: normalizedCurrentDate }
      );
    },
    [saveLeadPatch]
  );

  const handleEditSave = useCallback(async () => {
    if (!editLeadId || isEditSaving || !editLeadOriginal) {
      return;
    }

    const normalizedFullName = editFullName.trim() || 'New Lead';
    const normalizedJobTitle = editJobTitle.trim();
    const normalizedCompanyText = editCompanyText.trim() || null;
    const normalizedFollowUpDate =
      editFollowUpDate && editFollowUpDate.trim().length > 0 ? editFollowUpDate.trim() : null;

    const patch: Record<string, unknown> = {};

    if (normalizedFullName !== getLeadName(editLeadOriginal)) {
      patch.full_name = normalizedFullName;
    }
    if (
      normalizedJobTitle !==
      ((typeof editLeadOriginal.job_title === 'string' && editLeadOriginal.job_title.trim()) || '')
    ) {
      patch.job_title = normalizedJobTitle;
    }
    if (editRating !== getStars(editLeadOriginal)) {
      patch.rating = editRating;
      patch.priority_score = priorityScoreFromStars(editRating);
    }
    const originalTemperature =
      typeof editLeadOriginal.temperature === 'string' ? editLeadOriginal.temperature.trim().toLowerCase() : 'medium';
    if (editTemperature !== (originalTemperature === 'hot' || originalTemperature === 'cold' ? originalTemperature : 'medium')) {
      patch.temperature = editTemperature;
    }
    if (normalizedFollowUpDate !== (toFollowUpInput(editLeadOriginal.follow_up_date) || null)) {
      patch.follow_up_date = normalizedFollowUpDate;
    }
    const originalCompanyText =
      typeof editLeadOriginal.company_text === 'string' && editLeadOriginal.company_text.trim().length > 0
        ? editLeadOriginal.company_text.trim()
        : null;
    if (normalizedCompanyText !== originalCompanyText) {
      patch.company_text = normalizedCompanyText;
    }

    if (Object.keys(patch).length === 0) {
      setIsEditVisible(false);
      setEditLeadId(null);
      setEditLeadOriginal(null);
      return;
    }

    setIsEditSaving(true);
    const { error } = await supabase
      .from('leads')
      .update(patch)
      .eq('id', editLeadId)
      .select('id')
      .single<{ id: string }>();
    setIsEditSaving(false);

    if (error) {
      Alert.alert('Update failed', error.message ?? 'Unable to update lead.');
      return;
    }

    updateLeadInState(editLeadId, patch);

    setIsEditVisible(false);
    setEditLeadId(null);
    setEditLeadOriginal(null);
    await loadLeads();
  }, [
    editLeadId,
    isEditSaving,
    editLeadOriginal,
    editRating,
    editFullName,
    editJobTitle,
    editCompanyText,
    editTemperature,
    editFollowUpDate,
    loadLeads,
    updateLeadInState,
  ]);

  const filteredLeads = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return leads;
    }

    return leads.filter((lead) => {
      const companyDisplay = getLeadCompany(lead);
      const haystack = [getLeadName(lead), getLeadTitle(lead), companyDisplay].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [leads, query]);

  const leadStatusCount = useMemo(
    () => leads.filter((lead) => getLeadStatusValue(lead) === 'lead').length,
    [leads]
  );

  const isLoading = !isReady || isLoadingLeads;

  return (
    <View style={styles.page}>
      <View style={[styles.headerArea, { paddingTop: insets.top + 14 }]}>
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
            <Text style={styles.statValue}>{leadStatusCount}</Text>
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
            const statusValue = getLeadStatusValue(lead);
            const statusLabel = formatLeadStatusLabel(statusValue);
            const priority = getPriorityScore(lead);

            return (
              <Pressable
                key={id || `lead-${index}`}
                style={styles.leadCard}
                disabled={!id}
                onLongPress={() => {
                  openEditModal(lead).catch(() => undefined);
                }}
                delayLongPress={320}
                onPress={() =>
                  id
                    ? router.push({
                        pathname: '/leads/[id]',
                        params: { id, from: 'leads' },
                      } as never)
                    : undefined
                }>
                <View style={styles.cardTopRow}>
                  <Text style={styles.nameText}>{getLeadName(lead)}</Text>
                  {statusLabel ? (
                    <View
                      style={[
                        styles.statusBadge,
                        statusValue === 'hot'
                          ? styles.statusBadgeHot
                          : statusValue === 'lead'
                            ? styles.statusBadgeLead
                            : styles.statusBadgeNeutral,
                      ]}>
                      <Text style={styles.badgeText}>{statusLabel}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.titleText}>{getLeadTitle(lead)}</Text>
                <Text style={styles.company}>
                  {getLeadCompany(lead)}
                </Text>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreBlock}>
                    <View style={styles.scoreValueRow}>
                      <Ionicons name="trending-up-outline" size={19} color="#4f46e5" />
                      <Text style={styles.scoreValue}>{priority}</Text>
                    </View>
                    <Text style={styles.scoreLabel}>Priority</Text>
                  </View>

                  <StarRating
                    value={getStars(lead)}
                    size={20}
                    onChange={(nextRating) => {
                      void handleCardRatingChange(id, nextRating, getStars(lead));
                    }}
                  />
                </View>
                <FollowUpDatePicker
                  value={toFollowUpInput(lead.follow_up_date) || null}
                  label="Follow up"
                  disabled={!id}
                  onPress={() => console.log('FollowUpDatePicker pressed', id)}
                  onChange={(nextDate) => {
                    void handleCardFollowUpChange(
                      id,
                      nextDate,
                      toFollowUpInput(lead.follow_up_date) || null
                    );
                  }}
                  iconName="time-outline"
                  iconColor="#64748b"
                  showChevron={false}
                  rowStyle={styles.followUpPill}
                  textStyle={styles.followUpText}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={isEditVisible} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Lead</Text>

            <Text style={styles.modalFieldLabel}>Full Name</Text>
            <TextInput style={styles.modalInput} value={editFullName} onChangeText={setEditFullName} />

            <Text style={styles.modalFieldLabel}>Job Title</Text>
            <TextInput style={styles.modalInput} value={editJobTitle} onChangeText={setEditJobTitle} />

            <Text style={styles.modalFieldLabel}>Company</Text>
            <TextInput
              style={styles.modalInput}
              value={editCompanyText}
              onChangeText={setEditCompanyText}
              placeholder="Company"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalFieldLabel}>Rating</Text>
            <View style={styles.modalRatingRow}>
              <StarRating
                value={editRating}
                size={22}
                onChange={(value) => {
                  setEditRating(value);
                }}
              />
            </View>

            <Text style={styles.modalFieldLabel}>Temperature</Text>
            <View style={styles.temperatureRow}>
              {(['hot', 'medium', 'cold'] as const).map((value) => (
                <Pressable
                  key={value}
                  style={[
                    styles.temperatureSegment,
                    editTemperature === value && styles.temperatureSegmentActive,
                  ]}
                  onPress={() => setEditTemperature(value)}>
                  <Text
                    style={[
                      styles.temperatureSegmentText,
                      editTemperature === value && styles.temperatureSegmentTextActive,
                    ]}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalFieldLabel}>Follow Up Date</Text>
            <FollowUpDatePicker
              value={editFollowUpDate}
              label="Follow up"
              onPress={() => console.log('FollowUpDatePicker pressed', editLeadId)}
              onChange={setEditFollowUpDate}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={closeEditModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={handleEditSave} disabled={isEditSaving}>
                <Text style={styles.modalSaveText}>{isEditSaving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  headerArea: {
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e7ec',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
    fontWeight: '800',
    color: '#0f172a',
  },
  searchWrap: {
    marginTop: 18,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  statsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    marginTop: 6,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 16,
  },
  leadCard: {
    borderRadius: 28,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  nameText: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    borderRadius: 999,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  statusBadgeHot: {
    backgroundColor: '#ff2d3f',
  },
  statusBadgeLead: {
    backgroundColor: '#ff5a00',
  },
  statusBadgeNeutral: {
    backgroundColor: '#4f46e5',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  titleText: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  company: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: '#6b7280',
  },
  scoreRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  scoreBlock: {
    alignItems: 'flex-start',
  },
  scoreValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreValue: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    color: '#0f172a',
  },
  scoreLabel: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    color: '#64748b',
    fontWeight: '700',
  },
  followUpPill: {
    marginTop: 16,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  followUpText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  loadingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalFieldLabel: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalInput: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    minHeight: 42,
    paddingHorizontal: 12,
    color: '#0f172a',
    fontSize: 15,
    lineHeight: 20,
  },
  modalReadOnly: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f1f5f9',
    minHeight: 42,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  modalReadOnlyText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  modalRatingRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  temperatureRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  temperatureSegment: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  temperatureSegmentActive: {
    backgroundColor: '#4f46e5',
  },
  temperatureSegmentText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  temperatureSegmentTextActive: {
    color: '#ffffff',
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalSaveButton: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});
