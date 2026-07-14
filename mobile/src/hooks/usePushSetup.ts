import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import {
  requestPermissions,
  getExpoPushToken,
  registerTokenWithServer,
  parseNudgePayload,
} from '../services/pushNotifications';
import { useSessionStore } from '../stores/sessionStore';

export function usePushSetup(userId: string | null, enabled = true) {
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const setPendingRoute = useSessionStore(
    (s) => s.setPendingNotificationRoute,
  );

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    (async () => {
      const granted = await requestPermissions();
      if (!granted || !mounted) return;

      const token = await getExpoPushToken();
      if (!token || !mounted) return;

      if (userId) {
        await registerTokenWithServer(token, userId);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, enabled]);

  useEffect(() => {
    const handleTap = (route?: 'chat' | 'voice') => {
      if (route === 'voice') {
        // Voice notifications open the One Conversation surface; audio still
        // only turns on when the user taps the speaker (never automatically).
        router.push('/session');
      } else {
        setPendingRoute('chat');
      }
    };

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const payload = parseNudgePayload(response.notification);
        handleTap(payload?.route);
      });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const payload = parseNudgePayload(response.notification);
      handleTap(payload?.route);
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [setPendingRoute]);
}
