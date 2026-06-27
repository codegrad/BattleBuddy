import * as SQLite from 'expo-sqlite';

export interface LocalMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: 'text' | 'voice' | 'idle';
  timestamp: number;
  synced: 0 | 1;
}

export interface LocalCravingEvent {
  id: string;
  user_id: string;
  started_at: number;
  ended_at: number | null;
  mode: 'text' | 'voice';
  outcome: 'resisted' | 'gave_in' | 'unsure' | null;
  helped: 0 | 1 | null;
  intensity_start: number | null;
  intensity_end: number | null;
  trigger_context: string | null; // JSON string
  synced: 0 | 1;
}

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('battlebuddy');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      mode TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS craving_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      mode TEXT NOT NULL DEFAULT 'text',
      outcome TEXT,
      helped INTEGER,
      intensity_start INTEGER,
      intensity_end INTEGER,
      trigger_context TEXT,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_unsynced ON messages(synced) WHERE synced = 0;
    CREATE INDEX IF NOT EXISTS idx_events_unsynced ON craving_events(synced) WHERE synced = 0;
  `);
  return db;
}

// --- Messages CRUD ---

export async function insertMessage(msg: Omit<LocalMessage, 'synced'>): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    'INSERT OR REPLACE INTO messages (id, session_id, role, content, mode, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, 0)',
    msg.id,
    msg.session_id,
    msg.role,
    msg.content,
    msg.mode,
    msg.timestamp,
  );
}

export async function updateMessageContent(id: string, content: string): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    'UPDATE messages SET content = ?, synced = 0 WHERE id = ?',
    content,
    id,
  );
}

export async function getUnsyncedMessages(): Promise<LocalMessage[]> {
  const d = await getDb();
  return d.getAllAsync<LocalMessage>(
    'SELECT * FROM messages WHERE synced = 0 ORDER BY timestamp ASC',
  );
}

export async function markMessagesSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const d = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await d.runAsync(
    `UPDATE messages SET synced = 1 WHERE id IN (${placeholders})`,
    ...ids,
  );
}

// --- Craving Events CRUD ---

export async function insertCravingEvent(event: Omit<LocalCravingEvent, 'synced'>): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO craving_events
     (id, user_id, started_at, ended_at, mode, outcome, helped, intensity_start, intensity_end, trigger_context, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    event.id,
    event.user_id,
    event.started_at,
    event.ended_at ?? null,
    event.mode,
    event.outcome ?? null,
    event.helped ?? null,
    event.intensity_start ?? null,
    event.intensity_end ?? null,
    event.trigger_context ?? null,
  );
}

export async function updateCravingEvent(
  id: string,
  fields: Partial<Pick<LocalCravingEvent, 'ended_at' | 'outcome' | 'helped' | 'intensity_end'>>,
): Promise<void> {
  const d = await getDb();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (fields.ended_at !== undefined) { sets.push('ended_at = ?'); vals.push(fields.ended_at); }
  if (fields.outcome !== undefined) { sets.push('outcome = ?'); vals.push(fields.outcome); }
  if (fields.helped !== undefined) { sets.push('helped = ?'); vals.push(fields.helped); }
  if (fields.intensity_end !== undefined) { sets.push('intensity_end = ?'); vals.push(fields.intensity_end); }

  if (sets.length === 0) return;

  sets.push('synced = 0');
  vals.push(id);

  await d.runAsync(
    `UPDATE craving_events SET ${sets.join(', ')} WHERE id = ?`,
    ...vals,
  );
}

export async function getUnsyncedCravingEvents(): Promise<LocalCravingEvent[]> {
  const d = await getDb();
  return d.getAllAsync<LocalCravingEvent>(
    'SELECT * FROM craving_events WHERE synced = 0 ORDER BY started_at ASC',
  );
}

export async function markEventsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const d = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await d.runAsync(
    `UPDATE craving_events SET synced = 1 WHERE id IN (${placeholders})`,
    ...ids,
  );
}

export async function getSessionMessages(sessionId: string): Promise<LocalMessage[]> {
  const d = await getDb();
  return d.getAllAsync<LocalMessage>(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
    sessionId,
  );
}
