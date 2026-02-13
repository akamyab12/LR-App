import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}

export default function SectionTitle({ title, subtitle, rightSlot, style, titleStyle }: SectionTitleProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftColumn}>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftColumn: {
    flex: 1,
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
});
