import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanValue, setScanValue] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [savedRecordingUri, setSavedRecordingUri] = useState<string | null>(null);
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  const onBarcodeScanned = useCallback((event: BarcodeScanningResult) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1500) {
      return;
    }

    lastScanTimeRef.current = now;
    setScanValue(event.data);
  }, []);

  const toggleRecording = useCallback(async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setSavedRecordingUri(uri ?? null);
        setRecording(null);
        setIsRecording(false);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        return;
      }

      const microphonePermission = await Audio.requestPermissionsAsync();
      if (!microphonePermission.granted) {
        Alert.alert('Microphone permission needed', 'Allow microphone access to record notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(result.recording);
      setSavedRecordingUri(null);
      setIsRecording(true);
    } catch {
      Alert.alert('Recording failed', 'Unable to start or stop recording right now.');
      setRecording(null);
      setIsRecording(false);
    }
  }, [recording]);

  if (!cameraPermission) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Loading camera...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Camera access is required</Text>
        <Text style={styles.stateSubtitle}>Allow camera permission to scan badge QR codes.</Text>
        <Pressable style={styles.permissionButton} onPress={requestCameraPermission}>
          <Text style={styles.permissionButtonText}>Enable Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }] }>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>Scan Badge</Text>
        <Text style={styles.subtitle}>Position QR code in the frame</Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchEnabled}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <Ionicons name="scan" size={42} color="rgba(255,255,255,0.35)" />
        </View>

        {scanValue ? (
          <View style={styles.scanToast}>
            <Text style={styles.scanToastLabel}>Scanned QR</Text>
            <Text style={styles.scanToastValue} numberOfLines={2}>
              {scanValue}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controlsWrap}>
        <View style={styles.controlsRow}>
          <Pressable style={styles.controlButton} onPress={() => setTorchEnabled((value) => !value)}>
            <Ionicons name={torchEnabled ? 'flash' : 'flash-off'} size={20} color="#ffffff" />
            <Text style={styles.controlText}>Flash</Text>
          </Pressable>

          <Pressable
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={toggleRecording}>
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={22} color="#ffffff" />
            <Text style={styles.controlText}>{isRecording ? 'Stop' : 'Record'}</Text>
          </Pressable>
        </View>

        {savedRecordingUri ? (
          <View style={styles.savedCard}>
            <Text style={styles.savedLabel}>Saved</Text>
            <Text style={styles.savedUri} numberOfLines={1}>
              {savedRecordingUri}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03050b',
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 18,
    marginTop: 4,
  },
  cameraWrap: {
    flex: 1,
    marginTop: 24,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.35)',
  },
  frame: {
    width: 248,
    height: 190,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 5, 11, 0.18)',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#4f46e5',
  },
  cornerTopLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderTopLeftRadius: 14,
  },
  cornerTopRight: {
    top: -3,
    right: -3,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderTopRightRadius: 14,
  },
  cornerBottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderBottomLeftRadius: 14,
  },
  cornerBottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderBottomRightRadius: 14,
  },
  scanToast: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
  },
  scanToastLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scanToastValue: {
    color: '#ffffff',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  controlsWrap: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
  },
  controlText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  savedCard: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  savedLabel: {
    color: '#34d399',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  savedUri: {
    color: '#e2e8f0',
    marginTop: 4,
    fontSize: 12,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#f8fafc',
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  permissionButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
