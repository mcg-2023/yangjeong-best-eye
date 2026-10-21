CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX posts_status_updated_idx ON posts (status, updated_at);
