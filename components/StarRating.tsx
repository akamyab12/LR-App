import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

interface StarRatingProps {
  value: number;
  size?: number;
  filledColor?: string;
  emptyColor?: string;
}

export default function StarRating({
  value,
  size = 22,
  filledColor = '#4f46e5',
  emptyColor = '#cbd5e1',
}: StarRatingProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starNumber = index + 1;
        return (
          <Ionicons
            key={starNumber}
            name={starNumber <= value ? 'star' : 'star-outline'}
            size={size}
            color={starNumber <= value ? filledColor : emptyColor}
            style={styles.star}
          />
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
