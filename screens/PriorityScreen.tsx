import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import StarRating from '@/components/StarRating';
import ScreenContainer from '@/components/ui/ScreenContainer';
import { fetchPriorityLeads } from '@/lib/api';
import type { PriorityLead } from '@/lib/types';

const cardThemes = [
  { base: '#ff2f6d', top: '#ff6197', bottom: '#d61557' },
  { base: '#5448e6', top: '#786fff', bottom: '#3730a3' },
  { base: '#111827', top: '#334155', bottom: '#020617' },
  { base: '#0f172a', top: '#1e293b', bottom: '#030712' },
];

export default function PriorityScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<PriorityLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPriorityLeads()
      .then((result) => setLeads(result.slice(0, 4)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.content}>
      <View style={styles.pageHeader}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="flash-outline" size={22} color="#ffffff" />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.pageTitle}>Priority</Text>
          <Text style={styles.subtitle}>AI-ranked by revenue potential</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionHeader}>
        <Ionicons name="flame-outline" size={20} color="#fb7185" />
        <Text style={styles.sectionTitle}>Close These First</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <View style={styles.cardStack}>
          {leads.map((lead, index) => {
            const theme = cardThemes[index] ?? cardThemes[cardThemes.length - 1];

            return (
              <Pressable
                key={lead.id}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/leads/[id]',
                    params: { id: lead.id },
                  } as never)
                }
                style={[styles.priorityCard, { backgroundColor: theme.base }]}>
                <View style={[styles.glowTop, { backgroundColor: theme.top }]} />
                <View style={[styles.glowBottom, { backgroundColor: theme.bottom }]} />

                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{lead.rank}</Text>
                </View>

                <Text style={styles.name}>{lead.name}</Text>
                <Text style={styles.title}>{lead.title}</Text>
                <Text style={styles.company}>{lead.company}</Text>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreBlock}>
                    <View style={styles.scoreValueRow}>
                      <Ionicons name="trending-up-outline" size={16} color="#ffffff" />
                      <Text style={styles.scoreValue}>{lead.priorityScore}</Text>
                    </View>
                    <Text style={styles.scoreLabel}>Priority</Text>
                  </View>

                  <StarRating
                    value={lead.stars}
                    size={20}
                    filledColor="#ffffff"
                    emptyColor="rgba(255,255,255,0.45)"
                  />
                </View>

                <View style={styles.tagRow}>
                  {lead.highlights.map((tag) => (
                    <View key={`${lead.id}-${tag}`} style={styles.tagPill}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 10,
    paddingBottom: 32,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  sectionHeader: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
  },
  cardStack: {
    marginTop: 14,
    gap: 14,
  },
  priorityCard: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#020617',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  glowTop: {
    position: 'absolute',
    top: -58,
    right: -38,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.45,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    opacity: 0.44,
  },
  rankBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  name: {
    color: '#ffffff',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    paddingRight: 56,
  },
  title: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.94)',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
  company: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  },
  scoreRow: {
    marginTop: 13,
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
    color: '#ffffff',
    fontSize: 46,
    lineHeight: 48,
    fontWeight: '800',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 1,
  },
  tagRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  loadingArea: {
    marginTop: 28,
    paddingVertical: 28,
    alignItems: 'center',
  },
});
