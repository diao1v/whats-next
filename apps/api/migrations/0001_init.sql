CREATE TABLE users (
  id TEXT PRIMARY KEY,          -- Clerk user id
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  company_name TEXT NOT NULL,
  is_agency INTEGER NOT NULL DEFAULT 0,
  agency_name TEXT,
  job_title TEXT NOT NULL,
  role TEXT NOT NULL,
  level TEXT,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_period TEXT,
  salary_raw_text TEXT,
  location TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  url TEXT NOT NULL,
  apply_url TEXT,
  source_site TEXT,
  snapshot TEXT,
  raw_content_key TEXT,
  source_method TEXT,
  extraction_model TEXT,
  stage TEXT NOT NULL DEFAULT 'Saved',
  import_status TEXT NOT NULL DEFAULT 'importing',
  applied_date TEXT,
  next_action_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_jobs_user_stage ON jobs(user_id, stage);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE job_skills (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  raw_label TEXT NOT NULL,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_job ON events(job_id);
