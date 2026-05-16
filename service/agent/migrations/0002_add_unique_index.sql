-- Migration number: 0002
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_summaries_user_target_date ON progress_summaries(user_id, target_date);
