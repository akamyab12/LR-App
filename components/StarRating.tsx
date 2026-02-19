import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

interface StarRatingProps {
  value: number;
  size?: number;
  filledColor?: string;
  emptyColor?: string;
  onChange?: (nextValue: number) => void;
  disabled?: boolean;
}

export default function StarRating({
  value,
  size = 22,
  filledColor = '#4f46e5',
  emptyColor = '#cbd5e1',
  onChange,
  disabled = false,
}: StarRatingProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starNumber = index + 1;
        return (
          <Pressable
            key={starNumber}
            onPress={() => onChange?.(starNumber)}
            disabled={!onChange || disabled}
            hitSlop={4}>
            <Ionicons
              name={starNumber <= value ? 'star' : 'star-outline'}
              size={size}
              color={starNumber <= value ? filledColor : emptyColor}
              style={styles.star}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginRight: 3,
  },
});
