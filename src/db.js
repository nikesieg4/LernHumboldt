import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new Database(path.join(config.dataDir, 'lernseite.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  email       TEXT,
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'student',   -- student | teacher | admin
  klasse      TEXT,
  iserv_roles TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);
CREATE TABLE IF NOT EXISTS roster (
  email   TEXT PRIMARY KEY,                       -- immer klein geschrieben
  name    TEXT,
  klasse  TEXT
);
CREATE TABLE IF NOT EXISTS progress (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug     TEXT NOT NULL,                         -- Lektion (z. B. "dioden-schaltung") oder "verstanden:<thema>"
  done_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, slug)
);
-- Jeder Versuch bei einer Übung. "revealed" = Lösung wurde angezeigt.
CREATE TABLE IF NOT EXISTS attempts (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  TEXT NOT NULL,
  topic_id     TEXT NOT NULL,
  correct      INTEGER NOT NULL DEFAULT 0,
  revealed     INTEGER NOT NULL DEFAULT 0,
  answer       TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS attempts_user ON attempts (user_id, exercise_id);
`);

// Eine Übung gilt als gelöst, wenn sie richtig beantwortet wurde, bevor die Lösung angezeigt wurde.
const SOLVED = `SELECT DISTINCT a.user_id, a.exercise_id FROM attempts a
  WHERE a.correct = 1 AND NOT EXISTS (SELECT 1 FROM attempts r WHERE r.user_id = a.user_id
    AND r.exercise_id = a.exercise_id AND r.revealed = 1 AND r.id < a.id)`;
const UNDERSTOOD_PREFIX = 'verstanden:';

export const q = {
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  insertUser: db.prepare(`INSERT INTO users (username, email, name, role, klasse, iserv_roles, last_login)
                          VALUES (@username, @email, @name, @role, @klasse, @iserv_roles, datetime('now'))`),
  updateUser: db.prepare(`UPDATE users SET email=@email, name=@name, role=@role, klasse=@klasse,
                          iserv_roles=@iserv_roles, last_login=datetime('now') WHERE id=@id`),
  allUsers: db.prepare('SELECT * FROM users ORDER BY role DESC, klasse, name'),

  rosterByEmail: db.prepare('SELECT * FROM roster WHERE email = ?'),
  allRoster: db.prepare('SELECT * FROM roster ORDER BY klasse, name'),
  insertRoster: db.prepare('INSERT OR REPLACE INTO roster (email, name, klasse) VALUES (?, ?, ?)'),
  clearRoster: db.prepare('DELETE FROM roster'),
  classes: db.prepare(`SELECT DISTINCT klasse FROM (SELECT klasse FROM roster UNION SELECT klasse FROM users)
                       WHERE klasse IS NOT NULL AND klasse <> '' ORDER BY klasse`),

  progressOf: db.prepare('SELECT slug, done_at FROM progress WHERE user_id = ?'),
  setDone: db.prepare('INSERT OR IGNORE INTO progress (user_id, slug) VALUES (?, ?)'),
  unsetDone: db.prepare('DELETE FROM progress WHERE user_id = ? AND slug = ?'),
  studentsOfClass: db.prepare(`SELECT * FROM users WHERE role = 'student' AND klasse = ? ORDER BY name`),
  allProgress: db.prepare('SELECT user_id, slug, done_at FROM progress'),

  insertAttempt: db.prepare(`INSERT INTO attempts (user_id, exercise_id, topic_id, correct, revealed, answer)
                             VALUES (@user_id, @exercise_id, @topic_id, @correct, @revealed, @answer)`),
  solvedOf: db.prepare(`SELECT exercise_id FROM (${SOLVED}) WHERE user_id = ?`),
  solvedOfClass: db.prepare(`SELECT s.user_id, s.exercise_id FROM (${SOLVED}) s JOIN users u ON u.id = s.user_id
                             WHERE u.role = 'student' AND u.klasse = ?`),
  attemptStatsOf: db.prepare(`SELECT exercise_id, COUNT(*) AS versuche, SUM(correct) AS richtig, MAX(revealed) AS aufgedeckt
                              FROM attempts WHERE user_id = ? AND topic_id = ? GROUP BY exercise_id`),
  understoodOf: db.prepare(`SELECT substr(slug, ${UNDERSTOOD_PREFIX.length + 1}) AS topic_id FROM progress
                            WHERE user_id = ? AND slug LIKE '${UNDERSTOOD_PREFIX}%'`),
  understoodOfClass: db.prepare(`SELECT p.user_id, substr(p.slug, ${UNDERSTOOD_PREFIX.length + 1}) AS topic_id FROM progress p
                                 JOIN users u ON u.id = p.user_id WHERE u.role = 'student' AND u.klasse = ? AND p.slug LIKE '${UNDERSTOOD_PREFIX}%'`),
};

export const understoodSlug = topicId => UNDERSTOOD_PREFIX + topicId;

/** Gelöste Übungen und verstandene Themen eines Benutzers als Sets. */
export function progressSets(userId) {
  return {
    solved: new Set(q.solvedOf.all(userId).map(r => r.exercise_id)),
    understood: new Set(q.understoodOf.all(userId).map(r => r.topic_id)),
  };
}

/** Ersetzt die komplette Schülerliste in einem Rutsch und aktualisiert die Klassen bestehender Konten. */
export const replaceRoster = db.transaction(rows => {
  q.clearRoster.run();
  for (const r of rows) q.insertRoster.run(r.email, r.name, r.klasse);
  db.prepare(`UPDATE users SET klasse = (SELECT klasse FROM roster WHERE roster.email = lower(users.email))
              WHERE role = 'student' AND lower(email) IN (SELECT email FROM roster)`).run();
});
