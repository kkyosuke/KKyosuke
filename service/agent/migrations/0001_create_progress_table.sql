-- Migration number: 0001 	 2026-05-16T05:38:15.207Z
CREATE TABLE IF NOT EXISTS progress_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_date TEXT NOT NULL,
  progress_percent INTEGER NOT NULL,
  evaluation_score INTEGER NOT NULL,
  summary_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_progress_summaries_user_id_created_at ON progress_summaries(user_id, created_at DESC);
