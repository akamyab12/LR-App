import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type FollowUpDatePickerProps = {
  value: string | null;
  onChange: (nextIsoDate: string | null) => void;
  label?: string;
  disabled?: boolean;
  onPress?: () => void;
};

function parseIsoDate(value: string | null): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function toIsoDateString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFollowUpDate(value: string | null, label: string): string {
  if (!value) {
    return `${label}: TBD`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return `${label}: TBD`;
  }

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${label}: ${month}/${day}/${year}`;
}

export default function FollowUpDatePicker({
  value,
  onChange,
  label = 'Follow up',
  disabled = false,
  onPress,
}: FollowUpDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(parseIsoDate(value));

  const displayText = useMemo(() => formatFollowUpDate(value, label), [label, value]);

  const openPicker = () => {
    if (disabled) {
      return;
    }

    onPress?.();
    setDraftDate(parseIsoDate(value));
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
  };

  const handleDone = () => {
    onChange(toIsoDateString(draftDate));
    closePicker();
  };

  const handleNativeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      closePicker();
      return;
    }

    if (!selectedDate) {
      return;
    }

    setDraftDate(selectedDate);

    if (Platform.OS === 'android' && event.type === 'set') {
      onChange(toIsoDateString(selectedDate));
      closePicker();
    }
  };

  return (
    <View>
      <Pressable
        style={[styles.row, disabled && styles.rowDisabled]}
        onPress={openPicker}
        disabled={disabled}>
        <View style={styles.left}>
          <Ionicons name="calendar-outline" size={18} color="#4f46e5" />
          <Text style={styles.text}>{displayText}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </Pressable>

      {Platform.OS === 'ios' && open ? (
        <Modal visible transparent animationType="slide" onRequestClose={closePicker}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <DateTimePicker value={draftDate} mode="date" display="spinner" onChange={handleNativeChange} />
              <View style={styles.actions}>
                <Pressable style={styles.ghostButton} onPress={closePicker}>
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={handleDone}>
                  <Text style={styles.primaryText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {Platform.OS === 'android' && open ? (
        <DateTimePicker value={draftDate} mode="date" display="default" onChange={handleNativeChange} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  text: {
    color: '#1f2937',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  sheetTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  ghostButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});
