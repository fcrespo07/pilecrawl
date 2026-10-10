import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Abre (y crea si falta) la base de datos. `:memory:` para las pruebas. */
export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      nickname    TEXT NOT NULL UNIQUE COLLATE NOCASE,
      secret_hash TEXT NOT NULL,
      best_level  INTEGER NOT NULL DEFAULT 0,
      hidden      INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    -- Partidas que el servidor ha empezado: la semilla la pone él y cada una vale una sola vez.
    CREATE TABLE IF NOT EXISTS starts (
      id         TEXT PRIMARY KEY,
      player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      mode       TEXT NOT NULL,
      seed       INTEGER NOT NULL,
      best_level INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0
    );

    -- Toda partida aceptada. Solo metadatos: la repetición se guarda aparte y solo si es una mejor.
    CREATE TABLE IF NOT EXISTS runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      mode        TEXT NOT NULL,
      period      TEXT NOT NULL,
      seed        INTEGER NOT NULL,
      version     INTEGER NOT NULL,
      score       INTEGER NOT NULL,
      level       INTEGER NOT NULL,
      lines       INTEGER NOT NULL,
      steps       INTEGER NOT NULL,
      hash        TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS runs_hash ON runs (mode, period, hash);

    -- Mejor puntuación de cada jugador por modo y ámbito: 'all', 'w:AAAA-MM-DD' (lunes) o 'd:AAAA-MM-DD'.
    CREATE TABLE IF NOT EXISTS bests (
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      mode      TEXT NOT NULL,
      scope     TEXT NOT NULL,
      score     INTEGER NOT NULL,
      level     INTEGER NOT NULL,
      lines     INTEGER NOT NULL,
      run_id    INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      PRIMARY KEY (player_id, mode, scope)
    );
    CREATE INDEX IF NOT EXISTS bests_rank ON bests (mode, scope, score DESC);

    CREATE TABLE IF NOT EXISTS replays (
      run_id INTEGER PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
      data   BLOB NOT NULL
    );
  `);
  return db;
}
