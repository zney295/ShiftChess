import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createGameServer } from "../server/index.mjs";
import { command } from "../server/engine.mjs";
import { Match } from "../src/rules.ts";
import { newClock, resumeClock } from "../server/clock.mjs";
import { mkdtemp, readdir, unlink, rmdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function client(url) {
  const socket = new WebSocket(url),
    messages = [];
  socket.on("message", (raw) => messages.push(JSON.parse(raw)));
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return {
    socket,
    send: (message) => socket.send(JSON.stringify(message)),
    async next(predicate) {
      const end = Date.now() + 4000;
      while (Date.now() < end) {
        const at = messages.findIndex(predicate);
        if (at >= 0) return messages.splice(at, 1)[0];
        await new Promise((r) => setTimeout(r, 5));
      }
      throw new Error(
        "Timed out waiting for packet: " + JSON.stringify(messages),
      );
    },
  };
}

test("server clock pauses on disconnect, then flags the active player for spectators too", async () => {
  const server = createGameServer({ port: 0, databasePath: ":memory:", clockMs: 750, graceMs: 2500 });
  await server.listen();
  const url = "ws://127.0.0.1:" + server.http.address().port + "/socket";
  try {
    const a = await client(url), b = await client(url), viewer = await client(url);
    a.send({ type: "create", name: "White" });
    const session = await a.next((m) => m.type === "session");
    const { room } = await a.next((m) => m.room?.phase === "waiting");
    viewer.send({ type: "watch", code: room.code });
    assert.equal((await viewer.next((m) => m.room?.phase === "waiting")).room.code, room.code);
    b.send({ type: "join", code: room.code, name: "Black" });
    await b.next((m) => m.type === "session");
    a.send({ type: "ready" });
    b.send({ type: "ready" });
    const briefing = await viewer.next((m) => m.room?.phase === "briefing");
    assert.equal(briefing.room.clock.deadline, null);
    a.send({ type: "accept" });
    b.send({ type: "accept" });
    const playing = await viewer.next((m) => m.room?.phase === "playing");
    assert.ok(playing.room.clock.deadline > playing.room.clock.serverNow);
    viewer.send({ type: "move", from: "e2", to: "e4", revision: 0 });
    assert.equal((await viewer.next((m) => m.type === "error")).key, "invalid");
    a.send({ type: "move", from: "e2", to: "e4", revision: 0 });
    const move = await viewer.next((m) => m.room?.revision === 1);
    assert.equal(move.room.state.plies, 1);
    a.socket.close();
    const paused = await viewer.next((m) => m.room?.phase === "playing" && m.room.clock.deadline === null);
    assert.ok(paused.room.clock.remaining.b > 0);
    await new Promise((resolve) => setTimeout(resolve, 850));
    assert.equal(server.rooms.get(room.code).phase, "playing");
    const resumed = await client(url);
    resumed.send({ type: "resume", token: session.token });
    const afterResume = await viewer.next((m) => m.room?.clock?.deadline > paused.room.clock.serverNow);
    assert.equal(afterResume.room.clock.remaining.b, paused.room.clock.remaining.b);
    const ended = await viewer.next((m) => m.room?.phase === "ended");
    assert.deepEqual(ended.room.result, { winner: "w", reason: "timeout" });
    assert.equal(ended.room.clock.remaining.b, 0);
    assert.equal(ended.room.revision, 1);
  } finally {
    await server.close();
  }
});
test("turn timeout sends exactly one legal move and starts the other clock", async () => {
  const server = createGameServer({ port: 0, databasePath: ":memory:", turnMs: 600 });
  await server.listen();
  const url = "ws://127.0.0.1:" + server.http.address().port + "/socket";
  try {
    const a = await client(url), b = await client(url);
    a.send({ type: "quick", name: "White" });
    await a.next((m) => m.room?.phase === "waiting");
    b.send({ type: "quick", name: "Black" });
    await a.next((m) => m.room?.phase === "briefing");
    a.send({ type: "accept" });
    b.send({ type: "accept" });
    const started = await a.next((m) => m.room?.phase === "playing");
    assert.equal(started.room.clock.turnMs, 600);
    const packet = await a.next((m) => m.automatic);
    assert.equal(packet.room.revision, 1);
    assert.equal(packet.room.state.plies, 1);
    assert.equal(packet.room.state.fen.split(" ")[1], "b");
    assert.equal(packet.room.clock.remaining.w, 300000 - 600);
    assert.equal(packet.room.clock.turnRemaining, 600);
    const other = await b.next((m) => m.automatic);
    assert.deepEqual(other.move, packet.move);
  } finally {
    await server.close();
  }
});

test("private room shares rules, rejects wrong turns, resumes and rematches", async () => {
  const server = createGameServer({ port: 0, databasePath: ":memory:" });
  await server.listen();
  const url = "ws://127.0.0.1:" + server.http.address().port + "/socket";
  try {
    const a = await client(url),
      b = await client(url);
    a.send({ type: "create", name: "Alice" });
    const session = await a.next((m) => m.type === "session");
    const { room } = await a.next((m) => m.type === "room");
    b.send({ type: "join", name: "Bob", code: room.code });
    await b.next((m) => m.type === "session");
    a.send({ type: "ready" });
    b.send({ type: "ready" });
    const intro = await a.next((m) => m.room?.phase === "briefing");
    const other = await b.next((m) => m.room?.phase === "briefing");
    assert.deepEqual(intro.room.state, other.room.state);
    assert.equal(intro.room.setting, other.room.setting);
    a.send({ type: "move", from: "e2", to: "e4", revision: 0 });
    assert.equal((await a.next((m) => m.type === "error")).key, "notYourTurn");
    a.send({ type: "accept" });
    b.send({ type: "accept" });
    await a.next((m) => m.room?.phase === "playing");
    await b.next((m) => m.room?.phase === "playing");
    b.send({ type: "move", from: "e7", to: "e5", revision: 0 });
    assert.equal((await b.next((m) => m.type === "error")).key, "notYourTurn");
    a.send({ type: "move", from: "e2", to: "e5", revision: 0 });
    assert.equal((await a.next((m) => m.type === "error")).key, "invalidMove");
    for (const [client, from, to, revision] of [
      [a, "e2", "e4", 0],
      [b, "d7", "d5", 1],
      [a, "e4", "d5", 2],
      [b, "g8", "f6", 3],
      [a, "b1", "c3", 4],
      [b, "f6", "d5", 5],
      [a, "c3", "d5", 6],
      [b, "d8", "d5", 7],
    ]) {
      client.send({ type: "move", from, to, revision });
      const x = await a.next((m) => m.room?.revision === revision + 1),
        y = await b.next((m) => m.room?.revision === revision + 1);
      assert.equal(x.room.state.fen, y.room.state.fen);
      assert.deepEqual(x.room.state.pending, y.room.state.pending);
    }
    assert.equal(server.rooms.get(room.code).match.plies, 8);
    a.socket.close();
    await new Promise((r) => a.socket.once("close", r));
    await b.next((m) => m.room?.players.some((p) => !p.connected));
    const resumed = await client(url);
    resumed.send({ type: "resume", token: session.token });
    await resumed.next((m) => m.type === "session");
    assert.equal(
      (await resumed.next((m) => m.type === "room")).room.revision,
      8,
    );
    resumed.send({ type: "resign" });
    await resumed.next((m) => m.room?.phase === "ended");
    await b.next((m) => m.room?.phase === "ended");
    resumed.send({ type: "rematch" });
    b.send({ type: "rematch" });
    const rematch = await resumed.next((m) => m.room?.phase === "briefing");
    assert.equal(rematch.room.players[0].color, "b");
    assert.equal(rematch.room.state.plies, 0);
    resumed.socket.close();
    b.socket.close();
  } finally {
    await server.close();
  }
});

test("quick match pairs only queued players; cancel frees the seat", async () => {
  const server = createGameServer({ port: 0, databasePath: ":memory:" });
  await server.listen();
  const url = "ws://127.0.0.1:" + server.http.address().port + "/socket";
  try {
    const a = await client(url),
      b = await client(url);
    a.send({ type: "quick", name: "A" });
    const first = await a.next((m) => m.type === "room");
    b.send({ type: "quick", name: "B" });
    const paired = await b.next((m) => m.room?.phase === "briefing");
    assert.equal(first.room.code, paired.room.code);
    a.send({ type: "leave" });
    await b.next((m) => m.room?.phase === "ended");
    b.send({ type: "leave" });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(server.rooms.size, 0);
    a.socket.close();
    b.socket.close();
  } finally {
    await server.close();
  }
});

test("server restart restores the exact board, announced SHIFT, and hashed guest sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shiftchess-test-")),
    databasePath = join(directory, "game.sqlite");
  let server = createGameServer({ port: 0, databasePath });
  await server.listen();
  let a, b;
  try {
    let url = "ws://127.0.0.1:" + server.http.address().port + "/socket";
    a = await client(url);
    b = await client(url);
    a.send({ type: "quick", name: "A" });
    const sessionA = await a.next((m) => m.type === "session");
    b.send({ type: "quick", name: "B" });
    const sessionB = await b.next((m) => m.type === "session");
    await a.next((m) => m.room?.phase === "briefing");
    await b.next((m) => m.room?.phase === "briefing");
    a.send({ type: "accept" });
    b.send({ type: "accept" });
    await a.next((m) => m.room?.phase === "playing");
    await b.next((m) => m.room?.phase === "playing");
    for (const [who, from, to, revision] of [
      [a, "e2", "e4", 0],
      [b, "e7", "e5", 1],
      [a, "g1", "f3", 2],
      [b, "b8", "c6", 3],
    ]) {
      who.send({ type: "move", from, to, revision });
      await a.next((m) => m.room?.revision === revision + 1);
      await b.next((m) => m.room?.revision === revision + 1);
    }
    const before = [...server.rooms.values()][0].match.snapshot();
    await server.close();
    assert.equal(
      (await readFile(databasePath)).includes(Buffer.from(sessionA.token)),
      false,
    );
    server = createGameServer({ port: 0, databasePath });
    await server.listen();
    url = "ws://127.0.0.1:" + server.http.address().port + "/socket";
    a = await client(url);
    b = await client(url);
    a.send({ type: "resume", token: sessionA.token });
    b.send({ type: "resume", token: sessionB.token });
    const restored = await a.next((m) =>
      m.room?.players.every((p) => p.connected),
    );
    assert.deepEqual(restored.room.state, before);
    assert.equal(restored.room.revision, 4);
  } finally {
    await server.close();
    for (const file of await readdir(directory))
      await unlink(join(directory, file));
    await rmdir(directory);
  }
});

test("disconnect timeout awards the remaining player and malformed messages do not mutate state", async () => {
  const server = createGameServer({
    port: 0,
    databasePath: ":memory:",
    graceMs: 80,
  });
  await server.listen();
  try {
    const url = "ws://127.0.0.1:" + server.http.address().port + "/socket",
      a = await client(url),
      b = await client(url);
    a.send({ type: "quick", name: "A" });
    b.send({ type: "quick", name: "B" });
    await a.next((m) => m.room?.phase === "briefing");
    await b.next((m) => m.room?.phase === "briefing");
    a.socket.send("{bad JSON");
    assert.equal((await a.next((m) => m.type === "error")).key, "invalid");
    b.send({ type: "resume", token: "fake" });
    assert.equal((await b.next((m) => m.type === "error")).key, "invalid");
    a.send({ type: "accept" });
    b.send({ type: "accept" });
    await a.next((m) => m.room?.phase === "playing");
    b.socket.close();
    const result = await a.next((m) => m.room?.phase === "ended");
    assert.equal(result.room.result.winner, "w");
    assert.equal(result.room.result.reason, "left");
    a.socket.close();
  } finally {
    await server.close();
  }
});

test("upgrade checks origin; payload and request limits close abusive sockets", async () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://chess.test";
  const server = createGameServer({ port: 0, databasePath: ":memory:" });
  await server.listen();
  const url = "ws://127.0.0.1:" + server.http.address().port + "/socket";
  try {
    const rejected = new WebSocket(url, { origin: "https://other.test" });
    const error = await new Promise((resolve) =>
      rejected.once("error", resolve),
    );
    assert.match(error.message, /403/);
    const connect = async () => {
      const socket = new WebSocket(url, { origin: "https://chess.test" });
      await new Promise((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
      });
      return socket;
    };
    const flood = await connect();
    const closed = new Promise((resolve) => flood.once("close", resolve));
    for (let i = 0; i < 55; i++) flood.send("{}");
    assert.equal(await closed, 1008);
    const large = await connect();
    const tooLarge = new Promise((resolve) => large.once("close", resolve));
    large.send("x".repeat(5000));
    assert.equal(await tooLarge, 1009);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});

test("online engine locks both secret moves on simultaneous ply 18 and resolves clash + SHIFT", () => {
  const match = new Match("periodic", "swap");
  const opening = "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8".split(" ");
  for (const san of opening) {
    const m = match.chess.moves({ verbose: true }).find((c) => c.san === san);
    match.play(m.from, m.to, m.promotion);
    match.settle();
  }
  assert.equal(match.isSimultaneousTurn(), true);
  const pW = { id: "w", name: "White", color: "w", socket: {} };
  const pB = { id: "b", name: "Black", color: "b", socket: {} };
  const room = {
    code: "SIM123",
    phase: "playing",
    players: [pW, pB],
    match,
    revision: 18,
    clock: newClock(300000),
  };
  resumeClock(room, Date.now());
  // Black submits first during simultaneous turn!
  const first = command(room, pB, { type: "move", from: "c7", to: "c5", revision: 18 });
  assert.equal(first.simultaneous, undefined);
  assert.equal(room.revision, 18);
  assert.ok(room.pendingMoves.b);
  // Black cannot submit twice
  assert.throws(() => command(room, pB, { type: "move", from: "c7", to: "c6", revision: 18 }));
  // White submits second -> resolves simultaneously and executes ply-20 SHIFT!
  const second = command(room, pW, { type: "move", from: "d2", to: "d4", revision: 18 });
  assert.ok(second.simultaneous);
  assert.equal(room.revision, 19);
  assert.equal(room.match.plies, 20);
  assert.equal(room.pendingMoves, undefined);
  assert.equal(second.settlement.due?.at, 20);
});
