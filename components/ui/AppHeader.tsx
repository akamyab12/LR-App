import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface AppHeaderProps {
  onBack?: () => void;
  backLabel?: string;
  backIcon?: IoniconName;
  rightSlot?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function AppHeader({
  onBack,
  backLabel = 'Back',
  backIcon = 'chevron-back',
  rightSlot,
  style,
}: AppHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Pressable style={styles.backButton} onPress={onBack} hitSlop={8}>
        <Ionicons name={backIcon} size={20} color="#4f46e5" />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  backText: {
    color: '#4f46e5',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
  },
});
