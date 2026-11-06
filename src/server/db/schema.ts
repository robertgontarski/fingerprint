import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL REFERENCES visitors (id),
    site TEXT NOT NULL,
    created_at TEXT NOT NULL,
    components TEXT NOT NULL,
    noised_components TEXT NOT NULL,
    brave INTEGER NOT NULL CHECK (brave IN (0, 1)),
    stable_key TEXT NOT NULL,
    full_key TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS observations_by_visitor ON observations (visitor_id);
  CREATE TABLE IF NOT EXISTS visitor_links (
    from_visitor TEXT NOT NULL REFERENCES visitors (id),
    to_visitor TEXT NOT NULL REFERENCES visitors (id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (from_visitor, to_visitor)
  );
  CREATE TABLE IF NOT EXISTS person_links (
    visitor_id TEXT NOT NULL REFERENCES visitors (id),
    person_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (visitor_id, person_id)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site TEXT NOT NULL,
    person_id TEXT NOT NULL,
    visitor_id TEXT REFERENCES visitors (id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS used_handoff_tokens (
    token_id TEXT PRIMARY KEY,
    used_at TEXT NOT NULL
  );
`;

export const openDatabase = (path: string): DatabaseSync => {
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  database.exec(SCHEMA);
  return database;
};
