import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_BG = '#4f46e5';
const ACTIVE_LABEL = '#111827';
const INACTIVE_LABEL = '#9ca3af';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_LABEL,
        tabBarInactiveTintColor: INACTIVE_LABEL,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [styles.tabBar, { height: 82 + insets.bottom, paddingBottom: insets.bottom + 12 }],
        tabBarIcon: ({ color, focused }) => {
          const iconMap: Record<string, { active: IoniconName; inactive: IoniconName }> = {
            index: { active: 'scan', inactive: 'scan-outline' },
            leads: { active: 'people', inactive: 'people-outline' },
            priority: { active: 'flash', inactive: 'flash-outline' },
            settings: { active: 'settings', inactive: 'settings-outline' },
          };

          const icon = iconMap[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? icon.active : icon.inactive}
                size={22}
                color={focused ? '#ffffff' : color}
              />
            </View>
          );
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Capture' }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads' }} />
      <Tabs.Screen name="priority" options={{ title: 'Priority' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  tabItem: {
    paddingTop: 2,
    paddingBottom: 0,
  },
  tabIcon: {
    marginTop: 0,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 0,
    paddingBottom: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: ACTIVE_BG,
  },
});
