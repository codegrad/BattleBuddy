import { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import FeedPager, { type FeedCard } from '../src/components/feed/FeedPager';
import OutcomeCapture from '../src/components/feed/OutcomeCapture';
import ChatSheet from '../src/components/feed/ChatSheet';
import { useAuthStore } from '../src/stores/authStore';
import { recordSessionOutcome } from '../src/services/outcomeRecorder';

const PLACEHOLDER_CARDS: FeedCard[] = [
  {
    id: '1',
    type: 'text',
    overlayText: "You're here. That's the commander showing up.\nThe urge is real — but it peaks and passes.",
  },
  {
    id: '2',
    type: 'image_text',
    mediaUri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    overlayText: 'Take a breath. This wave is already cresting.',
  },
  {
    id: '3',
    type: 'text',
    overlayText: "Every time you resist, you're rewiring the loop.\nThe old gradient gets weaker. You get stronger.",
  },
  {
    id: '4',
    type: 'image_text',
    mediaUri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
    overlayText: "Two minutes. That's all it takes for most urges to pass. Let's ride it out together.",
  },
  {
    id: '5',
    type: 'text',
    overlayText: "You didn't come this far to give in now.\nYour streak matters — and so does this moment.",
  },
  {
    id: '6',
    type: 'chat',
  },
];

export default function SessionFeedScreen() {
  const [showOutcome, setShowOutcome] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [cardEngagements, setCardEngagements] = useState<Record<string, { helped: boolean }>>({});
  const cardTimestamps = useRef<Record<number, number>>({});
  const dwellTimes = useRef<Record<string, number>>({});

  const handleHelpedTap = useCallback((cardId: string) => {
    setCardEngagements((prev) => ({
      ...prev,
      [cardId]: { helped: !prev[cardId]?.helped },
    }));
  }, []);

  const handleCardVisible = useCallback(
    (index: number) => {
      const now = Date.now();
      const prevIndex = Object.keys(cardTimestamps.current).find(
        (k) => cardTimestamps.current[Number(k)] > 0 && Number(k) !== index,
      );
      if (prevIndex !== undefined) {
        const prevCard = PLACEHOLDER_CARDS[Number(prevIndex)];
        if (prevCard) {
          const elapsed = (now - cardTimestamps.current[Number(prevIndex)]) / 1000;
          dwellTimes.current[prevCard.id] = (dwellTimes.current[prevCard.id] ?? 0) + elapsed;
        }
        cardTimestamps.current[Number(prevIndex)] = 0;
      }
      cardTimestamps.current[index] = now;
    },
    [],
  );

  const handleClose = useCallback(() => {
    setShowOutcome(true);
  }, []);

  const handleOutcomeComplete = useCallback(
    (outcome: 'resisted' | 'gave_in') => {
      const userId = useAuthStore.getState().user?.id || 'default';
      recordSessionOutcome(userId, outcome);
      router.back();
    },
    [],
  );

  const handleOpenChat = useCallback(() => {
    setShowChat(true);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <FeedPager
        cards={PLACEHOLDER_CARDS}
        onOpenChat={handleOpenChat}
        onCardVisible={handleCardVisible}
        cardEngagements={cardEngagements}
        onHelpedTap={handleHelpedTap}
      />

      <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      {showChat && <ChatSheet onClose={() => setShowChat(false)} />}
      {showOutcome && <OutcomeCapture onComplete={handleOutcomeComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
