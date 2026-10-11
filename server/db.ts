import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { nickKey } from './nick';
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

    -- Estadísticas anónimas de partidas (sin jugador, sin IP, solo el día). Ver server/stats.ts.
    CREATE TABLE IF NOT EXISTS stats (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      day     TEXT NOT NULL,
      mode    TEXT NOT NULL,
      rules   INTEGER NOT NULL,
      build   TEXT NOT NULL,
      "end"   TEXT NOT NULL,
      level   INTEGER NOT NULL,
      score   INTEGER NOT NULL,
      lines   INTEGER NOT NULL,
      secs    INTEGER NOT NULL,
      revives INTEGER NOT NULL,
      hyper   TEXT,
      picks   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stats_day ON stats (day);

    CREATE TABLE IF NOT EXISTS replays (
      run_id INTEGER PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
      data   BLOB NOT NULL
    );
  `);
  // clave normalizada del apodo (contra suplantaciones): se añade a las bases anteriores y se rellena
  const cols = db.prepare('PRAGMA table_info(players)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'nick_key')) {
    db.exec('ALTER TABLE players ADD COLUMN nick_key TEXT');
    const seen = new Set<string>();
    const set = db.prepare('UPDATE players SET nick_key = ? WHERE id = ?');
    for (const r of db.prepare('SELECT id, nickname FROM players ORDER BY created_at').all() as { id: string; nickname: string }[]) {
      let k = nickKey(r.nickname);
      if (seen.has(k)) k = `${k}#${r.id}`; // choque entre apodos ya existentes: el más antiguo conserva la clave
      seen.add(k);
      set.run(k, r.id);
    }
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS players_nick_key ON players (nick_key)');
  return db;
}
