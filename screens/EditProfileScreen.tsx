import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import ScreenContainer from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabase';

type DbUserRow = {
  id?: string | null;
  full_name?: string | null;
  role?: string | null;
  company_id?: string | null;
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

export default function EditProfileScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const roleLabel = useMemo(() => formatRoleLabel(role), [role]);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      setIsLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUserId = typeof session?.user?.id === 'string' ? session.user.id : null;
      const sessionEmail = typeof session?.user?.email === 'string' ? session.user.email : '';

      if (!isActive) {
        return;
      }

      setEmail(sessionEmail);

      if (!sessionUserId) {
        router.dismissAll();
        router.replace('/(auth)/sign-in' as never);
        return;
      }

      const { data: userRow, error } = await supabase
        .from('users')
        .select('id, full_name, role, company_id')
        .eq('id', sessionUserId)
        .maybeSingle<DbUserRow>();

      if (!isActive) {
        return;
      }

      if (error) {
        Alert.alert('Profile Error', error.message ?? 'Unable to load profile.');
      }

      setUserId(sessionUserId);
      setFullName(
        typeof userRow?.full_name === 'string' && userRow.full_name.trim().length > 0 ? userRow.full_name : ''
      );
      setRole(typeof userRow?.role === 'string' ? userRow.role : null);
      setCompanyId(typeof userRow?.company_id === 'string' ? userRow.company_id : null);
      setIsLoading(false);
    };

    loadProfile().catch((error) => {
      if (isActive) {
        Alert.alert('Profile Error', error instanceof Error ? error.message : 'Unable to load profile.');
        setIsLoading(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleSave = async () => {
    if (!userId || isSaving) {
      return;
    }

    const nextFullName = fullName.trim();
    if (!nextFullName) {
      Alert.alert('Validation', 'Full name is required.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ full_name: nextFullName })
      .eq('id', userId)
      .select('id')
      .single();
    setIsSaving(false);

    if (error) {
      Alert.alert('Save Failed', error.message ?? 'Unable to update profile.');
      return;
    }

    router.back();
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.content}>
      <AppHeader onBack={() => router.back()} />
      <Text style={styles.pageTitle}>Edit Profile</Text>

      <Card style={styles.card}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#4f46e5" />
          </View>
        ) : (
          <>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter full name"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyText}>{email || 'Not available'}</Text>
            </View>

            {roleLabel.length > 0 ? (
              <>
                <Text style={styles.label}>Role</Text>
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyText}>{roleLabel}</Text>
                </View>
              </>
            ) : null}

            {companyId ? (
              <>
                <Text style={styles.label}>Company ID</Text>
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyText}>{companyId}</Text>
                </View>
              </>
            ) : null}
          </>
        )}
      </Card>

      <Pressable
        style={[styles.saveButton, (isSaving || isLoading) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving || isLoading}>
        <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Profile'}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
  },
  pageTitle: {
    fontSize: 40,
    lineHeight: 44,
    color: '#0f172a',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  card: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0,
    gap: 8,
  },
  loadingWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 6,
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  input: {
    marginTop: 4,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  readOnlyRow: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  readOnlyText: {
    color: '#1e293b',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 8,
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
  },
  saveButtonDisabled: {
    opacity: 0.72,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
  },
});
