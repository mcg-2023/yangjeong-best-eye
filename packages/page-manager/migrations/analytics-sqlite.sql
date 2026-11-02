CREATE TABLE IF NOT EXISTS pm_analytics_sites (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pm_analytics_hits (
 id TEXT PRIMARY KEY, site_id TEXT NOT NULL, visitor_id TEXT NOT NULL,
 session_id TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pm_hits_site_time ON pm_analytics_hits(site_id,created_at);
CREATE INDEX IF NOT EXISTS pm_hits_time ON pm_analytics_hits(created_at);
CREATE INDEX IF NOT EXISTS pm_hits_session ON pm_analytics_hits(session_id,site_id);
CREATE TABLE IF NOT EXISTS pm_analytics_visitors (
 site_id TEXT NOT NULL, visitor_id TEXT NOT NULL, first_seen_at TEXT NOT NULL,
 PRIMARY KEY(site_id,visitor_id)
);
