import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  hasLeadQueryScope,
  priorityScoreFromStars,
  starsFromPriorityScore,
} from '@/lib/api';
import { useCompany } from '@/lib/company-context';
import { supabase } from '@/lib/supabase';

type DbLeadRow = {
  id?: string | number;
  name?: string | null;
  full_name?: string | null;
  title?: string | null;
  job_title?: string | null;
  role?: string | null;
  company?: string | null;
  company_name?: string | null;
  is_hot?: boolean | null;
  badge_label?: string | null;
  priority_score?: number | null;
  priority?: number | null;
  stars?: number | null;
  status?: string | null;
  follow_up_date?: string | null;
  company_id?: string | number | null;
  event_id?: string | number | null;
  created_at?: string | null;
  [key: string]: unknown;
};

function isHotLeadRow(lead: DbLeadRow): boolean {
  return lead.is_hot === true;
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
    (typeof lead.job_title === 'string' && lead.job_title.trim()) ||
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

function getCompanyId(lead: DbLeadRow): string {
  if (typeof lead.company_id === 'string' && lead.company_id.trim().length > 0) {
    return lead.company_id.trim();
  }
  if (typeof lead.company_id === 'number' && Number.isFinite(lead.company_id)) {
    return String(lead.company_id);
  }
  return '';
}

function getPriorityScore(lead: DbLeadRow): number {
  const value = typeof lead.priority_score === 'number' ? lead.priority_score : lead.priority;
  return Number.isFinite(value) ? Number(value) : 0;
}

function getStars(lead: DbLeadRow): number {
  if (typeof lead.stars === 'number' && Number.isFinite(lead.stars) && lead.stars > 0) {
    return Math.max(0, Math.min(5, Math.round(lead.stars)));
  }

  return starsFromPriorityScore(getPriorityScore(lead));
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
  const { activeCompanyId, isReady, role } = useCompany();
  const [query, setQuery] = useState('');
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leads, setLeads] = useState<DbLeadRow[]>([]);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanyDisplay, setEditCompanyDisplay] = useState('');
  const [isCompanyNameEditable, setIsCompanyNameEditable] = useState(false);
  const [editPriorityScore, setEditPriorityScore] = useState('0');
  const [editRating, setEditRating] = useState(0);
  const [editIsHot, setEditIsHot] = useState(false);
  const [editFollowUpDate, setEditFollowUpDate] = useState<string | null>(null);
  const [isCompanyNameColumnAvailable, setIsCompanyNameColumnAvailable] = useState(false);
  const [editLeadOriginal, setEditLeadOriginal] = useState<DbLeadRow | null>(null);
  const [companyNameById, setCompanyNameById] = useState<Record<string, string>>({});

  const loadLeads = useCallback(async () => {
    if (!isReady) {
      return;
    }

    const scope = { role, activeCompanyId };
    if (!hasLeadQueryScope(scope)) {
      setLeads([]);
      setIsLoadingLeads(false);
      return;
    }

    setIsLoadingLeads(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const CURRENT_COMPANY_ID = activeCompanyId;
    let leadsQuery = supabase
      .from('leads')
      .select('id, full_name, company_id, owner_user_id, created_at');

    if (role !== 'platform_admin' && typeof CURRENT_COMPANY_ID === 'string' && CURRENT_COMPANY_ID.trim().length > 0) {
      leadsQuery = leadsQuery.eq('company_id', CURRENT_COMPANY_ID.trim());
    }

    const { data, error } = await leadsQuery.limit(50);
    console.log('LEADS_FETCH_DEBUG', {
      userId: session?.user?.id ?? null,
      companyId: CURRENT_COMPANY_ID ?? null,
      error,
      count: data?.length ?? 0,
      sample: data?.[0] ?? null,
    });
    const rows = Array.isArray(data) ? (data as DbLeadRow[]) : [];
    const companyIds = Array.from(new Set(rows.map(getCompanyId).filter((value) => value.length > 0)));
    let companyMap: Record<string, string> = {};

    if (companyIds.length > 0) {
      const companyRows = await Promise.all(
        companyIds.map(async (companyId) => {
          const { data: companyRow } = await supabase
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .maybeSingle<{ name?: string | null }>();
          return {
            id: companyId,
            name: typeof companyRow?.name === 'string' ? companyRow.name.trim() : '',
          };
        })
      );
      companyMap = companyRows.reduce<Record<string, string>>((acc, row) => {
        if (row.id && row.name) {
          acc[row.id] = row.name;
        }
        return acc;
      }, {});
    }
    setCompanyNameById(companyMap);
    setLeads(rows);

    setIsLoadingLeads(false);
  }, [isReady, role, activeCompanyId]);

  useFocusEffect(
    useCallback(() => {
      loadLeads().catch(() => {
        setLeads([]);
        setIsLoadingLeads(false);
      });
      return () => undefined;
    }, [loadLeads])
  );

  useEffect(() => {
    let isActive = true;

    const detectCompanyNameColumn = async () => {
      const { error } = await supabase.from('leads').select('id').limit(1);
      if (!isActive) {
        return;
      }
      setIsCompanyNameColumnAvailable(!error);
    };

    detectCompanyNameColumn().catch(() => {
      if (isActive) {
        setIsCompanyNameColumnAvailable(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

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

      let leadSnapshot: DbLeadRow = lead;
      const resolvedCompanyFromMap = companyNameById[getCompanyId(lead)];
      setEditLeadId(id);
      setEditFullName(getLeadName(lead));
      setEditJobTitle(
        (typeof lead.job_title === 'string' && lead.job_title.trim()) ||
          (typeof lead.title === 'string' && lead.title.trim()) ||
          ''
      );
      setEditCompanyDisplay(resolvedCompanyFromMap || resolvedCompany || 'Unknown Company');
      if (isCompanyNameColumnAvailable) {
        const { data: companyNameRow } = await supabase
          .from('leads')
          .select('company_name')
          .eq('id', id)
          .maybeSingle<{ company_name?: string | null }>();
        setIsCompanyNameEditable(true);
        setEditCompanyName(
          (typeof companyNameRow?.company_name === 'string' && companyNameRow.company_name.trim()) ||
            (typeof lead.company_name === 'string' && lead.company_name.trim()) ||
            ''
        );
        leadSnapshot = {
          ...lead,
          company_name:
            (typeof companyNameRow?.company_name === 'string' && companyNameRow.company_name.trim()) ||
            (typeof lead.company_name === 'string' && lead.company_name.trim()) ||
            null,
        };
      } else {
        setIsCompanyNameEditable(false);
        setEditCompanyName('');
      }
      setEditLeadOriginal(leadSnapshot);

      const priorityScore = getPriorityScore(lead);
      setEditPriorityScore(String(priorityScore));
      setEditRating(getStars(lead));
      setEditIsHot(lead.is_hot === true);
      setEditFollowUpDate(toFollowUpInput(lead.follow_up_date) || null);
      setIsEditVisible(true);
    },
    [isCompanyNameColumnAvailable, companyNameById]
  );

  const closeEditModal = useCallback(() => {
    if (isEditSaving) {
      return;
    }
    setIsEditVisible(false);
    setEditLeadId(null);
    setEditLeadOriginal(null);
  }, [isEditSaving]);

  const handleEditSave = useCallback(async () => {
    if (!editLeadId || isEditSaving || !editLeadOriginal) {
      return;
    }

    const rawPriority = Number.parseInt(editPriorityScore.trim(), 10);
    const safePriority = Number.isFinite(rawPriority) && rawPriority >= 0 ? Math.min(100, rawPriority) : 0;
    const resolvedPriority = editRating > 0 ? priorityScoreFromStars(editRating) : safePriority;
    const normalizedFullName = editFullName.trim() || 'New Lead';
    const normalizedJobTitle = editJobTitle.trim();
    const normalizedFollowUpDate =
      editFollowUpDate && editFollowUpDate.trim().length > 0 ? editFollowUpDate.trim() : null;

    const patch: Record<string, unknown> = {};

    if (normalizedFullName !== getLeadName(editLeadOriginal)) {
      patch.full_name = normalizedFullName;
    }
    if (
      normalizedJobTitle !==
      ((typeof editLeadOriginal.job_title === 'string' && editLeadOriginal.job_title.trim()) ||
        (typeof editLeadOriginal.title === 'string' && editLeadOriginal.title.trim()) ||
        '')
    ) {
      patch.job_title = normalizedJobTitle;
    }
    if (resolvedPriority !== getPriorityScore(editLeadOriginal)) {
      patch.priority_score = resolvedPriority;
    }
    if (editIsHot !== (editLeadOriginal.is_hot === true)) {
      patch.is_hot = editIsHot;
    }
    if (normalizedFollowUpDate !== (toFollowUpInput(editLeadOriginal.follow_up_date) || null)) {
      patch.follow_up_date = normalizedFollowUpDate;
    }
    if (isCompanyNameEditable) {
      const normalizedCompanyName = editCompanyName.trim();
      const originalCompanyName =
        typeof editLeadOriginal.company_name === 'string' ? editLeadOriginal.company_name.trim() : '';
      if (normalizedCompanyName !== originalCompanyName) {
        patch.company_name = normalizedCompanyName;
      }
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

    setIsEditVisible(false);
    setEditLeadId(null);
    setEditLeadOriginal(null);
    await loadLeads();
  }, [
    editLeadId,
    isEditSaving,
    editLeadOriginal,
    editPriorityScore,
    editRating,
    editFullName,
    editJobTitle,
    editCompanyName,
    isCompanyNameEditable,
    editIsHot,
    editFollowUpDate,
    loadLeads,
  ]);

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

  const hotLeadCount = useMemo(() => leads.filter((lead) => isHotLeadRow(lead)).length, [leads]);

  const isLoading = !isReady || isLoadingLeads;

  return (
    <View style={styles.page}>
      <View style={[styles.headerArea, { paddingTop: insets.top + 10 }]}>
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
            const isHot = isHotLeadRow(lead);
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
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.editButton}
                      onPress={(event) => {
                        event.stopPropagation?.();
                        openEditModal(lead).catch(() => undefined);
                      }}>
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                    <View style={[styles.badge, isHot ? styles.hotBadge : styles.followUpBadge]}>
                      <Text style={styles.badgeText}>{badgeLabel}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.titleText}>{getLeadTitle(lead)}</Text>
                <Text style={styles.company}>{companyNameById[getCompanyId(lead)] || getLeadCompany(lead)}</Text>

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

      <Modal visible={isEditVisible} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Lead</Text>

            <Text style={styles.modalFieldLabel}>Full Name</Text>
            <TextInput style={styles.modalInput} value={editFullName} onChangeText={setEditFullName} />

            <Text style={styles.modalFieldLabel}>Job Title</Text>
            <TextInput style={styles.modalInput} value={editJobTitle} onChangeText={setEditJobTitle} />

            <Text style={styles.modalFieldLabel}>Company</Text>
            {isCompanyNameEditable ? (
              <TextInput style={styles.modalInput} value={editCompanyName} onChangeText={setEditCompanyName} />
            ) : (
              <View style={styles.modalReadOnly}>
                <Text style={styles.modalReadOnlyText}>{editCompanyDisplay || 'Unknown Company'}</Text>
              </View>
            )}

            <Text style={styles.modalFieldLabel}>Priority Score</Text>
            <TextInput
              style={styles.modalInput}
              value={editPriorityScore}
              onChangeText={(value) => {
                setEditPriorityScore(value);
                const parsed = Number.parseInt(value.trim(), 10);
                if (Number.isFinite(parsed)) {
                  setEditRating(starsFromPriorityScore(Math.max(0, Math.min(100, parsed))));
                }
              }}
              keyboardType="number-pad"
            />
            <View style={styles.modalRatingRow}>
              <StarRating
                value={editRating}
                size={22}
                onChange={(value) => {
                  setEditRating(value);
                  setEditPriorityScore(String(priorityScoreFromStars(value)));
                }}
              />
            </View>

            <Text style={styles.modalFieldLabel}>Hot Lead</Text>
            <Pressable style={styles.hotToggleRow} onPress={() => setEditIsHot((prev) => !prev)}>
              <Text style={styles.hotToggleText}>{editIsHot ? 'On' : 'Off'}</Text>
              <View style={[styles.hotToggleSwitch, editIsHot && styles.hotToggleSwitchOn]}>
                <View style={[styles.hotToggleKnob, editIsHot && styles.hotToggleKnobOn]} />
              </View>
            </Pressable>

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
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -0.9,
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
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    marginTop: 4,
    color: '#475569',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 16,
  },
  leadCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
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
  cardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  editButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f8fafc',
  },
  editButtonText: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  nameText: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  badge: {
    borderRadius: 16,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hotBadge: {
    backgroundColor: '#ff234f',
  },
  followUpBadge: {
    backgroundColor: '#ff5a00',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  titleText: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    color: '#1f2937',
  },
  company: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 21,
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
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0f172a',
  },
  scoreLabel: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    color: '#64748b',
    fontWeight: '700',
  },
  followUpPill: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followUpText: {
    fontSize: 14,
    lineHeight: 18,
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
  hotToggleRow: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hotToggleText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  hotToggleSwitch: {
    width: 42,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  hotToggleSwitchOn: {
    backgroundColor: '#4f46e5',
  },
  hotToggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  hotToggleKnobOn: {
    alignSelf: 'flex-end',
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
