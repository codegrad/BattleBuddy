import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  LiveKitRoom,
  useParticipants,
  AudioSession,
  registerGlobals,
} from '@livekit/react-native';
import { Room, RoomEvent } from 'livekit-client';
import { ApiConfig } from '../src/config';

registerGlobals();

export default function MicTestScreen() {
  const [log, setLog] = useState<string[]>(['Starting mic test...']);
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const addLog = (msg: string) => {
    console.log('[MicTest]', msg);
    setLog(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    const connect = async () => {
      try {
        addLog('Requesting audio session...');
        await AudioSession.startAudioSession();
        addLog('Audio session started');

        addLog('Fetching LiveKit token...');
        const res = await fetch(`${ApiConfig.CHAT_URL}/livekit/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: `mic-test-${Date.now()}`, identity: `tester-${Date.now()}` }),
        });

        if (!res.ok) {
          addLog(`Token fetch failed: ${res.status}`);
          return;
        }

        const { token: t, url } = await res.json();
        addLog(`Got token, connecting to ${url}`);
        setWsUrl(url);
        setToken(t);
      } catch (err: any) {
        addLog(`Error: ${err.message}`);
      }
    };

    connect();
    return () => { AudioSession.stopAudioSession(); };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mic Test</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.meterContainer}>
          <Text style={styles.meterLabel}>Audio Level</Text>
          <View style={styles.meterBar}>
            <View style={[styles.meterFill, { width: `${Math.min(audioLevel * 100, 100)}%` }]} />
          </View>
          <Text style={styles.meterValue}>{(audioLevel * 100).toFixed(1)}%</Text>
        </View>

        <View style={styles.logContainer}>
          {log.map((line, i) => (
            <Text key={i} style={styles.logLine}>{line}</Text>
          ))}
        </View>

        {token && wsUrl && (
          <LiveKitRoom
            serverUrl={wsUrl}
            token={token}
            connect={true}
            audio={true}
            video={false}
            onConnected={() => addLog('Connected to LiveKit room')}
            onDisconnected={() => addLog('Disconnected from LiveKit')}
          >
            <MicMonitor onLog={addLog} onAudioLevel={setAudioLevel} />
          </LiveKitRoom>
        )}
      </SafeAreaView>
    </View>
  );
}

function MicMonitor({ onLog, onAudioLevel }: { onLog: (msg: string) => void; onAudioLevel: (level: number) => void }) {
  const participants = useParticipants();
  const loggedRef = useRef(false);

  useEffect(() => {
    const local = participants.find(p => p.isLocal);
    if (local && !loggedRef.current) {
      loggedRef.current = true;
      onLog(`Local participant: ${local.identity}`);
      onLog(`Mic tracks: ${local.audioTrackPublications.size}`);
      onLog(`Is speaking: ${local.isSpeaking}`);

      local.audioTrackPublications.forEach((pub) => {
        onLog(`Track: ${pub.trackSid} | muted: ${pub.isMuted} | subscribed: ${pub.isSubscribed}`);
      });
    }

    if (local) {
      onAudioLevel(local.audioLevel ?? 0);
      if (local.isSpeaking) {
        onLog(`Speaking detected! Level: ${(local.audioLevel ?? 0).toFixed(3)}`);
      }
    }
  }, [participants, onLog, onAudioLevel]);

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  closeButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#3A3A3C', justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  meterContainer: { paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' },
  meterLabel: { color: '#8E8E93', fontSize: 14, marginBottom: 8 },
  meterBar: {
    width: '100%', height: 24, backgroundColor: '#3A3A3C',
    borderRadius: 12, overflow: 'hidden',
  },
  meterFill: { height: '100%', backgroundColor: '#34C759', borderRadius: 12 },
  meterValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 8 },
  logContainer: { flex: 1, paddingHorizontal: 16 },
  logLine: { color: '#8E8E93', fontSize: 12, fontFamily: 'Courier', marginBottom: 2 },
});
