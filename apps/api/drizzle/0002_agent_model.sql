CREATE TABLE IF NOT EXISTS household_agent_models (
  household_id TEXT PRIMARY KEY REFERENCES households(id),
  provider TEXT NOT NULL,
  model TEXT,
  base_url TEXT,
  api_key_cipher TEXT,
  updated_at TEXT NOT NULL
);
