import { turnTimeMs } from "../src/rules.ts";

export const defaultClockMs = 5 * 60 * 1000;

export function newClock(duration, turnMs = turnTimeMs) {
  return { remaining: { w: duration, b: duration }, deadline: null,
    turnMs, turnRemaining: turnMs, turnDeadline: null };
}

export function pauseClock(room, now, side = room.match?.chess.turn()) {
  const clock = room.clock;
  if (clock?.deadline == null) return;
  clock.remaining[side] = Math.max(0, clock.deadline - now);
  if (clock.turnDeadline != null)
    clock.turnRemaining = Math.max(0, clock.turnDeadline - now);
  clock.turnDeadline = null;
  clock.deadline = null;
}

export function resumeClock(room, now) {
  if (room.phase !== "playing" || room.clock.deadline !== null ||
      room.players.length !== 2 || room.players.some((p) => !p.socket)) return;
  room.clock.deadline = now + room.clock.remaining[room.match.chess.turn()];
  room.clock.turnDeadline = now + room.clock.turnRemaining;
}

export function expireClock(room, now) {
  if (room.phase !== "playing" || room.clock?.deadline == null || now < room.clock.deadline)
    return false;
  const loser = room.match.chess.turn();
  pauseClock(room, now);
  room.phase = "ended";
  room.result = { winner: loser === "w" ? "b" : "w", reason: "timeout" };
  return true;
}
