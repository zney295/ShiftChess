import { randomInt } from "node:crypto";
import { Match, automaticMove, effects, turnTimeMs } from "../src/rules.ts";
import { defaultClockMs, expireClock, newClock, pauseClock, resumeClock } from "./clock.mjs";

export class GameError extends Error {}
export const serverRandom = () => randomInt(16777216) / 16777216;
const requireRule = (condition, key) => {
  if (!condition) throw new GameError(key);
};

export function startMatch(room, clockMs = defaultClockMs, turnMs = turnTimeMs) {
  requireRule(
    room.players.length === 2 && room.players.every((p) => p.socket),
    "invalid",
  );
  room.setting = randomInt(2) ? "park" : "library";
  room.match = new Match(
    "periodic",
    effects[randomInt(effects.length)],
    serverRandom,
  );
  room.phase = "briefing";
  room.result = undefined;
  room.revision = 0;
  room.clock = newClock(clockMs, turnMs);
  room.players.forEach((p) => {
    p.accepted = false;
    p.rematch = false;
  });
}

export function beginIfReady(room, now) {
  if (room.phase !== "briefing" || room.players.length !== 2 ||
      room.players.some((p) => !p.accepted || !p.socket)) return;
  room.phase = "playing";
  resumeClock(room, now);
}

function settleMove(room, move, now, nextTurnAt = now) {
  pauseClock(room, now, move.color);
  room.clock.turnRemaining = room.clock.turnMs;
  const settlement = room.match.settle();
  room.revision++;
  if (room.match.isEnded()) {
    room.phase = "ended";
    const mate = room.match.chess.isCheckmate();
    room.result = { winner: mate ? move.color : null, reason: mate ? "mate" : "draw" };
  } else resumeClock(room, nextTurnAt);
  return { move: { from: move.from, to: move.to, promotion: move.promotion }, settlement };
}

export function advanceClocks(room, now) {
  const clock = room.clock;
  if (room.phase !== "playing" || clock?.deadline == null) return;
  if (clock.deadline <= clock.turnDeadline && expireClock(room, now)) return {};
  if (clock.turnDeadline > now) return;
  const choice = automaticMove(room.match, serverRandom);
  if (!choice) return;
  const move = room.match.play(choice.from, choice.to, choice.promotion);
  return { ...settleMove(room, move, clock.turnDeadline, now), automatic: true };
}

/** Transport-independent authoritative commands. Clients never submit FEN or SHIFT pairs. */
export function command(room, player, msg, { now = Date.now(), clockMs = defaultClockMs, turnMs = turnTimeMs } = {}) {
  if (msg.type === "ready") {
    requireRule(room.phase === "waiting", "invalid");
    player.ready = !player.ready;
    if (
      room.players.length === 2 &&
      room.players.every((p) => p.ready && p.socket)
    )
      startMatch(room, clockMs, turnMs);
  } else if (msg.type === "accept") {
    requireRule(room.phase === "briefing", "invalid");
    player.accepted = true;
    beginIfReady(room, now);
  } else if (msg.type === "move") {
    requireRule(
      room.phase === "playing" &&
        room.players.length === 2 &&
        room.players.every((p) => p.socket) &&
        room.match.chess.turn() === player.color &&
        msg.revision === room.revision,
      "notYourTurn",
    );
    requireRule(
      typeof msg.from === "string" &&
        /^[a-h][1-8]$/.test(msg.from) &&
        typeof msg.to === "string" &&
        /^[a-h][1-8]$/.test(msg.to) &&
        (!msg.promotion || ["q", "r", "b", "n"].includes(msg.promotion)),
      "invalidMove",
    );
    let move;
    try {
      move = room.match.play(msg.from, msg.to, msg.promotion);
    } catch {
      throw new GameError("invalidMove");
    }
    return settleMove(room, move, now);
  } else if (msg.type === "resign") {
    requireRule(room.phase === "playing", "invalid");
    pauseClock(room, now);
    room.phase = "ended";
    room.result = {
      winner: player.color === "w" ? "b" : "w",
      reason: "resigned",
    };
  } else if (msg.type === "rematch") {
    requireRule(room.phase === "ended", "invalid");
    player.rematch = true;
    if (
      room.players.length === 2 &&
      room.players.every((p) => p.rematch && p.socket)
    ) {
      room.players.forEach((p) => (p.color = p.color === "w" ? "b" : "w"));
      startMatch(room, clockMs, turnMs);
    }
  } else throw new GameError("invalid");
  return {};
}
