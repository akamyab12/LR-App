import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

const ACTIVE_BG = '#4f46e5';
const ACTIVE_LABEL = '#111827';
const INACTIVE_LABEL = '#9ca3af';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_LABEL,
        tabBarInactiveTintColor: INACTIVE_LABEL,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: styles.tabBar,
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
                size={20}
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
    height: 88,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  tabItem: {
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: ACTIVE_BG,
  },
});
