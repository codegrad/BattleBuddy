import { ApiConfig } from '../config';

export async function logEvent(
  userId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  occurredAt?: string,
): Promise<void> {
  try {
    await fetch(`${ApiConfig.CHAT_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventType, occurredAt: occurredAt || new Date().toISOString(), metadata }),
    });
  } catch (err) {
    console.warn('[eventService] Failed to log event:', err);
    // Non-blocking — don't throw
  }
}
