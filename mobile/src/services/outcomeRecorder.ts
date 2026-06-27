import { ApiConfig } from '../config';
import type { SessionMessage, SessionOutcome } from '../stores/sessionStore';

export interface SessionResult {
  userId: string | null;
  sessionId: string;
  mode: string;
  outcome: SessionOutcome;
  helped: boolean;
  startedAt: number;
  endedAt: number;
  triggerContext: TriggerContext | null;
  messages: SessionMessage[];
  intensityStart: number | null;
  intensityEnd: number | null;
}

export interface TriggerContext {
  trigger: string;
  intensity: number;
  time: string;
}

export async function recordOutcome(result: SessionResult): Promise<void> {
  if (!result.userId || !ApiConfig.SUPABASE_URL || !ApiConfig.SUPABASE_ANON_KEY) {
    // Even without Supabase, try to generate the report
    generateSessionReport(result, null);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    apikey: ApiConfig.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${ApiConfig.SUPABASE_ANON_KEY}`,
  };

  try {
    // 1. Insert craving event
    const eventRes = await fetch(`${ApiConfig.SUPABASE_URL}/rest/v1/craving_events`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: result.userId,
        started_at: new Date(result.startedAt).toISOString(),
        ended_at: new Date(result.endedAt).toISOString(),
        trigger_context: result.triggerContext ?? {},
        mode: result.mode === 'idle' ? 'text' : result.mode,
        outcome: result.outcome === 'submitted' ? 'submitted' : result.outcome,
        helped: result.helped,
        intensity_start: result.intensityStart,
        intensity_end: result.intensityEnd,
      }),
    });

    if (!eventRes.ok) return;

    const [event] = await eventRes.json();
    if (!event?.id) return;

    // 2. Insert messages
    const messageBatch = result.messages
      .filter((m) => m.content.length > 0)
      .map((m) => ({
        craving_event_id: event.id,
        user_id: result.userId,
        role: m.role,
        content: m.content,
        modality: m.mode === 'idle' ? 'text' : m.mode,
        created_at: new Date(m.timestamp).toISOString(),
      }));

    if (messageBatch.length > 0) {
      await fetch(`${ApiConfig.SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(messageBatch),
      });
    }

    // 3. Update framing stats
    if (result.triggerContext) {
      const framing = inferFraming(result.messages);
      if (framing) {
        await fetch(`${ApiConfig.SUPABASE_URL}/rest/v1/rpc/increment_framing_stat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            p_user_id: result.userId,
            p_framing: framing,
            p_resisted: result.outcome === 'resisted',
          }),
        });
      }
    }

    // 4. Generate session report (async, non-blocking)
    generateSessionReport(result, event.id);
  } catch {
    // Silently fail — offline sync will handle this later
  }
}

async function generateSessionReport(result: SessionResult, cravingEventId: string | null): Promise<void> {
  let nonEmptyMessages = result.messages.filter((m) => m.content.length > 0);
  if (nonEmptyMessages.length < 2) {
    console.warn('[REPORT] Skipping — fewer than 2 messages');
    return;
  }

  // Truncate to last 30 messages to avoid 500 errors on large transcripts
  if (nonEmptyMessages.length > 30) {
    nonEmptyMessages = nonEmptyMessages.slice(-30);
  }

  console.warn(`[REPORT] Generating report from ${nonEmptyMessages.length} messages...`);

  try {
    const res = await fetch(`${ApiConfig.CHAT_URL}/session/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: nonEmptyMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        outcome: result.outcome,
        triggerContext: result.triggerContext,
        cravingEventId,
        userId: result.userId,
      }),
    });

    if (!res.ok) {
      console.warn(`[REPORT] Server returned ${res.status}`);
      return;
    }
    const { report } = await res.json();
    if (!report) {
      console.warn('[REPORT] No report in response');
      return;
    }

    console.warn('[REPORT] Report generated, saving locally...');
    await saveReportLocally(report);
    console.warn('[REPORT] Profile updated.');
  } catch (err) {
    console.warn('[REPORT] Failed:', err);
  }
}

async function saveReportLocally(report: any): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const { useSessionStore } = await import('../stores/sessionStore');

  // Append to local reports list (keep last 20)
  const existing = await AsyncStorage.getItem('bb_session_reports');
  const reports: any[] = existing ? JSON.parse(existing) : [];
  reports.unshift({ ...report, created_at: new Date().toISOString() });
  if (reports.length > 20) reports.length = 20;
  await AsyncStorage.setItem('bb_session_reports', JSON.stringify(reports));

  // Build an updated profile from all local reports
  const profile = buildLocalProfile(reports);
  useSessionStore.getState().setProfileSummary(profile.summary);
  useSessionStore.getState().setRecentHistory(profile.recentHistory);
}

export function buildLocalProfile(reports: any[]): { summary: string; recentHistory: string } {
  if (reports.length === 0) return { summary: 'New user — no history yet.', recentHistory: 'First session.' };

  const parts: string[] = [];

  // Extract ALL facts across all reports (most recent value wins for scalar fields)
  const facts: Record<string, string | null> = {};
  const lifeEvents: string[] = [];
  const allHelped: string[] = [];
  const copingStyles: string[] = [];

  for (const r of reports) {
    const kf = r.key_facts_learned || r.preferences?.key_facts_learned;
    if (kf) {
      // Scalar fields — first non-null wins (reports are newest-first)
      const scalarFields = [
        'name', 'preferred_name', 'age', 'location', 'occupation', 'family',
        'cigarettes_per_day', 'vapes_per_day', 'urges_per_day', 'longest_quit',
        'quit_reason', 'addiction_type', 'smoking_history', 'health_concerns',
        'previous_quit_attempts',
      ];
      for (const field of scalarFields) {
        if (kf[field] && !facts[field]) facts[field] = String(kf[field]);
      }

      if (kf.life_events) {
        for (const e of kf.life_events) {
          if (e && !lifeEvents.includes(e)) lifeEvents.push(e);
        }
      }
    }

    if (r.what_helped) {
      for (const h of r.what_helped) {
        if (h && !allHelped.includes(h)) allHelped.push(h);
      }
    }

    const style = r.preferences?.coping_style;
    if (style && !copingStyles.includes(style)) copingStyles.push(style);
  }

  // Build the profile — include everything we know
  const name = facts.preferred_name || facts.name;
  if (name) parts.push(`Name: ${name}.`);
  if (facts.age) parts.push(`Age: ${facts.age}.`);
  if (facts.occupation) parts.push(`Occupation: ${facts.occupation}.`);
  if (facts.family) parts.push(`Family: ${facts.family}.`);
  if (facts.location) parts.push(`Location: ${facts.location}.`);
  if (facts.addiction_type) parts.push(`Battling: ${facts.addiction_type}.`);
  if (facts.smoking_history) parts.push(`Nicotine history: ${facts.smoking_history}.`);
  if (facts.cigarettes_per_day) parts.push(`Baseline: ${facts.cigarettes_per_day} cigarettes/day.`);
  if (facts.vapes_per_day) parts.push(`Baseline: ${facts.vapes_per_day} vapes/day.`);
  if (facts.quit_reason) parts.push(`Reason for quitting: ${facts.quit_reason}.`);
  if (facts.health_concerns) parts.push(`Health concerns: ${facts.health_concerns}.`);
  if (facts.previous_quit_attempts) parts.push(`Previous attempts: ${facts.previous_quit_attempts}.`);
  if (lifeEvents.length > 0) parts.push(`Personal details: ${lifeEvents.slice(0, 5).join('; ')}.`);
  parts.push(`${reports.length} sessions logged.`);
  if (allHelped.length > 0) parts.push(`What works: ${allHelped.slice(0, 3).join(', ')}.`);
  if (copingStyles.length > 0) parts.push(`Preferred coping: ${copingStyles[0]}.`);
  if (facts.longest_quit) parts.push(`Longest quit: ${facts.longest_quit}.`);
  if (reports[0]?.next_session_hint) parts.push(`Hint: ${reports[0].next_session_hint}`);

  const recentHistory = reports.slice(0, 3)
    .map((r: any, i: number) => `${i === 0 ? 'Last session' : `${i + 1} sessions ago`}: ${r.summary}`)
    .join('\n');

  return { summary: parts.join(' '), recentHistory };
}

export const LAST_OUTCOME_KEY = 'bb_last_outcome';

export interface LastOutcome {
  outcome: 'resisted' | 'gave_in';
  timestamp: string;
}

export async function recordSessionOutcome(
  userId: string,
  outcome: 'resisted' | 'gave_in',
): Promise<void> {
  const timestamp = new Date().toISOString();

  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(
    LAST_OUTCOME_KEY,
    JSON.stringify({ outcome, timestamp } satisfies LastOutcome),
  ).catch(() => {});

  try {
    await fetch(`${ApiConfig.CHAT_URL}/context/session-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, outcome, timestamp }),
    });
  } catch {
    // Offline — local storage already has it
  }
}

function inferFraming(messages: SessionMessage[]): string | null {
  const assistantText = messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content.toLowerCase())
    .join(' ');

  if (assistantText.includes('gain') || assistantText.includes('freedom') || assistantText.includes('saving')) {
    return 'encouragement';
  }
  if (assistantText.includes('distract') || assistantText.includes('song') || assistantText.includes('video')) {
    return 'distraction';
  }
  if (assistantText.includes('learn') || assistantText.includes('understand') || assistantText.includes('pattern')) {
    return 'education';
  }
  return 'encouragement';
}
