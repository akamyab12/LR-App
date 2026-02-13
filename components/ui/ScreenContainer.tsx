import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  horizontalPadding?: number;
  showsVerticalScrollIndicator?: boolean;
}

export default function ScreenContainer({
  children,
  scroll = false,
  style,
  contentContainerStyle,
  backgroundColor = '#f8fafc',
  horizontalPadding = 20,
  showsVerticalScrollIndicator = false,
}: ScreenContainerProps) {
  const baseContentStyle: ViewStyle = {
    paddingHorizontal: horizontalPadding,
    paddingTop: 12,
    paddingBottom: 28,
  };

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor }, style]} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[baseContentStyle, contentContainerStyle]}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }, style]} edges={['top', 'bottom']}>
      <View style={[baseContentStyle, styles.fill, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});
