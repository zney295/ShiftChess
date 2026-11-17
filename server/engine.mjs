import { randomInt } from "node:crypto";
import { Match, effects } from "../src/rules.ts";

export class GameError extends Error {}
export const serverRandom = () => randomInt(16777216) / 16777216;
const requireRule = (condition, key) => {
  if (!condition) throw new GameError(key);
};

export function startMatch(room) {
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
  room.players.forEach((p) => {
    p.accepted = false;
    p.rematch = false;
  });
}

/** Transport-independent authoritative commands. Clients never submit FEN or SHIFT pairs. */
export function command(room, player, msg) {
  if (msg.type === "ready") {
    requireRule(room.phase === "waiting", "invalid");
    player.ready = !player.ready;
    if (
      room.players.length === 2 &&
      room.players.every((p) => p.ready && p.socket)
    )
      startMatch(room);
  } else if (msg.type === "accept") {
    requireRule(room.phase === "briefing", "invalid");
    player.accepted = true;
    if (
      room.players.length === 2 &&
      room.players.every((p) => p.accepted && p.socket)
    )
      room.phase = "playing";
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
    const settlement = room.match.settle();
    room.revision++;
    if (room.match.isEnded()) {
      room.phase = "ended";
      room.result = {
        winner: room.match.chess.isCheckmate() ? player.color : null,
        reason: room.match.chess.isCheckmate() ? "mate" : "draw",
      };
    }
    return {
      move: { from: move.from, to: move.to, promotion: move.promotion },
      settlement,
    };
  } else if (msg.type === "resign") {
    requireRule(room.phase === "playing", "invalid");
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
      startMatch(room);
    }
  } else throw new GameError("invalid");
  return {};
}
