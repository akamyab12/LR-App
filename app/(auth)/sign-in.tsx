import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ScreenContainer from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      Alert.alert('Sign In', 'Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Sign In Failed', error.message ?? 'Please try again.');
      return;
    }

    router.dismissAll();
    router.replace('/(tabs)' as never);
  };

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Use your account to continue.</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={handleSignIn}>
          <Text style={styles.buttonText}>{isSubmitting ? 'Signing In...' : 'Sign In'}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    gap: 18,
  },
  headerBlock: {
    gap: 6,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    color: '#0f172a',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#475569',
    fontWeight: '500',
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    paddingHorizontal: 12,
    fontSize: 16,
  },
  button: {
    marginTop: 8,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
});
