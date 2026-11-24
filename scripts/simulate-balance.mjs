/**
 * Reproducible-seed balance simulation for ShiftChess.
 * Runs side-swapped pairs of automated games across Swap, Slide, and Double
 * to measure first-player bias, SHIFT execution rate, Square Morphs,
 * Simultaneous Clashes, and worst-case material swings.
 */
import { Match, automaticMoveFor, fenForColor, shiftZonePreview } from "../src/rules.ts";
import { bestMove } from "../src/bot.ts";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const weights = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function materialBalance(chess) {
  let diff = 0;
  for (const cell of chess.board().flat()) {
    if (!cell) continue;
    diff += (cell.color === "w" ? 1 : -1) * weights[cell.type];
  }
  return diff;
}

function pickMove(match, color, rng, noisy) {
  if (noisy && rng() < 0.28) {
    return automaticMoveFor(match, color, rng);
  }
  const state = match.snapshot();
  if (color !== match.chess.turn()) {
    state.fen = fenForColor(state.fen, color);
  }
  return bestMove(state, "easy", 12) ?? automaticMoveFor(match, color, rng);
}

function simulateGame(effect, seed, swapStrength) {
  const rng = mulberry32(seed);
  const match = new Match("periodic", effect, rng);
  const stats = {
    effect,
    seed,
    winner: null,
    plies: 0,
    shiftsApplied: 0,
    shiftsSkipped: 0,
    morphs: 0,
    clashes: 0,
    neutralizedChecks: 0,
    zonePreviews: 0,
    maxShiftMaterialSwing: 0,
    worstShiftDetail: null,
  };

  while (!match.isEnded() && match.plies < 70) {
    if (shiftZonePreview(match)) stats.zonePreviews++;
    if (match.isSimultaneousTurn()) {
      const wMove = pickMove(match, "w", rng, swapStrength);
      const bMove = pickMove(match, "b", rng, !swapStrength);
      if (!wMove || !bMove) break;
      const before = materialBalance(match.chess);
      const out = match.playSimultaneous(wMove, bMove);
      if (out.clash) stats.clashes++;
      if (out.neutralizedCheck) stats.neutralizedChecks++;
      if (out.applied) {
        stats.shiftsApplied++;
        stats.morphs += out.morphedSquares.length;
        const after = materialBalance(match.chess);
        const swing = Math.abs(after - before);
        if (swing > stats.maxShiftMaterialSwing) {
          stats.maxShiftMaterialSwing = swing;
          stats.worstShiftDetail = { ply: match.plies, swing, pairs: out.due?.pairs };
        }
      } else if (out.due) {
        stats.shiftsSkipped++;
      }
      continue;
    }

    const turn = match.chess.turn();
    const noisy = turn === "w" ? swapStrength : !swapStrength;
    const move = pickMove(match, turn, rng, noisy);
    if (!move) break;
    match.play(move.from, move.to, move.promotion);
    const beforeShift = materialBalance(match.chess);
    const settlement = match.settle();
    if (settlement.applied) {
      stats.shiftsApplied++;
      stats.morphs += settlement.morphedSquares.length;
      const swing = Math.abs(materialBalance(match.chess) - beforeShift);
      if (swing > stats.maxShiftMaterialSwing) {
        stats.maxShiftMaterialSwing = swing;
        stats.worstShiftDetail = { ply: match.plies, swing, pairs: settlement.due?.pairs };
      }
    } else if (settlement.due) {
      stats.shiftsSkipped++;
    }
  }

  stats.plies = match.plies;
  if (match.chess.isCheckmate()) {
    stats.winner = match.chess.turn() === "w" ? "b" : "w";
  } else {
    const finalMat = materialBalance(match.chess);
    stats.winner = finalMat >= 3 ? "w" : finalMat <= -3 ? "b" : "draw";
  }
  return stats;
}

const seeds = [101, 202, 303, 404, 505, 606];
const summary = {};
for (const effect of ["swap", "slide", "double"]) {
  const games = [];
  for (const seed of seeds) {
    // Side-swapped pairs: run seed with White stronger, then with Black stronger
    games.push(simulateGame(effect, seed, false));
    games.push(simulateGame(effect, seed, true));
  }
  const whiteWins = games.filter((g) => g.winner === "w").length;
  const blackWins = games.filter((g) => g.winner === "b").length;
  const draws = games.filter((g) => g.winner === "draw").length;
  const shiftsApplied = games.reduce((s, g) => s + g.shiftsApplied, 0);
  const shiftsSkipped = games.reduce((s, g) => s + g.shiftsSkipped, 0);
  const morphs = games.reduce((s, g) => s + g.morphs, 0);
  const clashes = games.reduce((s, g) => s + g.clashes, 0);
  const neutralizedChecks = games.reduce((s, g) => s + g.neutralizedChecks, 0);
  const worst = games.reduce(
    (acc, g) => (g.maxShiftMaterialSwing > acc.maxShiftMaterialSwing ? g : acc),
    games[0],
  );
  summary[effect] = {
    games: games.length,
    whiteWins,
    blackWins,
    draws,
    shiftsApplied,
    shiftsSkipped,
    morphs,
    clashes,
    neutralizedChecks,
    worstShiftMaterialSwing: worst.maxShiftMaterialSwing,
    worstSeed: worst.seed,
  };
}

console.log(JSON.stringify(summary, null, 2));
