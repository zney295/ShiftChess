import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import { Match, shiftedPosition } from "../src/rules.ts";

test("periodic SHIFT announces fixed squares one round in advance", () => {
  const match = new Match("periodic", "swap", () => 0);
  for (const [from, to] of [
    ["e2", "e4"],
    ["d7", "d5"],
    ["e4", "d5"],
    ["g8", "f6"],
    ["b1", "c3"],
    ["f6", "d5"],
    ["c3", "d5"],
    ["d8", "d5"],
  ]) {
    match.play(from, to);
    match.settle();
  }
  const announced = match.pending;
  assert.equal(announced.at, 10);
  assert.deepEqual(announced.pairs, [["a8", "b8"]]);
  match.play("g1", "f3");
  match.settle();
  assert.equal(match.pending, announced);
  match.play("b8", "c6");
  assert.equal(match.settle().applied, true);
  assert.equal(match.chess.get("b8").type, "r");
  assert.equal(match.chess.get("c6").type, "n");
  assert.equal(match.chess.get("a8"), undefined);
  assert.equal(match.chess.fen().split(" ")[2], "KQk");
  assert.equal(match.chess.turn(), "w");
});

test("late SHIFT announces at ply 22, resolves at ply 24 and runs once", () => {
  const match = new Match("late", "swap", () => 0);
  const opening = "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 c4 c6 Nc3 Qc7".split(" ");
  for (const [index, san] of opening.entries()) {
    const move = match.chess.moves({ verbose: true }).find((candidate) => candidate.san === san);
    assert.ok(move, san);
    match.play(move.from, move.to, move.promotion);
    const settlement = match.settle();
    assert.equal(settlement.announced, index === 21);
    if (settlement.announced) assert.equal(match.pending.at, 24);
    assert.equal(settlement.due?.at, index === 23 ? 24 : undefined);
  }
  assert.equal(match.pending, null);
  for (let i = 0; i < 6; i++) {
    const [move] = match.chess.moves({ verbose: true });
    match.play(move.from, move.to, move.promotion);
    assert.equal(match.settle().announced, false);
  }
});

test("random SHIFT picks its timing once and snapshot preserves the choice", () => {
  for (const [roll, expected] of [[0.49, "periodic"], [0.5, "late"]]) {
    const match = new Match("random", "slide", () => roll);
    assert.equal(match.mode, expected);
    assert.equal(Match.restore(match.snapshot(), () => 1 - roll).mode, expected);
  }
});

test("rejects a SHIFT that exposes a king or moves a pawn", () => {
  const chess = new Chess("k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1");
  const shift = (a, b) => ({ effect: "slide", pairs: [[a, b]], at: 6 });
  assert.equal(shiftedPosition(chess, shift("e2", "d2")), null);
  assert.equal(shiftedPosition(new Chess(), shift("e2", "e4")), null);
  assert.equal(chess.get("e2").type, "n");
});

test("double SHIFT only accepts disjoint pairs and keeps the move clock", () => {
  const chess = new Chess("k7/8/8/2n2b2/8/8/2N2B2/K7 w - - 17 12");
  const make = (pairs) => ({ effect: "double", pairs, at: 24 });
  assert.equal(
    shiftedPosition(
      chess,
      make([
        ["c2", "f2"],
        ["f2", "f5"],
      ]),
    ),
    null,
  );
  const fen = shiftedPosition(
    chess,
    make([
      ["c2", "f2"],
      ["c5", "f5"],
    ]),
  );
  assert.ok(fen);
  assert.equal(new Chess(fen).get("f5").type, "n");
  assert.equal(fen.split(" ").slice(-2).join(" "), "17 12");
});

test("preferences enable local board flip by default", async () => {
  const { loadPreferences } = await import("../src/preferences.ts");
  const prefs = loadPreferences();
  assert.equal(prefs.localFlip, true);
});
