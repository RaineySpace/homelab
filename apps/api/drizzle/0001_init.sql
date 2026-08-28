-- Family OS initial schema

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  sex TEXT,
  birth_year INTEGER,
  birth_month INTEGER,
  birth_day INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS people_household_idx ON people(household_id);

CREATE TABLE IF NOT EXISTS person_revisions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id),
  household_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  unit TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ingredients_household_name_active
  ON ingredients (household_id, name)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  title TEXT NOT NULL,
  cooking_minutes INTEGER NOT NULL,
  servings INTEGER NOT NULL,
  steps_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity REAL NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS meal_drafts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  meal_type TEXT NOT NULL,
  diner_person_ids_json TEXT NOT NULL,
  mode TEXT NOT NULL,
  max_cooking_minutes INTEGER,
  selection_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  recipe_ids_json TEXT NOT NULL,
  explanation TEXT,
  meal_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  meal_draft_id TEXT NOT NULL REFERENCES meal_drafts(id),
  meal_type TEXT NOT NULL,
  diner_person_ids_json TEXT NOT NULL,
  recipe_ids_json TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_ratings (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id),
  person_id TEXT NOT NULL REFERENCES people(id),
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (meal_id, person_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  title TEXT NOT NULL,
  notes TEXT,
  assignee_person_id TEXT REFERENCES people(id),
  due_at TEXT,
  status TEXT NOT NULL,
  completed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  household_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  household_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (household_id, account_id, key)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  command TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
