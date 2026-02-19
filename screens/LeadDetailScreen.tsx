import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import FollowUpDatePicker from '@/components/FollowUpDatePicker';
import SectionTitle from '@/components/ui/SectionTitle';
import {
  LEADS_SELECT_COLUMNS,
  getLeadAudioUri,
  hasLeadQueryScope,
  isLeadHot,
  priorityScoreFromStars,
  starsFromPriorityScore,
  supportsMarkHot,
} from '@/lib/api';
import { useCompany } from '@/lib/company-context';
import { supabase } from '@/lib/supabase';
import type { LeadTag } from '@/lib/types';

type DbLeadDetailRow = {
  id?: string | number;
  name?: string | null;
  full_name?: string | null;
  title?: string | null;
  job_title?: string | null;
  role?: string | null;
  company?: string | null;
  company_name?: string | null;
  company_id?: string | number | null;
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
  qr_value?: string | null;
  raw_payload?: string | null;
  event_id?: string | number | null;
  created_at?: string | null;
  status?: string | null;
  score?: number | null;
  audio_uri?: string | null;
  [key: string]: unknown;
};

type LeadAutoSavePatch = {
  full_name: string | null;
  job_title: string | null;
  priority_score: number;
  is_hot: boolean;
  quick_tags: LeadTag[];
  follow_up_date: string | null;
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

const DEFAULT_AI_INSIGHTS = {
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
    return [];
  }

  const tags = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(isLeadTag);

  return tags;
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

function toIsoDateString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateToIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toIsoDateString(parsed);
}

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildLeadPatch(input: {
  fullName: string;
  jobTitle: string;
  priorityStars: number;
  isHot: boolean;
  quickTags: LeadTag[];
  followUpDate: string | null;
}): LeadAutoSavePatch {
  return {
    full_name: normalizeText(input.fullName),
    job_title: normalizeText(input.jobTitle),
    priority_score: priorityScoreFromStars(input.priorityStars),
    is_hot: input.isHot,
    quick_tags: input.quickTags,
    follow_up_date: input.followUpDate,
  };
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

function getPriorityScoreFromRow(row: DbLeadDetailRow | null): number | null {
  if (!row) {
    return null;
  }

  if (typeof row.priority_score === 'number' && Number.isFinite(row.priority_score)) {
    return row.priority_score;
  }

  if (typeof row.priority === 'number' && Number.isFinite(row.priority)) {
    return row.priority;
  }

  if (typeof row.score === 'number' && Number.isFinite(row.score)) {
    return row.score;
  }

  return null;
}

type LeadDetailScreenProps = {
  routeLeadId?: string | null;
  routeSource?: 'leads' | 'capture';
};

function goToLeads(navigation: NavigationProp<ParamListBase>) {
  const navigateIfPresent = (nav: NavigationProp<ParamListBase>, routeName: 'Leads' | 'leads') => {
    const state = nav.getState();
    if (state.routeNames.includes(routeName)) {
      nav.navigate(routeName);
      return true;
    }
    return false;
  };

  const parentNavigation = navigation.getParent();
  if (parentNavigation) {
    if (navigateIfPresent(parentNavigation, 'Leads')) {
      return;
    }
    if (navigateIfPresent(parentNavigation, 'leads')) {
      return;
    }
  }

  if (navigateIfPresent(navigation, 'Leads')) {
    return;
  }
  if (navigateIfPresent(navigation, 'leads')) {
    return;
  }

  if (parentNavigation) {
    parentNavigation.navigate('Leads');
    return;
  }

  navigation.navigate('Leads');
}

export default function LeadDetailScreen({
  routeLeadId = null,
}: LeadDetailScreenProps) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { activeCompanyId, isReady, role } = useCompany();
  const leadId = useMemo(() => routeLeadId ?? null, [routeLeadId]);

  const [lead, setLead] = useState<DbLeadDetailRow | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [eventName, setEventName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingJobTitle, setIsEditingJobTitle] = useState(false);
  const [fullNameDraft, setFullNameDraft] = useState('');
  const [jobTitleDraft, setJobTitleDraft] = useState('');
  const [selectedTags, setSelectedTags] = useState<LeadTag[]>([]);
  const [priorityStars, setPriorityStars] = useState(0);
  const [isHotDraft, setIsHotDraft] = useState(false);
  const [followUpDateDraft, setFollowUpDateDraft] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorText, setSaveErrorText] = useState<string | null>(null);
  const audioUri = useMemo(() => getLeadAudioUri(lead), [lead]);
  const leadIsHot = useMemo(() => isLeadHot(lead), [lead]);
  const canMarkHot = useMemo(() => supportsMarkHot(lead), [lead]);
  const availableQuickTags = useMemo(() => ALL_TAGS, []);
  const buyingSignals = useMemo(
    () => normalizeInsightList(lead?.buying_signals, DEFAULT_AI_INSIGHTS.buyingSignals),
    [lead?.buying_signals]
  );
  const keyNeeds = useMemo(
    () => normalizeInsightList(lead?.key_needs, DEFAULT_AI_INSIGHTS.keyNeeds),
    [lead?.key_needs]
  );
  const nextBestAction = useMemo(
    () =>
      (typeof lead?.next_best_action === 'string' && lead.next_best_action.trim()) ||
      DEFAULT_AI_INSIGHTS.nextBestAction,
    [lead?.next_best_action]
  );
  const basePriorityScore = useMemo(() => getPriorityScoreFromRow(lead), [lead]);
  const autoSavePatch = useMemo(
    () =>
      buildLeadPatch({
        fullName: fullNameDraft,
        jobTitle: jobTitleDraft,
        priorityStars,
        isHot: isHotDraft,
        quickTags: selectedTags,
        followUpDate: followUpDateDraft,
      }),
    [followUpDateDraft, fullNameDraft, isHotDraft, jobTitleDraft, priorityStars, selectedTags]
  );
  const saveIndicatorText = useMemo(() => {
    if (saveState === 'saving') {
      return 'Saving…';
    }
    if (saveState === 'saved') {
      return 'Saved';
    }
    if (saveState === 'error') {
      return saveErrorText || 'Save failed';
    }
    return null;
  }, [saveErrorText, saveState]);

  const goToLeadsTab = useCallback(() => {
    goToLeads(navigation);
  }, [navigation]);

  const applyLeadToState = useCallback((row: DbLeadDetailRow | null) => {
    setLead(row);
    const rowCompanyName =
      (typeof row?.company_name === 'string' && row.company_name.trim()) ||
      (typeof row?.company === 'string' && row.company.trim()) ||
      '';
    setCompanyName(rowCompanyName);
    const initialTags = normalizeQuickTags(row?.quick_tags);
    const priorityScore = getPriorityScoreFromRow(row);
    const initialStars =
      typeof row?.stars === 'number' && Number.isFinite(row.stars) && row.stars > 0
        ? clamp(Math.round(row.stars), 0, 5)
        : starsFromPriorityScore(priorityScore ?? 0);
    const initialFollowUpDate = normalizeDateToIso(row?.follow_up_date);
    const initialFullName = (typeof row?.full_name === 'string' && row.full_name.trim()) || '';
    const initialJobTitle = (typeof row?.job_title === 'string' && row.job_title.trim()) || '';
    const initialIsHot = row?.is_hot === true;

    setFullNameDraft(initialFullName);
    setJobTitleDraft(initialJobTitle);
    setIsEditingName(false);
    setIsEditingJobTitle(false);

    setSelectedTags(initialTags);
    setPriorityStars(initialStars);
    setIsHotDraft(initialIsHot);
    setFollowUpDateDraft(initialFollowUpDate);
    setIsDirty(false);
    setSaveState('idle');
    setSaveErrorText(null);
    setEventName('');
  }, []);

  const fetchLeadDetail = useCallback(async (id: string): Promise<DbLeadDetailRow> => {
    const { data, error } = await supabase
      .from('leads')
      .select(LEADS_SELECT_COLUMNS)
      .eq('id', id)
      .single<DbLeadDetailRow>();

    if (error || !data) {
      throw new Error(error?.message ?? 'Unable to load lead.');
    }

    return data;
  }, []);

  useEffect(() => {
    console.log('LEAD_DETAIL_PARAM', { id: leadId ?? null });
    if (!isReady) {
      setIsLoading(true);
      return;
    }

    if (!leadId) {
      setLead(null);
      setCompanyName('');
      setEventName('');
      setFetchError('Missing lead id');
      setFullNameDraft('');
      setJobTitleDraft('');
      setSelectedTags([]);
      setPriorityStars(0);
      setIsHotDraft(false);
      setFollowUpDateDraft(null);
      setIsDirty(false);
      setSaveState('idle');
      setSaveErrorText(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setFetchError(null);

    const loadLead = async () => {
      try {
        const row = await fetchLeadDetail(leadId);
        if (!isActive) {
          return;
        }

        console.log('LEAD_DETAIL_FETCH_OK', { id: leadId, hasData: true });
        applyLeadToState(row);

        const eventId = normalizeEntityId(row.event_id);
        if (eventId) {
          const { data: eventRow } = await supabase
            .from('events')
            .select('name, title, event_name')
            .eq('id', eventId)
            .maybeSingle<{ name?: string | null; title?: string | null; event_name?: string | null }>();
          if (!isActive) {
            return;
          }

          const resolvedEventName =
            (typeof eventRow?.name === 'string' && eventRow.name.trim()) ||
            (typeof eventRow?.title === 'string' && eventRow.title.trim()) ||
            (typeof eventRow?.event_name === 'string' && eventRow.event_name.trim()) ||
            '';
          setEventName(resolvedEventName);
        } else {
          setEventName('');
        }

        const existingCompanyName =
          (typeof row.company_name === 'string' && row.company_name.trim()) ||
          (typeof row.company === 'string' && row.company.trim()) ||
          '';
        if (existingCompanyName) {
          setCompanyName(existingCompanyName);
        } else {
          const companyId = normalizeEntityId(row.company_id);
          if (companyId) {
            const { data: companyRow } = await supabase
              .from('companies')
              .select('name, title')
              .eq('id', companyId)
              .maybeSingle<{ name?: string | null; title?: string | null }>();
            if (!isActive) {
              return;
            }
            const resolvedCompanyName =
              (typeof companyRow?.name === 'string' && companyRow.name.trim()) ||
              (typeof companyRow?.title === 'string' && companyRow.title.trim()) ||
              '';
            setCompanyName(resolvedCompanyName);
          } else {
            setCompanyName('');
          }
        }

        setIsLoading(false);
      } catch (error) {
        if (!isActive) {
          return;
        }
        console.log('LEAD_DETAIL_FETCH_ERR', {
          id: leadId,
          message: error instanceof Error ? error.message : 'Unknown error',
          code: null,
        });
        setLead(null);
        setCompanyName('');
        setEventName('');
        setFetchError(error instanceof Error ? error.message : 'Unable to load lead.');
        setSelectedTags([]);
        setPriorityStars(0);
        setIsHotDraft(false);
        setFollowUpDateDraft(null);
        setFullNameDraft('');
        setJobTitleDraft('');
        setIsDirty(false);
        setSaveState('idle');
        setSaveErrorText(null);
        setIsLoading(false);
      }
    };

    loadLead().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [applyLeadToState, fetchLeadDetail, isReady, leadId]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    goToLeadsTab();
  }, [goToLeadsTab, navigation]);

  const handleMarkHot = () => {
    if (!canMarkHot) {
      return;
    }

    setIsHotDraft((prev) => !prev);
    if (priorityStars < 4) {
      setPriorityStars(4);
    }
    setIsDirty(true);
    setSaveState('idle');
    setSaveErrorText(null);
  };

  const handleSave = useCallback(async () => {
    if (!leadId || !isDirty || saveState === 'saving') {
      return;
    }

    const scope = { role, activeCompanyId };
    if (!hasLeadQueryScope(scope)) {
      setSaveState('error');
      setSaveErrorText('Missing company scope');
      return;
    }

    setSaveState('saving');
    setSaveErrorText(null);

    const { error } = await supabase
      .from('leads')
      .update(autoSavePatch)
      .eq('id', leadId)
      .select('id')
      .single();

    if (error) {
      setSaveState('error');
      setSaveErrorText(error.message ?? 'Save failed');
      return;
    }

    setLead((prev) => (prev ? { ...prev, ...autoSavePatch } : prev));
    setIsDirty(false);
    setSaveState('saved');
    setSaveErrorText(null);

    setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      goToLeadsTab();
    }, 150);
  }, [activeCompanyId, autoSavePatch, goToLeadsTab, isDirty, leadId, navigation, role, saveState]);

  const cyclePriorityFromScore = () => {
    setPriorityStars((prev) => {
      const next = prev + 1;
      return next > 5 ? 1 : next;
    });
    setIsDirty(true);
  };

  const persistQuickTags = useCallback(
    async (nextTags: LeadTag[]) => {
      if (!leadId || saveState === 'saving') {
        return;
      }

      const scope = { role, activeCompanyId };
      if (!hasLeadQueryScope(scope)) {
        setSaveState('error');
        setSaveErrorText('Missing company scope');
        return;
      }

      setSaveState('saving');
      setSaveErrorText(null);

      const { error } = await supabase
        .from('leads')
        .update({ quick_tags: nextTags })
        .eq('id', leadId)
        .select('id')
        .single();

      if (error) {
        setSaveState('error');
        setSaveErrorText(error.message ?? 'Quick tags save failed');
        return;
      }

      setLead((prev) => (prev ? { ...prev, quick_tags: nextTags } : prev));
      setSaveState('saved');
      setSaveErrorText(null);
    },
    [activeCompanyId, leadId, role, saveState]
  );

  const toggleTag = (tag: LeadTag) => {
    setSaveState('idle');
    setSaveErrorText(null);
    setSelectedTags((prev) => {
      const nextTags = prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag];
      persistQuickTags(nextTags).catch(() => undefined);
      return nextTags;
    });
  };

  const renderInsightRows = (items: string[]) => {
    return (
      <View style={styles.insightList}>
        {items.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.insightRow}>
            <Text style={styles.insightItemText}>• {item}</Text>
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
        <AppHeader onBack={handleBack} />
        <View style={styles.stateWrap}>
          <Text style={styles.notFoundTitle}>{leadId ? 'Lead not found' : 'Missing lead id'}</Text>
          {fetchError ? <Text style={styles.fetchErrorText}>{fetchError}</Text> : null}
          <Pressable style={styles.backFallbackButton} onPress={handleBack}>
            <Text style={styles.backFallbackText}>Back to Leads</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}>
        <AppHeader
          onBack={handleBack}
          rightSlot={
            <Pressable
              style={[
                styles.headerSaveButton,
                (!isDirty || saveState === 'saving') && styles.headerSaveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!isDirty || saveState === 'saving'}>
              <Text style={styles.headerSaveText}>{saveState === 'saving' ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          }
        />
        {saveIndicatorText ? (
          <Text style={[styles.saveIndicator, saveState === 'error' && styles.saveIndicatorError]}>
            {saveIndicatorText}
          </Text>
        ) : null}

        <View style={styles.nameRow}>
          {isEditingName ? (
            <TextInput
              value={fullNameDraft}
              onChangeText={(value) => {
                setFullNameDraft(value);
                setIsDirty(true);
                setSaveState('idle');
                setSaveErrorText(null);
              }}
              style={styles.nameInput}
              placeholder="Lead name"
              placeholderTextColor="#94a3b8"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => setIsEditingName(false)}
              onBlur={() => setIsEditingName(false)}
            />
          ) : (
            <Pressable onPress={() => setIsEditingName(true)} style={styles.editablePress}>
              <Text style={styles.name}>{fullNameDraft.trim() || '—'}</Text>
            </Pressable>
          )}
          {isHotDraft || leadIsHot ? (
            <View style={styles.hotPill}>
              <Text style={styles.hotPillText}>HOT LEAD</Text>
            </View>
          ) : null}
        </View>

        {isEditingJobTitle ? (
          <TextInput
            value={jobTitleDraft}
            onChangeText={(value) => {
              setJobTitleDraft(value);
              setIsDirty(true);
              setSaveState('idle');
              setSaveErrorText(null);
            }}
            style={styles.titleInput}
            placeholder="Job title"
            placeholderTextColor="#94a3b8"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => setIsEditingJobTitle(false)}
            onBlur={() => setIsEditingJobTitle(false)}
          />
        ) : (
          <Pressable onPress={() => setIsEditingJobTitle(true)} style={styles.editablePress}>
            <Text style={styles.title}>{jobTitleDraft.trim() || 'No title'}</Text>
          </Pressable>
        )}
        <Text style={styles.company}>
          {companyName || 'Not set'}
        </Text>

        <View style={styles.starRow}>
          <Text style={styles.priorityEditorLabel}>Priority</Text>
          <View style={styles.priorityEditorStarsRow}>
            {Array.from({ length: 5 }).map((_, index) => {
              const starNumber = index + 1;
              const isActiveStar = starNumber <= priorityStars;
              return (
                <Pressable
                  key={starNumber}
                  style={[styles.priorityStarButton, isActiveStar && styles.priorityStarButtonActive]}
                  onPress={() => {
                    setPriorityStars(starNumber);
                    setIsDirty(true);
                    setSaveState('idle');
                    setSaveErrorText(null);
                  }}>
                  <Ionicons
                    name={isActiveStar ? 'star' : 'star-outline'}
                    size={22}
                    color={isActiveStar ? '#4f46e5' : '#cbd5e1'}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.priorityEditorHint}>
            {priorityStars > 0 ? `${priorityScoreFromStars(priorityStars)} priority score` : 'Tap stars to set priority'}
          </Text>
        </View>

        <SectionTitle title="Quick Tags" titleStyle={styles.sectionTitle} style={styles.sectionSpacing} />
        <View style={styles.tagWrap}>
          {availableQuickTags.map((tag) => {
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
        <FollowUpDatePicker
          value={followUpDateDraft}
          onPress={() => console.log('FollowUpDatePicker pressed', leadId)}
          onChange={(nextIsoDate) => {
            setFollowUpDateDraft(nextIsoDate);
            setIsDirty(true);
            setSaveState('idle');
            setSaveErrorText(null);
          }}
        />

        <SectionTitle title="Conversation" titleStyle={styles.sectionTitle} style={styles.sectionSpacing} />
        <Card style={styles.conversationCard}>
          <View style={styles.bigMicButton}>
            <Ionicons name="mic-outline" size={32} color="#ffffff" />
          </View>
          <Text style={styles.conversationHint}>No conversation captured yet.</Text>
          <Text style={styles.audioHint} numberOfLines={1}>
            {audioUri ? `Audio: ${audioUri}` : 'Audio: not attached'}
          </Text>
        </Card>
        {role !== 'exhibitor' ? (
          <SectionTitle title="Event" titleStyle={styles.sectionTitle} style={styles.sectionSpacing} />
        ) : null}
        {role !== 'exhibitor' ? (
          <Card style={styles.captureMetaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Event</Text>
              <Text style={styles.metaValue}>{eventName || 'Not set'}</Text>
            </View>
          </Card>
        ) : null}

        {canMarkHot && !isHotDraft ? (
          <Pressable style={styles.markHotButton} onPress={handleMarkHot}>
            <Ionicons name="flame-outline" size={18} color="#ffffff" />
            <Text style={styles.markHotButtonText}>Mark Hot</Text>
          </Pressable>
        ) : isHotDraft || leadIsHot ? (
          <View style={styles.hotStatusPill}>
            <Ionicons name="flame" size={16} color="#ffffff" />
            <Text style={styles.hotStatusText}>Marked as Hot</Text>
          </View>
        ) : null}

        <View style={styles.aiCard}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiIconSquare}>
              <Ionicons name="flash-outline" size={18} color="#ffffff" />
            </View>
            <Text style={styles.aiTitle}>AI Insights</Text>
          </View>

          <Text style={styles.aiSectionTitle}>Buying Signals</Text>
          {renderInsightRows(buyingSignals)}

          <Text style={[styles.aiSectionTitle, styles.aiSectionSpacing]}>Key Needs</Text>
          {renderInsightRows(keyNeeds)}

          <Text style={styles.aiSectionTitle}>Recommended Approach</Text>
          <View style={styles.recommendationBox}>
            <Text style={styles.recommendationText}>{nextBestAction}</Text>
          </View>

          <View style={styles.priorityScoreBox}>
            <Text
              style={styles.priorityLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}>
              Priority Score
            </Text>
            <Pressable style={styles.priorityValueRow} onPress={cyclePriorityFromScore}>
              <Text
                style={styles.priorityValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}>
                {priorityStars > 0
                  ? priorityScoreFromStars(priorityStars)
                  : (basePriorityScore ?? 'Not set')}
              </Text>
              <Text
                style={styles.priorityOutOf}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}>
                /100
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 6,
    paddingBottom: 20,
  },
  headerSaveButton: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveButtonDisabled: {
    opacity: 0.4,
  },
  headerSaveText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  saveIndicator: {
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveIndicatorError: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
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
  fetchErrorText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '600',
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
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  editablePress: {
    flex: 1,
  },
  name: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  nameInput: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    paddingVertical: 0,
  },
  hotPill: {
    marginTop: 2,
    borderRadius: 18,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  hotPillText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 26,
    color: '#1f2937',
    fontWeight: '700',
  },
  titleInput: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 26,
    color: '#1f2937',
    fontWeight: '700',
    paddingVertical: 0,
  },
  company: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 22,
    color: '#64748b',
    fontWeight: '600',
  },
  captureMetaCard: {
    marginTop: 10,
    gap: 6,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    shadowOpacity: 0,
    elevation: 0,
  },
  metaRow: {
    gap: 6,
  },
  metaRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#c7d2fe',
    paddingTop: 10,
    marginTop: 2,
  },
  metaLabel: {
    color: '#4338ca',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    color: '#1e293b',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  starRow: {
    marginTop: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  priorityEditorLabel: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  priorityEditorStarsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityStarButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityStarButtonActive: {
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
  },
  priorityEditorHint: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  sectionSpacing: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  tagTextSelected: {
    color: '#ffffff',
  },
  tagTextMuted: {
    color: '#4b5563',
  },
  conversationCard: {
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    alignItems: 'center',
    paddingVertical: 22,
    shadowOpacity: 0,
    elevation: 0,
  },
  bigMicButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
  },
  conversationHint: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 14,
  },
  audioHint: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  notesInput: {
    marginTop: 10,
    minHeight: 84,
    width: '100%',
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#1f2937',
    textAlignVertical: 'top',
  },
  markHotButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  markHotButtonText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  hotStatusPill: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hotStatusText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  aiCard: {
    marginTop: 20,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#10153c',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  aiSectionTitle: {
    marginTop: 16,
    fontSize: 17,
    lineHeight: 22,
    color: '#e2e8f0',
    fontWeight: '700',
  },
  aiSectionSpacing: {
    marginTop: 16,
  },
  insightList: {
    marginTop: 8,
    gap: 10,
  },
  insightRow: {
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.26)',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  insightItemText: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  priorityScoreBox: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.22)',
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  priorityLabel: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 24,
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
    fontSize: 52,
    lineHeight: 52,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
    minWidth: 0,
  },
  priorityOutOf: {
    color: '#cbd5e1',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
    marginLeft: 4,
    flexShrink: 1,
    minWidth: 0,
  },
});
