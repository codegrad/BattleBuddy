import { useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import StreamCard from './StreamCard';
import { useSessionStore, type SessionMessage } from '../../stores/sessionStore';
import { Colors, Spacing } from '../../theme';

// The One Conversation stream: message bubbles, quick-log receipts, phase
// banners, and agent-presented inline cards, all in one ordered list.

interface ConversationStreamProps {
  onBreathingDone: (from: number, to: number) => void;
}

function isHiddenSeed(m: SessionMessage): boolean {
  return m.role === 'user' && m.content.startsWith('[') && m.content.endsWith(']');
}

/** Dashboard/content CTAs prefix the turn with bracketed context for the
    model ("[Looking at the arc card…] Let's talk about this."). The context
    rides to the API; the stream shows only the human part. Phase 5 renders
    the prefix as a reply-quote instead of dropping it. */
function displayContent(m: SessionMessage): string {
  if (m.role === 'user' && m.content.startsWith('[')) {
    const close = m.content.indexOf(']');
    if (close > 0 && close < m.content.length - 1) {
      return m.content.slice(close + 1).trim();
    }
  }
  return m.content;
}

export default function ConversationStream({ onBreathingDone }: ConversationStreamProps) {
  const messages = useSessionStore((s) => s.messages);
  const previousMessages = useSessionStore((s) => s.previousMessages);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const listRef = useRef<FlatList>(null);

  const displayMessages = useMemo(() => {
    const current = messages.filter((m) => !isHiddenSeed(m));
    if (previousMessages.length > 0) {
      const prevFiltered = previousMessages.filter(
        (m) => m.content.length > 0 && !isHiddenSeed(m),
      );
      if (prevFiltered.length > 0) {
        const separator: SessionMessage = {
          id: 'prev-separator',
          role: 'assistant',
          content: '── previous session ──',
          mode: 'text',
          timestamp: 0,
        };
        return [...prevFiltered, separator, ...current];
      }
    }
    return current;
  }, [messages, previousMessages]);

  const renderMessage = useCallback(
    ({ item }: { item: SessionMessage }) => {
      if (item.id === 'prev-separator') {
        return (
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>previous session</Text>
            <View style={styles.separatorLine} />
          </View>
        );
      }
      if (item.kind === 'receipt' && item.receipt) {
        const dotColor =
          item.receipt.type === 'resisted' ? Colors.success
          : item.receipt.type === 'decision' ? Colors.stateIdle
          : item.receipt.type === 'urge' ? Colors.coral
          : Colors.textTertiary;
        const time = new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return (
          <View style={styles.receipt}>
            <View style={[styles.receiptDot, { backgroundColor: dotColor }]} />
            <Text style={styles.receiptText}>Logged — {time} · {item.receipt.label}</Text>
          </View>
        );
      }
      if (item.kind === 'banner' && item.bannerPhase) {
        const resistance = item.bannerPhase === 'resistance';
        return (
          <View style={[styles.banner, resistance ? styles.bannerResistance : styles.bannerObservation]}>
            <Text style={[styles.bannerText, { color: resistance ? Colors.coral : Colors.stateIdle }]}>
              {resistance ? "Resistance — I'm right here" : 'Back to observation — no grades, just the map'}
            </Text>
          </View>
        );
      }
      if (item.kind === 'card' && item.card) {
        return <StreamCard card={item.card} onBreathingDone={onBreathingDone} />;
      }
      const isAssistant = item.role === 'assistant';
      const content = displayContent(item);
      return (
        <View style={[styles.bubble, isAssistant ? styles.assistantBubble : styles.userBubble]}>
          {isAssistant && !item.content && isStreaming && (
            <Text style={styles.typing}>...</Text>
          )}
          {item.mode === 'voice' && isAssistant && (
            <Text style={styles.modeTag}>via voice</Text>
          )}
          {isAssistant && item.content ? (
            <Markdown style={mdStyles}>{item.content}</Markdown>
          ) : (
            <Text style={styles.messageText}>{content}</Text>
          )}
        </View>
      );
    },
    [isStreaming, onBreathingDone],
  );

  return (
    <FlatList
      ref={listRef}
      data={[...displayMessages].reverse()}
      renderItem={renderMessage}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      inverted
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: Colors.coral,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  modeTag: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontStyle: 'italic',
  },
  typing: {
    color: Colors.textSecondary,
    fontSize: 20,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surfaceBorder,
  },
  separatorText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  receipt: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  receiptDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  receiptText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  banner: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    paddingTop: 8,
    marginVertical: 8,
  },
  bannerResistance: {
    borderTopColor: 'rgba(232,98,74,0.5)',
  },
  bannerObservation: {
    borderTopColor: 'rgba(91,159,255,0.4)',
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

const mdStyles = StyleSheet.create({
  body: {
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  strong: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  em: {
    fontStyle: 'italic',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  bullet_list: {
    marginTop: 4,
    marginBottom: 4,
  },
  ordered_list: {
    marginTop: 4,
    marginBottom: 4,
  },
  list_item: {
    marginBottom: 4,
  },
  bullet_list_icon: {
    color: Colors.coral,
    fontSize: 16,
    lineHeight: 24,
    marginRight: 8,
  },
  code_inline: {
    backgroundColor: Colors.surfaceBorder,
    color: Colors.coral,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 14,
    fontFamily: 'Menlo',
  },
  fence: {
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  fence_body: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: 'Menlo',
  },
  link: {
    color: Colors.coral,
    textDecorationLine: 'underline',
  },
  heading1: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  hr: {
    backgroundColor: Colors.surfaceBorder,
    height: 1,
    marginVertical: 8,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.coral,
    paddingLeft: 12,
    marginVertical: 4,
    opacity: 0.9,
  },
});
