import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { CompanyProvider } from '@/lib/company-context';

export default function RootLayout() {
  return (
    <CompanyProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="dark" />
    </CompanyProvider>
  );
}
