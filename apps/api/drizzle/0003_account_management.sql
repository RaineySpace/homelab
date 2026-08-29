ALTER TABLE accounts ADD COLUMN person_id TEXT REFERENCES people(id);
ALTER TABLE accounts ADD COLUMN disabled_at TEXT;

CREATE UNIQUE INDEX accounts_single_owner
  ON accounts(role)
  WHERE role = 'owner';

CREATE UNIQUE INDEX accounts_person_unique
  ON accounts(person_id)
  WHERE person_id IS NOT NULL;
