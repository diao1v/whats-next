-- Reset job storage to the shared-posting + per-user-entry split.
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS job_skills;
DROP TABLE IF EXISTS jobs;

CREATE TABLE job_postings (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT '',
  is_agency INTEGER NOT NULL DEFAULT 0,
  agency_name TEXT,
  job_title TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  level TEXT,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_period TEXT,
  salary_raw_text TEXT,
  location TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  apply_url TEXT,
  source_site TEXT,
  description TEXT,
  snapshot TEXT,
  raw_content_key TEXT,
  source_method TEXT,
  extraction_model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE job_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  submitted_url TEXT NOT NULL,
  posting_id TEXT REFERENCES job_postings(id),
  import_status TEXT NOT NULL DEFAULT 'importing',
  stage TEXT NOT NULL DEFAULT 'Saved',
  applied_date TEXT,
  next_action_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, posting_id)
);
CREATE INDEX idx_entries_user ON job_entries(user_id);
CREATE INDEX idx_entries_user_stage ON job_entries(user_id, stage);

CREATE TABLE posting_skills (
  posting_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  raw_label TEXT NOT NULL,
  PRIMARY KEY (posting_id, skill_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES job_entries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_entry ON events(entry_id);
