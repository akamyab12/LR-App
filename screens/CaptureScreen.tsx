import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createLeadFromScan } from '@/lib/api';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanValue, setScanValue] = useState<string | null>(null);
  const [scanLocked, setScanLocked] = useState(false);
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [savedRecordingUri, setSavedRecordingUri] = useState<string | null>(null);
  const lastValueRef = useRef<string | null>(null);

  const resetScanState = useCallback((reason: 'focus' | 'manual') => {
    if (scanLocked || !scanningEnabled) {
      console.log('SCAN_UNLOCKED', reason);
    }
    setScanValue(null);
    setScanLocked(false);
    setScanningEnabled(true);
    setIsCreatingLead(false);
    lastValueRef.current = null;
  }, [scanLocked, scanningEnabled]);

  useFocusEffect(
    useCallback(() => {
      resetScanState('focus');
      return () => {
        setScanValue(null);
      };
    }, [resetScanState])
  );

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  const onBarcodeScanned = useCallback(
    async (event: BarcodeScanningResult) => {
      if (scanLocked) {
        return;
      }

      const scannedValue = (event.data ?? '').trim();
      if (scannedValue.length === 0) {
        return;
      }

      if (scannedValue === lastValueRef.current) {
        return;
      }

      setScanLocked(true);
      setScanningEnabled(false);
      console.log('SCAN_LOCKED', 'detected');
      lastValueRef.current = scannedValue;
      setScanValue(scannedValue);
      console.log('SCAN_DETECTED', scannedValue.slice(0, 120));

      setIsCreatingLead(true);
      try {
        const leadId = await createLeadFromScan({
          qr: scannedValue,
          audioUri: savedRecordingUri,
        });
        console.log('SCAN_INSERT_OK', leadId);
        setScanValue(null);
        console.log('SCAN_NAVIGATE', leadId);
        router.replace({
          pathname: '/leads/[id]',
          params: { id: String(leadId), from: 'capture' },
        } as never);
      } catch (error) {
        console.log(
          'SCAN_INSERT_ERR',
          error instanceof Error ? error.message : 'Unknown error during lead insert'
        );
        Alert.alert(
          'Lead creation failed',
          error instanceof Error ? error.message : 'An unexpected error occurred.'
        );
      } finally {
        setIsCreatingLead(false);
      }
    },
    [router, savedRecordingUri, scanLocked]
  );

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
        Alert.alert('Microphone permission needed', 'Allow microphone access to record audio.');
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
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
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
          onBarcodeScanned={!scanningEnabled || scanLocked ? undefined : onBarcodeScanned}
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

        {!scanningEnabled || scanLocked ? (
          <Pressable style={styles.rescanButton} onPress={() => resetScanState('manual')}>
            <Text style={styles.rescanButtonText}>Scan another</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03050b',
    paddingHorizontal: 18,
  },
  header: {
    marginTop: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  cameraWrap: {
    flex: 1,
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 300,
    height: 300,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 5, 11, 0.24)',
  },
  corner: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderColor: '#4f46e5',
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 8,
    borderLeftWidth: 8,
    borderTopLeftRadius: 22,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 8,
    borderRightWidth: 8,
    borderTopRightRadius: 22,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderBottomLeftRadius: 22,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderBottomRightRadius: 22,
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
    paddingTop: 12,
    paddingBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  controlButton: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordButton: {
    flex: 1,
    height: 54,
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
  rescanButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
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
