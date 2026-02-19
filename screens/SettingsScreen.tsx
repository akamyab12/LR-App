import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import Card from '@/components/ui/Card';
import RowButton from '@/components/ui/RowButton';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import {
  fetchActiveEventByCompanyId,
  LEADS_SELECT_COLUMNS,
  getEventDateRangeLabel,
  getEventId,
  getEventLocationLabel,
  getEventName,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';

type DbUserRow = {
  full_name?: string | null;
  role?: string | null;
  company_id?: string | null;
};

type DbCompanyRow = {
  name?: string | null;
};

type DbLeadStatRow = {
  status?: string | null;
  is_hot?: boolean | null;
  priority_score?: number | null;
  priority?: number | null;
  score?: number | null;
};

function formatRoleLabel(role: string | null): string {
  if (!role) {
    return '';
  }

  return role
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function humanizeEmailName(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local
    .replace(/[^\w.-]/g, '')
    .split(/[._-]+/)
    .filter((item) => item.length > 0)
    .slice(0, 3);

  if (parts.length === 0) {
    return '';
  }

  return parts.map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((segment) => segment.length > 0);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function isHotLead(lead: DbLeadStatRow): boolean {
  if (lead.is_hot === true) {
    return true;
  }
  const scoreCandidate =
    typeof lead.priority_score === 'number' && Number.isFinite(lead.priority_score)
      ? lead.priority_score
      : typeof lead.score === 'number' && Number.isFinite(lead.score)
        ? lead.score
        : typeof lead.priority === 'number' && Number.isFinite(lead.priority)
          ? lead.priority
          : null;

  return scoreCandidate !== null && scoreCandidate >= 80;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [activeEventName, setActiveEventName] = useState('');
  const [activeEventDateLabel, setActiveEventDateLabel] = useState('');
  const [activeEventLocation, setActiveEventLocation] = useState('');
  const [totalLeads, setTotalLeads] = useState(0);
  const [hotLeads, setHotLeads] = useState(0);

  const resetToAuthStack = useCallback(() => {
    router.dismissAll();
    router.replace('/(auth)/sign-in' as never);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSettings = async () => {
        try {
          setIsLoading(true);

          const {
            data: { session },
          } = await supabase.auth.getSession();

          const sessionUser = session?.user ?? null;
          const userId = typeof sessionUser?.id === 'string' ? sessionUser.id : null;
          const sessionEmail = typeof sessionUser?.email === 'string' ? sessionUser.email : '';

          if (!isActive) {
            return;
          }

          setEmail(sessionEmail);

          if (!userId) {
            setDisplayName('');
            setRole(null);
            setCompanyId(null);
            setCompanyName('');
            setActiveEventName('');
            setActiveEventDateLabel('');
            setActiveEventLocation('');
            setTotalLeads(0);
            setHotLeads(0);
            setIsLoading(false);
            resetToAuthStack();
            return;
          }

          const { data: userRow, error: userError } = await supabase
            .from('users')
            .select('full_name, role, company_id')
            .eq('id', userId)
            .maybeSingle<DbUserRow>();

          if (!isActive) {
            return;
          }

          if (userError) {
            Alert.alert('Settings Error', userError.message ?? 'Unable to load profile.');
          }

          const resolvedName =
            typeof userRow?.full_name === 'string' && userRow.full_name.trim().length > 0
              ? userRow.full_name.trim()
              : sessionEmail.length > 0
                ? humanizeEmailName(sessionEmail)
                : userId;
          const resolvedRole = typeof userRow?.role === 'string' ? userRow.role : null;
          const resolvedCompanyId =
            typeof userRow?.company_id === 'string' && userRow.company_id.trim().length > 0
              ? userRow.company_id
              : null;

          setDisplayName(resolvedName);
          setRole(resolvedRole);
          setCompanyId(resolvedCompanyId);

          if (!resolvedCompanyId) {
            setCompanyName('');
            setActiveEventName('');
            setActiveEventDateLabel('');
            setActiveEventLocation('');
            setTotalLeads(0);
            setHotLeads(0);
            setIsLoading(false);
            return;
          }

          const { data: companyRow, error: companyError } = await supabase
            .from('companies')
            .select('name')
            .eq('id', resolvedCompanyId)
            .maybeSingle<DbCompanyRow>();

          if (!isActive) {
            return;
          }

          if (companyError) {
            Alert.alert('Settings Error', companyError.message ?? 'Unable to load company.');
          }

          const resolvedCompanyName =
            typeof companyRow?.name === 'string' && companyRow.name.trim().length > 0
              ? companyRow.name.trim()
              : resolvedCompanyId;
          setCompanyName(resolvedCompanyName);

          const { data: activeEventRow, error: activeEventError } = await fetchActiveEventByCompanyId(
            resolvedCompanyId
          );

          if (!isActive) {
            return;
          }

          if (activeEventError) {
            Alert.alert('Settings Error', activeEventError.message ?? 'Unable to load active event.');
          }

          const eventName = getEventName(activeEventRow);
          const eventDateLabel = getEventDateRangeLabel(activeEventRow);
          const eventLocation = getEventLocationLabel(activeEventRow);
          const eventId = getEventId(activeEventRow);

          setActiveEventName(eventName);
          setActiveEventDateLabel(eventDateLabel);
          setActiveEventLocation(eventLocation);

          if (!eventId) {
            setTotalLeads(0);
            setHotLeads(0);
            setIsLoading(false);
            return;
          }

          const { data: leadRows, error: leadsError } = await supabase
            .from('leads')
            .select(LEADS_SELECT_COLUMNS)
            .eq('event_id', eventId)
            .order('id', { ascending: false });

          if (!isActive) {
            return;
          }

          if (leadsError) {
            Alert.alert('Settings Error', leadsError.message ?? 'Unable to load company stats.');
          }

          const safeLeads = Array.isArray(leadRows) ? (leadRows as DbLeadStatRow[]) : [];
          setTotalLeads(safeLeads.length);
          setHotLeads(safeLeads.filter((lead) => isHotLead(lead)).length);
          setIsLoading(false);
        } catch (error) {
          if (isActive) {
            Alert.alert('Settings Error', error instanceof Error ? error.message : 'Something went wrong.');
            setIsLoading(false);
          }
        }
      };

      loadSettings().catch(() => undefined);

      return () => {
        isActive = false;
      };
    }, [resetToAuthStack])
  );

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    if (error) {
      Alert.alert('Sign Out Failed', error.message ?? 'Please try again.');
      return;
    }

    resetToAuthStack();
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>
      <View style={styles.divider} />

      <View style={styles.section}>
        <SectionTitle title="Account" titleStyle={styles.sectionTitleText} />

        <Card style={styles.userCard}>
          <View style={styles.initialsCircle}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
          <View style={styles.userInfoCol}>
            {isLoading ? <ActivityIndicator size="small" color="#4f46e5" /> : null}
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.email}>{email}</Text>
            <View style={styles.metaPillsRow}>
              {formatRoleLabel(role).length > 0 ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{formatRoleLabel(role)}</Text>
                </View>
              ) : null}
              {companyName.length > 0 ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{companyName}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        <RowButton
          icon="person-outline"
          label="Edit Profile"
          style={styles.rowButton}
          onPress={() => router.push('/edit-profile' as never)}
        />
        <RowButton
          icon="log-out-outline"
          label={isSigningOut ? 'Signing Out...' : 'Sign Out'}
          style={styles.rowButton}
          onPress={handleSignOut}
        />
      </View>

      <View style={styles.section}>
        <SectionTitle title="Current Event" titleStyle={styles.sectionTitleText} />

        <View style={styles.eventCard}>
          <View style={styles.eventGlowTop} />
          <View style={styles.eventGlowBottom} />

          <View style={styles.eventHeaderRow}>
            <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            <Text style={styles.eventTitle}>{activeEventName || 'No active event'}</Text>
          </View>
          <Text style={styles.eventDate}>
            {activeEventDateLabel || (companyId ? 'Ask admin to set one active event.' : '')}
          </Text>
          {activeEventLocation ? <Text style={styles.eventLocation}>{activeEventLocation}</Text> : null}

          <View style={styles.eventStatsRow}>
            <View style={styles.eventStatCol}>
              <Text style={styles.eventStatValue}>{totalLeads}</Text>
              <Text style={styles.eventStatLabel}>Leads</Text>
            </View>
            <View style={styles.eventStatCol}>
              <Text style={styles.eventStatValue}>{hotLeads}</Text>
              <Text style={styles.eventStatLabel}>Hot</Text>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 10,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 44,
    lineHeight: 48,
    color: '#0f172a',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  section: {
    marginTop: 18,
    gap: 10,
  },
  sectionTitleText: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    color: '#111827',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0,
  },
  initialsCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '800',
  },
  userInfoCol: {
    flex: 1,
  },
  userName: {
    color: '#111827',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
  },
  email: {
    marginTop: 2,
    color: '#475569',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  },
  metaPillsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaPillText: {
    color: '#4338ca',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  rowButton: {
    marginTop: 2,
  },
  eventCard: {
    marginTop: 2,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
    backgroundColor: '#4f46e5',
  },
  eventGlowTop: {
    position: 'absolute',
    top: -70,
    right: -42,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
  },
  eventGlowBottom: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(67, 56, 202, 0.45)',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  eventDate: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '600',
  },
  eventLocation: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
  },
  eventStatsRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventStatCol: {
    flex: 1,
    minWidth: 68,
  },
  eventStatValue: {
    color: '#ffffff',
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '800',
  },
  eventStatLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '700',
  },
});
