import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { BBMascot } from '../mascot';
import GestureHints from './GestureHints';
import UrgeTimer from './UrgeTimer';
import UrgeButton from './UrgeButton';
import { OfflineBadge } from './OfflineBadge';
import OutcomeCapture from '../feed/OutcomeCapture';
import { useAuthStore } from '../../stores/authStore';
import { recordSessionOutcome } from '../../services/outcomeRecorder';
import ChatBottomSheet from '../chat/ChatBottomSheet';
import { useGreeting } from '../../hooks/useGreeting';
import { useSessionStore } from '../../stores/sessionStore';
import { useEngagementEngine } from '../../services/engagementEngine';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useApiHealth } from '../../hooks/useApiHealth';
import { Colors, Spacing } from '../../theme';

const SWIPE_THRESHOLD = 60;
const VELOCITY_THRESHOLD = 400;

interface HomeScreenProps {
  onOpenDrawer: () => void;
}

export default function HomeScreen({ onOpenDrawer }: HomeScreenProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const mascotState = useSessionStore((s) => s.mascotState);
  const endSession = useSessionStore((s) => s.endSession);
  const switchMode = useSessionStore((s) => s.switchMode);
  const greeting = useGreeting();
  const { isConnected } = useNetworkStatus();
  const { status: apiStatus, message: apiMessage } = useApiHealth();
  const isAvailable = isConnected && apiStatus === 'ok';

  const isActive = useSessionStore((s) => s.isActive);
  const mode = useSessionStore((s) => s.mode);

  const consumePendingRoute = useSessionStore(
    (s) => s.consumePendingNotificationRoute,
  );

  // When returning from voice with session still active (mode switch), auto-open chat
  useEffect(() => {
    if (isActive && mode === 'text' && !chatOpen) {
      setChatOpen(true);
    }
  }, [isActive, mode, chatOpen]);

  // Auto-open chat when a push notification routes here
  useEffect(() => {
    const pending = consumePendingRoute();
    if (pending === 'chat' && !chatOpen) {
      setChatOpen(true);
    }
  }, [consumePendingRoute, chatOpen]);

  const onSelfEngaged = useEngagementEngine((s) => s.onUserSelfEngaged);
  const onSessionEndEngagement = useEngagementEngine((s) => s.onSessionEnd);

  const handleUrgeRelease = useCallback(() => {
    setShowOutcome(true);
  }, []);

  const handleOutcomeComplete = useCallback(
    (outcome: 'resisted' | 'gave_in') => {
      setShowOutcome(false);
      const userId = useAuthStore.getState().user?.id || 'default';
      recordSessionOutcome(userId, outcome);
    },
    [],
  );

  const openChat = useCallback(() => {
    setChatOpen(true);
    onSelfEngaged();
  }, [onSelfEngaged]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    endSession();
    onSessionEndEngagement();
  }, [endSession, onSessionEndEngagement]);

  const openVoice = useCallback(() => {
    router.push('/session');
  }, []);

  const switchToVoice = useCallback(() => {
    setChatOpen(false);
    switchMode('voice');
    router.push('/session');
  }, [switchMode]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationY > SWIPE_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
        runOnJS(openChat)();
      } else if (e.translationY < -SWIPE_THRESHOLD || e.velocityY < -VELOCITY_THRESHOLD) {
        runOnJS(openVoice)();
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(openChat)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onEnd(() => {
      runOnJS(openVoice)();
    });

  const composed = Gesture.Race(
    swipeGesture,
    Gesture.Exclusive(longPressGesture, tapGesture),
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onOpenDrawer}
          activeOpacity={0.7}
          hitSlop={12}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        <View style={styles.timerArea}>
          <UrgeTimer />
        </View>

        <UrgeButton onRelease={handleUrgeRelease} />

        <GestureDetector gesture={composed}>
          <View style={styles.mascotArea}>
            <GestureHints />
            <BBMascot state={mascotState} size={220} />
            <OfflineBadge
              visible={!isAvailable}
              message={!isConnected ? 'Offline' : apiMessage || undefined}
            />
            <Text style={styles.greeting}>{greeting}</Text>
          </View>
        </GestureDetector>

        <TouchableOpacity
          style={styles.devLink}
          onPress={() => router.push('/dev-mascot')}
          activeOpacity={0.7}
        >
          <Text style={styles.devText}>🔧 Mascot states</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <ChatBottomSheet
        open={chatOpen}
        onClose={closeChat}
        onSwitchToVoice={switchToVoice}
      />

      {showOutcome && <OutcomeCapture onComplete={handleOutcomeComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  timerArea: {
    alignItems: 'center',
    marginTop: 56,
  },
  menuButton: {
    position: 'absolute',
    top: 60,
    left: Spacing.md,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    color: Colors.textPrimary,
    fontSize: 20,
  },
  mascotArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  greeting: {
    marginTop: Spacing.lg,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  devLink: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    padding: Spacing.sm,
  },
  devText: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
});
