import { ApiConfig } from '../config';

export interface UserProfile {
  summary: string;
  recentHistory: string;
  streak: number;
  totalSessions: number;
  resistRate: number;
  topMedia: string[];
  preferredFraming: string | null;
  hardestTime: string | null;
  preferredMode: string | null;
}

const EMPTY_PROFILE: UserProfile = {
  summary: 'New user — no history yet.',
  recentHistory: 'First message in this session.',
  streak: 0,
  totalSessions: 0,
  resistRate: 0,
  topMedia: [],
  preferredFraming: null,
  hardestTime: null,
  preferredMode: null,
};

export async function fetchUserProfile(_userId: string | null): Promise<UserProfile> {
  // Always check local profile first (works without auth)
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const { useSessionStore } = await import('../stores/sessionStore');
    const state = useSessionStore.getState();
    if (state.profileSummary && !state.profileSummary.includes('New user')) {
      return {
        ...EMPTY_PROFILE,
        summary: state.profileSummary,
        recentHistory: state.recentHistory,
      };
    }
  } catch {}

  if (!_userId || !ApiConfig.SUPABASE_URL || !ApiConfig.SUPABASE_ANON_KEY) {
    return EMPTY_PROFILE;
  }

  try {
    const headers = {
      apikey: ApiConfig.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${ApiConfig.SUPABASE_ANON_KEY}`,
    };

    // Try the pre-computed context profile first (written by batch profiler — cheap to read)
    const contextRes = await fetch(
      `${ApiConfig.SUPABASE_URL}/rest/v1/user_context_profiles?user_id=eq.${_userId}&select=profile_text,journey_position,trajectory,what_works,risk_fingerprint`,
      { headers },
    );
    const [contextProfile] = contextRes.ok ? await contextRes.json() : [];

    const [eventsRes, framingRes, reportsRes] = await Promise.all([
      fetch(
        `${ApiConfig.SUPABASE_URL}/rest/v1/craving_events?user_id=eq.${_userId}&select=outcome,mode,started_at,intensity_start,intensity_end&order=started_at.desc&limit=100`,
        { headers },
      ),
      fetch(
        `${ApiConfig.SUPABASE_URL}/rest/v1/user_framing_stats?user_id=eq.${_userId}&select=framing,shown_count,resisted_after&order=resisted_after.desc&limit=4`,
        { headers },
      ),
      fetch(
        `${ApiConfig.SUPABASE_URL}/rest/v1/session_reports?user_id=eq.${_userId}&select=summary,next_session_hint,what_helped,preferences,trigger_type,emotional_arc,created_at&order=created_at.desc&limit=5`,
        { headers },
      ),
    ]);

    const events: any[] = eventsRes.ok ? await eventsRes.json() : [];
    const framingStats: any[] = framingRes.ok ? await framingRes.json() : [];
    const reports: any[] = reportsRes.ok ? await reportsRes.json() : [];

    // If batch profiler has run, use its pre-computed text as the base
    if (contextProfile?.profile_text && contextProfile.profile_text !== 'New user — no history yet.') {
      return {
        summary: contextProfile.profile_text,
        recentHistory: buildRecentHistory(reports),
        streak: 0, // batch profile doesn't expose this separately; compute below as fallback
        totalSessions: events.length,
        resistRate: events.length > 0 ? Math.round((events.filter((e: any) => e.outcome === 'resisted').length / events.length) * 100) : 0,
        topMedia: [],
        preferredFraming: contextProfile.what_works?.framings?.[0] || null,
        hardestTime: contextProfile.risk_fingerprint?.time_risks?.[0] || null,
        preferredMode: null,
      };
    }

    if (events.length === 0) return EMPTY_PROFILE;

    const total = events.length;
    const resisted = events.filter((e: any) => e.outcome === 'resisted').length;
    const resistRate = total > 0 ? Math.round((resisted / total) * 100) : 0;

    let streak = 0;
    for (const e of events) {
      if (e.outcome === 'resisted') streak++;
      else break;
    }

    const textCount = events.filter((e: any) => e.mode === 'text').length;
    const voiceCount = events.filter((e: any) => e.mode === 'voice').length;
    const preferredMode = textCount > voiceCount * 1.5 ? 'text' : voiceCount > textCount * 1.5 ? 'voice' : null;

    const hourCounts: Record<number, number> = {};
    for (const e of events) {
      const h = new Date(e.started_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const hardestTime = peakHour ? formatHour(Number(peakHour[0])) : null;

    const preferredFraming = framingStats.length > 0 && framingStats[0].resisted_after > 0
      ? framingStats[0].framing
      : null;

    // Build profile from reports
    const reportInsights = buildReportInsights(reports);
    const summary = buildSummary({
      streak, total, resistRate, preferredFraming, hardestTime, preferredMode, reportInsights,
    });
    const recentHistory = buildRecentHistory(reports);

    return {
      summary,
      recentHistory,
      streak,
      totalSessions: total,
      resistRate,
      topMedia: [],
      preferredFraming,
      hardestTime,
      preferredMode,
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

function formatHour(h: number): string {
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

interface ReportInsights {
  copingStyle: string | null;
  topHelpers: string[];
  nextHint: string | null;
}

function buildReportInsights(reports: any[]): ReportInsights {
  if (reports.length === 0) return { copingStyle: null, topHelpers: [], nextHint: null };

  const helperCounts: Record<string, number> = {};
  for (const r of reports) {
    for (const h of r.what_helped || []) {
      helperCounts[h] = (helperCounts[h] || 0) + 1;
    }
  }
  const topHelpers = Object.entries(helperCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const copingStyle = reports[0]?.preferences?.coping_style || null;
  const nextHint = reports[0]?.next_session_hint || null;

  return { copingStyle, topHelpers, nextHint };
}

function buildSummary(data: {
  streak: number;
  total: number;
  resistRate: number;
  preferredFraming: string | null;
  hardestTime: string | null;
  preferredMode: string | null;
  reportInsights: ReportInsights;
}): string {
  const parts: string[] = [];

  if (data.total === 0) return 'New user — no history yet.';

  parts.push(`${data.total} sessions logged, ${data.resistRate}% resist rate.`);

  if (data.streak > 0) {
    parts.push(`Current streak: ${data.streak} resists in a row.`);
  }

  if (data.reportInsights.topHelpers.length > 0) {
    parts.push(`What works: ${data.reportInsights.topHelpers.join(', ')}.`);
  }

  if (data.reportInsights.copingStyle) {
    parts.push(`Preferred coping: ${data.reportInsights.copingStyle}.`);
  }

  if (data.preferredFraming) {
    parts.push(`Responds well to: ${data.preferredFraming} framing.`);
  }

  if (data.hardestTime) {
    parts.push(`Hardest time: around ${data.hardestTime}.`);
  }

  if (data.preferredMode) {
    parts.push(`Prefers ${data.preferredMode} mode.`);
  }

  if (data.reportInsights.nextHint) {
    parts.push(`Hint for this session: ${data.reportInsights.nextHint}`);
  }

  return parts.join(' ');
}

function buildRecentHistory(reports: any[]): string {
  if (reports.length === 0) return 'First session with this user.';

  const summaries = reports.slice(0, 3).map((r: any, i: number) => {
    const ago = i === 0 ? 'Last session' : `${i + 1} sessions ago`;
    return `${ago}: ${r.summary}`;
  });

  return summaries.join('\n');
}
