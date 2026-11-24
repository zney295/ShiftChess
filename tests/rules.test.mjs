import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import { Match, shiftedPosition, evaluatePair } from "../src/rules.ts";

test("periodic SHIFT announces at ply 18 and resolves at ply 20", () => {
  const match = new Match("periodic", "swap", () => 0);
  const opening = "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7".split(" ");
  for (const [index, san] of opening.entries()) {
    const move = match.chess.moves({ verbose: true }).find((candidate) => candidate.san === san);
    assert.ok(move, san);
    match.play(move.from, move.to, move.promotion);
    const settlement = match.settle();
    assert.equal(settlement.announced, index === 17);
    if (settlement.announced) assert.equal(match.pending.at, 20);
    assert.equal(settlement.due?.at, index === 19 ? 20 : undefined);
  }
  assert.equal(match.plies, 20);
  assert.equal(match.pending, null);
});

test("simultaneous turn mutually eliminates pieces on same square, head-on, and crossing paths", () => {
  // Same target square
  const sameSq = new Match("periodic", "swap");
  sameSq.chess.load("r1bqkb1r/pppp1ppp/2n5/8/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 1");
  const out1 = sameSq.playSimultaneous({ from: "f3", to: "e5" }, { from: "c6", to: "e5" });
  assert.equal(out1.clash, true);
  assert.equal(out1.clashSquare, "e5");
  assert.equal(sameSq.chess.get("f3"), undefined);
  assert.equal(sameSq.chess.get("c6"), undefined);
  assert.equal(sameSq.chess.get("e5"), undefined);
  assert.ok(sameSq.log.some((l) => l.includes("CLASH")));

  // Path-crossing collision: White Rook a4->h4 crosses Black Rook d8->d1 at d4
  const cross = new Match("periodic", "swap");
  cross.chess.load("3rk3/8/8/8/R7/8/8/4K3 w - - 0 1");
  const out2 = cross.playSimultaneous({ from: "a4", to: "h4" }, { from: "d8", to: "d1" });
  assert.equal(out2.clash, true);
  assert.equal(out2.clashSquare, "d4");
  assert.equal(cross.chess.get("a4"), undefined);
  assert.equal(cross.chess.get("h4"), undefined);
  assert.equal(cross.chess.get("d8"), undefined);
  assert.equal(cross.chess.get("d1"), undefined);
});

test("Square Morph applies only to Knight <-> Bishop on Swap with opposite square color, never Rook/Queen/Double", () => {
  // Knight on d5 (dark) -> e5 (light) morphs to Bishop on swap
  const chess = new Chess("4k3/8/8/3n4/8/8/8/4K3 w - - 0 1");
  const fenSwap = shiftedPosition(chess, { at: 20, effect: "swap", pairs: [["d5", "e5"]] });
  assert.ok(fenSwap);
  assert.equal(new Chess(fenSwap).get("e5").type, "b");

  // Rook and Queen stay unchanged on opposite square color swap
  const heavy = new Chess("1k6/8/8/3rQ3/8/8/8/7K w - - 0 1");
  const fenHeavy = shiftedPosition(heavy, { at: 20, effect: "swap", pairs: [["d5", "e5"]] });
  assert.ok(fenHeavy);
  assert.equal(new Chess(fenHeavy).get("e5").type, "r");
  assert.equal(new Chess(fenHeavy).get("d5").type, "q");

  // Swapping a Rook onto the e-file where it checks a King is neutralized
  const checkAfterShift = new Chess("4k3/8/8/3rQ3/8/8/8/4K3 w - - 0 1");
  assert.equal(shiftedPosition(checkAfterShift, { at: 20, effect: "swap", pairs: [["d5", "e5"]] }), null);

  // Double SHIFT never triggers Square Morph
  const dbl = new Chess("k7/8/8/2n1b3/8/8/2N1B3/7K w - - 0 1");
  const fenDouble = shiftedPosition(dbl, {
    at: 20,
    effect: "double",
    pairs: [["c5", "d5"], ["e5", "f5"]],
  });
  assert.ok(fenDouble);
  assert.equal(new Chess(fenDouble).get("d5").type, "n");
  assert.equal(new Chess(fenDouble).get("f5").type, "b");
});

test("evaluatePair prioritizes cross-side when balanced and underdog intra-side when unbalanced", () => {
  const balanced = new Chess();
  const crossSideScore = evaluatePair(balanced, "b1", "b8");
  const intraSideScore = evaluatePair(balanced, "b1", "g1");
  assert.ok(crossSideScore > intraSideScore);

  // White is down two Rooks -> White is the weaker side and gets higher Intra-Side score than Black
  const unbalanced = new Chess("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBN1 w kq - 0 1");
  const whiteUnderdogIntra = evaluatePair(unbalanced, "c1", "f1");
  const blackLeaderIntra = evaluatePair(unbalanced, "c8", "f8");
  assert.ok(whiteUnderdogIntra > blackLeaderIntra);
});

test("simultaneous turn activates at ply 18 only for swap and neutralizes immediate check", () => {
  const match = new Match("periodic", "swap");
  const opening = "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8".split(" ");
  for (const san of opening) {
    const move = match.chess.moves({ verbose: true }).find((m) => m.san === san);
    assert.ok(move, san);
    match.play(move.from, move.to, move.promotion);
    match.settle();
  }
  assert.equal(match.plies, 18);
  assert.equal(match.isSimultaneousTurn(), true);

  // Slide match at ply 18 is NOT simultaneous
  const slideMatch = new Match("periodic", "slide");
  for (const san of opening) {
    const move = slideMatch.chess.moves({ verbose: true }).find((m) => m.san === san);
    slideMatch.play(move.from, move.to, move.promotion);
    slideMatch.settle();
  }
  assert.equal(slideMatch.isSimultaneousTurn(), false);

  // Simultaneous move that would leave a king in immediate check is neutralized safely
  const shieldMatch = new Match("periodic", "swap");
  shieldMatch.chess.load("4k3/8/8/8/8/8/4R3/4K3 w - - 0 1");
  const res = shieldMatch.playSimultaneous({ from: "e2", to: "e7" }, { from: "e8", to: "d8" });
  assert.equal(shieldMatch.chess.isCheck(), false);
  assert.ok(shieldMatch.chess.findPiece({ type: "k", color: "w" }).length === 1);
  assert.ok(shieldMatch.chess.findPiece({ type: "k", color: "b" }).length === 1);
  assert.ok(typeof res.neutralizedCheck === "boolean");
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
