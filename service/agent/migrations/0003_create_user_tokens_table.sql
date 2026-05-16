-- Migration number: 0003 
CREATE TABLE IF NOT EXISTS user_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_user_tokens_type ON user_tokens (type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tokens_user_id_type ON user_tokens (user_id, type);