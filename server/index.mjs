import { createServer } from "node:http";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { Match, turnTimeMs } from "../src/rules.ts";
import { advanceClocks, beginIfReady, command, startMatch, GameError, serverRandom } from "./engine.mjs";
import { RoomStore } from "./store.mjs";
import { defaultClockMs, expireClock, newClock, pauseClock, resumeClock } from "./clock.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(24).toString("hex");
const code = () =>
  Array.from(
    { length: 6 },
    () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
  ).join("");
const send = (socket, data) => {
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 256 * 1024) {
    socket.terminate();
    return;
  }
  socket.send(JSON.stringify(data));
};

export function createGameServer({
  port = Number(process.env.PORT || 48700),
  host = process.env.HOST || "127.0.0.1",
  graceMs = 60000,
  clockMs = defaultClockMs,
  turnMs = turnTimeMs,
  maxRooms = Number(process.env.MAX_ROOMS || 200),
  databasePath = process.env.DATABASE_PATH || "./data/shiftchess.sqlite",
} = {}) {
  if (!Number.isInteger(clockMs) || clockMs <= 0 || clockMs > 2 ** 31 - 1 ||
      !Number.isInteger(turnMs) || turnMs <= 0 || turnMs > 2 ** 31 - 1 ||
      !Number.isInteger(maxRooms) || maxRooms <= 0)
    throw new RangeError("Invalid room or clock limits");
  const rooms = new Map(),
    sessions = new Map();
  const store = new RoomStore(databasePath);
  let stopping = false,
    storageFailed = false;
  const origins = process.env.ALLOWED_ORIGINS?.split(",").map((origin) =>
    origin.trim(),
  );
  if (process.env.NODE_ENV === "production" && !origins?.length)
    throw new Error("ALLOWED_ORIGINS is required in production");
  const admissions = new Map(),
    connectionsByIP = new Map();
  const persist = (room) => {
    try {
      store.save(room);
    } catch (err) {
      storageFailed = true;
      console.error(
        JSON.stringify({ event: "storage_failed", message: err.message }),
      );
      void shutdown(false);
      throw err;
    }
  };
  const root = resolve("dist");
  const http = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (req.url === "/health") {
      res.writeHead(stopping || storageFailed ? 503 : 200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ ok: !stopping && !storageFailed }));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://local").pathname,
      );
      const file = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + sep)) throw new Error("path");
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
            ".webmanifest": "application/manifest+json",
          }[extname(file)] || "application/octet-stream",
        "Cache-Control": pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  http.requestTimeout = 10000;
  http.headersTimeout = 10000;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });
  http.on("upgrade", (req, socket, head) => {
    const forwarded =
      process.env.TRUST_PROXY === "1" && req.headers["x-forwarded-for"];
    const ip = forwarded
      ? String(forwarded).split(",")[0].trim()
      : req.socket.remoteAddress;
    const now = Date.now(),
      entry = admissions.get(ip) ?? { at: now, count: 0 };
    if (now - entry.at > 60000) {
      entry.at = now;
      entry.count = 0;
    }
    entry.count++;
    admissions.set(ip, entry);
    if (
      stopping ||
      req.url !== "/socket" ||
      (origins && !origins.includes(req.headers.origin)) ||
      entry.count > 60 ||
      (connectionsByIP.get(ip) ?? 0) >= 16 ||
      wss.clients.size >= 400
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      connectionsByIP.set(ip, (connectionsByIP.get(ip) ?? 0) + 1);
      ws.once("close", () => {
        const count = (connectionsByIP.get(ip) ?? 1) - 1;
        if (count) connectionsByIP.set(ip, count);
        else connectionsByIP.delete(ip);
      });
      wss.emit("connection", ws, req);
    });
  });
  const pack = (room) => ({
    code: room.code,
    phase: room.phase,
    quick: room.quick,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      connected: Boolean(p.socket),
      ready: p.ready,
      accepted: p.accepted,
      rematch: p.rematch,
    })),
    setting: room.setting,
    state: room.match?.snapshot(),
    simultaneous: room.match?.isSimultaneousTurn()
      ? {
          w: Boolean(room.pendingMoves?.w),
          b: Boolean(room.pendingMoves?.b),
        }
      : undefined,
    revision: room.revision,
    result: room.result,
    disconnectedUntil: room.disconnectedUntil,
    clock: room.clock ? { ...room.clock, serverNow: Date.now() } : undefined,
  });
  const broadcast = (room, extra = {}) => {
    clearTimeout(room.timer);
    room.timer = undefined;
    persist(room);
    const packet = { type: "room", room: pack(room), ...extra };
    room.players.forEach((p) => send(p.socket, packet));
    room.watchers.forEach((socket) => send(socket, packet));
    scheduleClock(room);
  };
  const scheduleClock = (room) => {
    if (room.clock?.deadline == null) return;
    const deadline = Math.min(room.clock.deadline, room.clock.turnDeadline);
    room.timer = setTimeout(() => {
      if (stopping) return;
      const event = advanceClocks(room, Date.now());
      if (event) {
        try { broadcast(room, event); } catch { /* Storage failure initiates shutdown. */ }
      } else scheduleClock(room);
    }, Math.max(1, deadline - Date.now()));
  };
  const finish = (room, winner, reason) => {
    pauseClock(room, Date.now());
    room.phase = "ended";
    room.result = { winner, reason };
    broadcast(room);
  };
  const dropRoom = (room) => {
    clearTimeout(room.timer);
    room.players.forEach((p) => {
      clearTimeout(p.timer);
      sessions.delete(p.token);
    });
    rooms.delete(room.code);
    room.watchers.forEach((socket) => send(socket, { type: "error", key: "expired" }));
    room.watchers.clear();
    store.delete(room.code);
  };
  const leave = (player) => {
    const room = rooms.get(player.code);
    if (!room) return;
    sessions.delete(player.token);
    clearTimeout(player.timer);
    room.players = room.players.filter((p) => p !== player);
    if (!room.players.length) {
      dropRoom(room);
      return;
    }
    if (room.phase === "waiting") {
      room.players.forEach((p) => (p.ready = false));
      broadcast(room);
    } else if (room.phase === "ended") broadcast(room);
    else finish(room, room.players[0].color, "left");
  };
  const start = (room) => {
    startMatch(room, clockMs, turnMs);
    broadcast(room);
  };
  const waitForReconnect = (player, room) => {
    player.timer = setTimeout(() => {
      if (player.socket) return;
      if (!room.players.some((p) => p.socket)) {
        dropRoom(room);
      } else leave(player);
    }, graceMs);
  };
  for (const saved of store.load()) {
    if (Date.now() - saved.createdAt > 4 * 3600000) {
      store.delete(saved.code);
      continue;
    }
    const room = {
      ...saved,
      watchers: new Set(),
      match: saved.match ? Match.restore(saved.match, serverRandom) : undefined,
      disconnectedUntil: Date.now() + graceMs,
    };
    if (room.match) {
      room.clock = { ...newClock(clockMs, turnMs), ...room.clock };
      const now = Date.now();
      if (!expireClock(room, now)) pauseClock(room, now);
    }
    rooms.set(room.code, room);
    room.players.forEach((p) => {
      sessions.set(p.token, p);
      waitForReconnect(p, room);
    });
  }
  wss.on("connection", (socket, req) => {
    let player,
      watching,
      count = 0,
      windowAt = Date.now();
    const joinTimeout = setTimeout(() => {
      if (!player && !watching) socket.close(1008);
    }, 30000);
    socket.alive = true;
    socket.on("pong", () => (socket.alive = true));
    const error = (key) => send(socket, { type: "error", key });
    socket.on("error", () => {});
    socket.on("message", (raw) => {
      if (Date.now() - windowAt > 10000) {
        count = 0;
        windowAt = Date.now();
      }
      if (++count > 50) {
        socket.close(1008);
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || Array.isArray(msg) || typeof msg.type !== "string")
          return error("invalid");
        if (watching) {
          if (msg.type !== "leave") return error("invalid");
          watching.watchers.delete(socket);
          watching = undefined;
          return;
        }
        if (msg.type === "watch") {
          if (player) return error("invalid");
          const room = typeof msg.code === "string" && rooms.get(msg.code);
          if (!room) return error("roomMissing");
          watching = room;
          room.watchers.add(socket);
          send(socket, { type: "room", room: pack(room) });
          return;
        }
        if (msg.type === "resume") {
          if (player) return error("invalid");
          const candidate =
              typeof msg.token === "string" && /^[a-f0-9]{48}$/.test(msg.token)
                ? sessions.get(digest(msg.token))
                : undefined,
            room = candidate && rooms.get(candidate.code);
          if (!candidate || !room || candidate.socket) return error("expired");
          player = candidate;
          clearTimeout(player.timer);
          player.socket = socket;
          if (room.players.every((p) => p.socket)) room.disconnectedUntil = undefined;
          const now = Date.now();
          beginIfReady(room, now);
          resumeClock(room, now);
          send(socket, {
            type: "session",
            token: msg.token,
            color: player.color,
            playerId: player.id,
          });
          broadcast(room);
          return;
        }
        if (["create", "join", "quick"].includes(msg.type)) {
          if (player) return error("invalid");
          const name =
            typeof msg.name === "string"
              ? msg.name
                  .trim()
                  .replace(/[\u0000-\u001f]/g, "")
                  .slice(0, 24)
              : "";
          if (!name) return error("nameRequired");
          let room;
          if (msg.type === "join") {
            if (typeof msg.code !== "string" || !/^[A-Z2-9]{6}$/.test(msg.code))
              return error("roomMissing");
            room = rooms.get(msg.code);
            if (!room || room.quick) return error("roomMissing");
            if (room.phase !== "waiting" || room.players.length === 2)
              return error("roomFull");
          } else if (msg.type === "quick")
            room = [...rooms.values()].find(
              (r) =>
                r.quick &&
                r.phase === "waiting" &&
                r.players.length === 1 &&
                r.players[0].socket,
            );
          if (!room) {
            if (rooms.size >= maxRooms) return error("serverFull");
            let id;
            do {
              id = code();
            } while (rooms.has(id));
            room = {
              code: id,
              quick: msg.type === "quick",
              players: [],
              watchers: new Set(),
              phase: "waiting",
              revision: 0,
              createdAt: Date.now(),
            };
            rooms.set(id, room);
          }
          const resumeToken = token();
          player = {
            id: randomBytes(8).toString("hex"),
            name,
            token: digest(resumeToken),
            code: room.code,
            color: room.players.some((p) => p.color === "w") ? "b" : "w",
            socket,
            ready: msg.type === "quick",
            accepted: false,
          };
          room.players.push(player);
          sessions.set(player.token, player);
          send(socket, {
            type: "session",
            token: resumeToken,
            color: player.color,
            playerId: player.id,
          });
          if (room.players.length === 2 && room.players.every((p) => p.ready))
            start(room);
          else broadcast(room);
          return;
        }
        const room = player && rooms.get(player.code);
        if (!room) return error("expired");
        const now = Date.now();
        const clockEvent = advanceClocks(room, now);
        if (clockEvent) {
          broadcast(room, clockEvent);
          if (msg.type === "move") return;
        }
        if (msg.type === "leave") {
          leave(player);
          player = undefined;
          return;
        }
        broadcast(room, command(room, player, msg, { now, clockMs, turnMs }));
      } catch (err) {
        if (err instanceof GameError) error(err.message);
        else if (err instanceof SyntaxError) error("invalid");
        else {
          console.error(
            JSON.stringify({ event: "command_failed", message: err.message }),
          );
          error("invalid");
        }
      }
    });
    socket.on("close", () => {
      clearTimeout(joinTimeout);
      watching?.watchers.delete(socket);
      if (stopping || !player || !sessions.has(player.token)) return;
      const room = rooms.get(player.code);
      if (!room) return;
      const now = Date.now();
      const clockEvent = advanceClocks(room, now);
      pauseClock(room, now);
      player.socket = undefined;
      room.disconnectedUntil = now + graceMs;
      broadcast(room, clockEvent);
      waitForReconnect(player, room);
    });
  });
  const cleanup = setInterval(() => {
    for (const [ip, entry] of admissions)
      if (Date.now() - entry.at > 60000) admissions.delete(ip);
    for (const client of wss.clients) {
      if (client.alive === false) client.terminate();
      else {
        client.alive = false;
        client.ping();
      }
    }
    for (const room of rooms.values()) {
      room.createdAt ??= Date.now();
      if (Date.now() - room.createdAt > 4 * 3600000) {
        room.players.forEach((p) => p.socket?.close());
        dropRoom(room);
      }
    }
  }, 30000);
  cleanup.unref();
  async function shutdown(save = true) {
    if (stopping) return;
    stopping = true;
    clearInterval(cleanup);
    for (const r of rooms.values()) {
      clearTimeout(r.timer);
      if (!expireClock(r, Date.now())) pauseClock(r, Date.now());
      if (save) store.save(r);
      r.players.forEach((p) => {
        clearTimeout(p.timer);
        p.socket?.terminate();
      });
    }
    for (const socket of wss.clients) socket.terminate();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => http.close(resolve));
    store.close();
  }
  return {
    http,
    wss,
    rooms,
    listen: () => new Promise((resolve) => http.listen(port, host, resolve)),
    close: () => shutdown(),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const server = createGameServer();
  await server.listen();
  console.log(
    JSON.stringify({
      event: "listening",
      host: process.env.HOST || "127.0.0.1",
      port: process.env.PORT || 48700,
    }),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, () => {
      void server.close();
    });
}
