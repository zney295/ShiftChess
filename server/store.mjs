import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** One durable snapshot per room; sessions contain only SHA-256 token digests. */
export class RoomStore {
  constructor(path) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, snapshot TEXT NOT NULL, updated_at INTEGER NOT NULL);
      PRAGMA user_version=1;`);
    this.upsert = this.db.prepare(
      "INSERT INTO rooms VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET snapshot=excluded.snapshot, updated_at=excluded.updated_at",
    );
    this.remove = this.db.prepare("DELETE FROM rooms WHERE code=?");
  }
  save(room) {
    const snapshot = {
      ...room,
      match: room.match?.snapshot(),
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        token: p.token,
        code: p.code,
        ready: p.ready,
        accepted: p.accepted,
        rematch: p.rematch,
      })),
    };
    delete snapshot.timer;
    delete snapshot.watchers;
    this.upsert.run(room.code, JSON.stringify(snapshot), Date.now());
  }
  load() {
    return this.db
      .prepare("SELECT snapshot FROM rooms")
      .all()
      .map((row) => JSON.parse(row.snapshot));
  }
  delete(code) {
    this.remove.run(code);
  }
  close() {
    this.db.close();
  }
}
