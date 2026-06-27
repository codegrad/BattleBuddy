import { ApiConfig } from '../config';

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/Chicago';
  }
}

export interface ChatTurnOptions {
  messages: { role: string; content: string }[];
  profile?: string;
  recentHistory?: string;
  triggerContext?: { trigger: string; intensity: number; time: string } | null;
  userId?: string;
}

export async function streamChatTurn(
  options: ChatTurnOptions,
  onToken: (accumulated: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(`${ApiConfig.CHAT_URL}/session/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: options.messages,
      profile: options.profile,
      recent_history: options.recentHistory,
      trigger_context: options.triggerContext,
      userId: options.userId,
      timezone: getTimezone(),
    }),
    signal,
  });

  if (!res.ok) {
    let errorMsg = 'Failed to connect';
    try {
      const errBody = await res.json();
      if (typeof errBody.error === 'string' && errBody.error.includes('credit balance')) {
        errorMsg = "I'm having a connection issue on my end right now. Give me a minute and try again.";
      } else if (typeof errBody.error === 'string' && errBody.error.includes('rate')) {
        errorMsg = "I'm getting a lot of traffic right now. Try again in a minute.";
      } else {
        errorMsg = "Something went wrong on my end. Try again in a moment.";
      }
    } catch {}
    throw new Error(errorMsg);
  }
  if (!res.body) throw new Error('Something went wrong on my end. Try again in a moment.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          let msg = "Something went wrong on my end. Try again in a moment.";
          if (parsed.error.includes('credit balance')) {
            msg = "I'm having a connection issue on my end right now. Give me a minute and try again.";
          } else if (parsed.error.includes('rate') || parsed.error.includes('overloaded')) {
            msg = "I'm getting a lot of traffic right now. Try again in a minute.";
          }
          throw new Error(msg);
        }
        if (parsed.text) {
          accumulated += parsed.text;
          onToken(accumulated);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== data) throw e;
      }
    }
  }

  return accumulated;
}
