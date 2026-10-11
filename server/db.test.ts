import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from './db';

describe('migración', () => {
  it('rellena nick_key en una base anterior, también con apodos que chocan', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'db-')), 'a.db');
    const old = new DatabaseSync(path);
    old.exec('CREATE TABLE players (id TEXT PRIMARY KEY, nickname TEXT NOT NULL UNIQUE COLLATE NOCASE, secret_hash TEXT NOT NULL, best_level INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)');
    old.exec("INSERT INTO players (id, nickname, secret_hash, created_at) VALUES ('a','Ana','x',1),('b','A.na','x',2)");
    old.close();
    const db = openDb(path);
    const rows = db.prepare('SELECT id, nick_key FROM players ORDER BY id').all() as { id: string; nick_key: string }[];
    expect(rows[0].nick_key).toBe('ana');
    expect(rows[1].nick_key).not.toBe('ana');
    openDb(path).close();
  });
});
