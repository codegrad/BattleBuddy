-- Append-only ledger for builder credit (SPC) entries. D1 / SQLite.
-- Append-only by construction: no ALTER, no DROP, no UPDATE, no DELETE.

CREATE TABLE IF NOT EXISTS ledger_entry (
  id         TEXT    PRIMARY KEY,
  builder_id TEXT    NOT NULL,
  room_id    TEXT    NOT NULL,
  wr_id      TEXT    NOT NULL,
  amount     INTEGER NOT NULL,
  kind       TEXT    NOT NULL CHECK (kind IN ('earn', 'adjust')),
  currency   TEXT    NOT NULL DEFAULT 'SPC',
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_entry_builder_id
  ON ledger_entry (builder_id);
