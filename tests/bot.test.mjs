import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/rules.ts";
import { bestMove } from "../src/bot.ts";

test("snapshot keeps announced SHIFT, clocks and repetition state", () => {
  const match = new Match("periodic", "double", () => 0);
  for (const [a, b] of [
    ["e2", "e4"],
    ["e7", "e5"],
    ["g1", "f3"],
    ["b8", "c6"],
  ]) {
    match.play(a, b);
    match.settle();
  }
  const restored = Match.restore(match.snapshot(), () => 0);
  assert.deepEqual(restored.snapshot(), match.snapshot());
  match.play("b1", "c3");
  match.settle();
  restored.play("b1", "c3");
  restored.settle();
  match.play("g8", "f6");
  restored.play("g8", "f6");
  assert.deepEqual(restored.settle(), match.settle());
  assert.equal(restored.chess.fen(), match.chess.fen());
});
test("bot finds mate and returns a legal move without mutating match", () => {
  const match = new Match("periodic", "swap");
  match.chess.load("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
  const state = match.snapshot(),
    move = bestMove(state, "normal", 1000);
  assert.deepEqual(match.snapshot(), state);
  match.play(move.from, move.to, move.promotion);
  assert.equal(match.chess.isCheckmate(), true);
});

test("interrupted deeper search keeps the last complete iteration", (t) => {
  const state = new Match("periodic", "swap").snapshot();
  const shallow = bestMove(state, "easy", 10000);
  let checks = 0;
  t.mock.method(performance, "now", () => ++checks <= 47 ? 0 : 100);
  assert.deepEqual(bestMove(state, "expert", 50), shallow);
  assert.ok(checks > 47);
});
