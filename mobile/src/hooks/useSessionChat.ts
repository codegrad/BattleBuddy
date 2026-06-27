import { useRef, useCallback, useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { streamChatTurn } from '../services/chatStream';
import { isOnline } from './useNetworkStatus';
import { getEngagementContext } from '../services/engagementEngine';

const OFFLINE_REPLY =
  "I can't reach my brain in the cloud right now, but I'm still here. " +
  'Your message is saved — try the urge-wave exercise: breathe in for 4 counts, hold for 4, out for 4. ' +
  "We'll pick back up when you're back online.";

export function useSessionChat() {
  const store = useSessionStore();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || store.isStreaming) return;

      store.addUserMessage(trimmed);
      const assistantId = store.addAssistantMessage();
      store.setStreaming(true);
      store.setMascotState('thinking');

      let firstToken = true;

      try {
        const online = await isOnline();
        if (!online) {
          useSessionStore.getState().updateAssistantMessage(assistantId, OFFLINE_REPLY);
          return;
        }

        abortRef.current = new AbortController();
        const state = useSessionStore.getState();

        await streamChatTurn(
          {
            messages: state.getMessagesForApi(),
            profile: enrichWithEngagement(state.profileSummary),
            recentHistory: state.recentHistory,
            triggerContext: state.triggerContext,
            userId: useAuthStore.getState().user?.id || 'default',
          },
          (accumulated) => {
            if (firstToken) {
              useSessionStore.getState().setMascotState('speaking');
              firstToken = false;
            }
            useSessionStore.getState().updateAssistantMessage(assistantId, accumulated);
          },
          abortRef.current.signal,
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error && err.message && !err.message.includes('Failed to fetch')
          ? err.message
          : OFFLINE_REPLY;
        useSessionStore
          .getState()
          .updateAssistantMessage(assistantId, msg);
      } finally {
        useSessionStore.getState().setStreaming(false);
        useSessionStore.getState().setMascotState('listening');
      }
    },
    [store],
  );

  const greet = useCallback(async () => {
    const state = useSessionStore.getState();
    const hasVoiceHistory = state.messages.length > 0 && state.messages.some(m => m.mode === 'voice');
    const hasTextHistory = state.messages.length > 0 && state.messages.some(m => m.mode === 'text');

    // If already greeted in text mode this session, don't re-greet
    if (hasTextHistory) return;

    const isFirstSession = state.sessionCount <= 1 &&
      (!state.profileSummary || state.profileSummary.includes('New user'));

    // Minimal trigger to start the conversation — the system prompt handles the greeting.
    // This is filtered from the UI display.
    const trigger = hasVoiceHistory ? '[mode:voice→text]' : '[session:start]';
    store.addUserMessage(trigger);
    const assistantId = store.addAssistantMessage();
    store.setStreaming(true);
    store.setMascotState('thinking');

    let firstToken = true;

    try {
      const online = await isOnline();
      if (!online) {
        useSessionStore.getState().updateAssistantMessage(assistantId, OFFLINE_REPLY);
        return;
      }

      abortRef.current = new AbortController();
      const state = useSessionStore.getState();

      await streamChatTurn(
        {
          messages: state.getMessagesForApi(),
          profile: enrichWithEngagement(state.profileSummary),
          recentHistory: state.recentHistory,
          triggerContext: state.triggerContext,
        },
        (accumulated) => {
          if (firstToken) {
            useSessionStore.getState().setMascotState('speaking');
            firstToken = false;
          }
          useSessionStore.getState().updateAssistantMessage(assistantId, accumulated);
        },
        abortRef.current.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error && err.message && !err.message.includes('Failed to fetch')
        ? err.message
        : OFFLINE_REPLY;
      useSessionStore
        .getState()
        .updateAssistantMessage(assistantId, msg);
    } finally {
      useSessionStore.getState().setStreaming(false);
      useSessionStore.getState().setMascotState('listening');
    }
  }, [store]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, greet, abort };
}

function enrichWithEngagement(profile: string): string {
  let enriched = profile;

  // Ensure the user's name is always in the profile
  const authUser = useAuthStore.getState().user;
  if (authUser?.name && !enriched.includes(authUser.name)) {
    enriched = `Name: ${authUser.name}. ${enriched}`;
  }

  const ctx = getEngagementContext();
  if (ctx) {
    enriched = `${enriched}\n\nEngagement context: ${ctx}`;
  }

  return enriched;
}
