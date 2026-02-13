import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/ui/Card';
import RowButton from '@/components/ui/RowButton';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';

export default function SettingsScreen() {
  return (
    <ScreenContainer scroll contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>
      <View style={styles.divider} />

      <View style={styles.section}>
        <SectionTitle title="Account" titleStyle={styles.sectionTitleText} />

        <Card style={styles.userCard}>
          <View style={styles.initialsCircle}>
            <Text style={styles.initialsText}>JD</Text>
          </View>
          <View style={styles.userInfoCol}>
            <Text style={styles.userName}>John Doe</Text>
            <Text style={styles.email}>john.doe@company.com</Text>
          </View>
        </Card>

        <RowButton icon="person-outline" label="Edit Profile" style={styles.rowButton} onPress={() => undefined} />
        <RowButton icon="log-out-outline" label="Sign Out" style={styles.rowButton} onPress={() => undefined} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="Current Event" titleStyle={styles.sectionTitleText} />

        <View style={styles.eventCard}>
          <View style={styles.eventGlowTop} />
          <View style={styles.eventGlowBottom} />

          <View style={styles.eventHeaderRow}>
            <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            <Text style={styles.eventTitle}>Tech Summit 2026</Text>
          </View>
          <Text style={styles.eventDate}>Feb 12-14, 2026 · San Francisco, CA</Text>

          <View style={styles.eventStatsRow}>
            <View style={styles.eventStatCol}>
              <Text style={styles.eventStatValue}>5</Text>
              <Text style={styles.eventStatLabel}>Leads</Text>
            </View>
            <View style={styles.eventStatCol}>
              <Text style={styles.eventStatValue}>2</Text>
              <Text style={styles.eventStatLabel}>Hot</Text>
            </View>
            <View style={styles.eventStatCol}>
              <Text style={styles.eventStatValue}>Day 1</Text>
              <Text style={styles.eventStatLabel}>of 3</Text>
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
