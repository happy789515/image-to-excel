CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_projects_owner_updated ON projects (owner, updated_at DESC);

CREATE TABLE images (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  position INTEGER NOT NULL,
  detection_threshold REAL,
  empty_hint INTEGER,
  selected_id TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE TABLE sheets (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  rows_json TEXT,
  extract_signature TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE TABLE tables (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  sheet_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  xmin REAL NOT NULL,
  ymin REAL NOT NULL,
  xmax REAL NOT NULL,
  ymax REAL NOT NULL,
  position INTEGER NOT NULL,
  sheet_manual INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
  FOREIGN KEY (sheet_id) REFERENCES sheets (id) ON DELETE SET NULL
);

CREATE INDEX idx_images_project ON images (project_id, position);
CREATE INDEX idx_tables_project ON tables (project_id);
CREATE INDEX idx_tables_image ON tables (image_id, position);
CREATE INDEX idx_tables_sheet ON tables (sheet_id);
CREATE INDEX idx_sheets_project ON sheets (project_id, position);