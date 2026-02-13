import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface RowButtonProps {
  icon: IoniconName;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function RowButton({ icon, label, onPress, style }: RowButtonProps) {
  return (
    <Pressable style={[styles.row, style]} onPress={onPress}>
      <View style={styles.left}>
        <Ionicons name={icon} size={18} color="#475569" />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: '#1f2937',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
  },
});
