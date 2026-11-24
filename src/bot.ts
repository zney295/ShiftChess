import { Match, type MatchState } from "./rules.ts";
import type { Move } from "chess.js";

export type Difficulty = "easy" | "normal" | "expert";
const values = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
const score = (match: Match) => {
  const side = match.chess.turn();
  let total = 0;
  for (const cell of match.chess.board().flat()) {
    if (!cell) continue;
    const file = cell.square.charCodeAt(0) - 97,
      rank = Number(cell.square[1]) - 1;
    const center = 7 - Math.abs(file - 3.5) - Math.abs(rank - 3.5);
    const progress = cell.color === "w" ? rank : 7 - rank;
    const bonus =
      cell.type === "p"
        ? progress * 7 + center * 2
        : cell.type === "k"
          ? -center * 3
          : center * 6;
    total +=
      (cell.color === side ? 1 : -1) *
      (values[cell.type] + bonus);
  }
  return total;
};
const order = (moves: Move[]) =>
  moves.sort(
    (a, b) =>
      values[b.captured ?? "k"] * 10 -
      values[b.piece] +
      (b.promotion ? 9000 : 0) -
      (values[a.captured ?? "k"] * 10 -
        values[a.piece] +
        (a.promotion ? 9000 : 0)),
  );

/** Iterative deepening. Every branch settles the same announced SHIFT as a real match. */
export function bestMove(
  state: MatchState,
  difficulty: Difficulty,
  budget?: number,
) {
  const deadline =
    performance.now() +
    (budget ?? { easy: 100, normal: 300, expert: 900 }[difficulty]);
  const root = Match.restore(state, () => 0.5);
  const moves = order(root.chess.moves({ verbose: true }));
  if (!moves.length || root.isEnded()) return null;
  let best = moves[0],
    nodes = 0;
  const timeout = Symbol("timeout");
  const search = (
    position: Match,
    depth: number,
    alpha: number,
    beta: number,
  ): number => {
    if ((++nodes & 7) === 0 && performance.now() >= deadline) throw timeout;
    if (position.isEnded())
      return position.chess.isCheckmate() ? -100000 : 0;
    if (depth === 0) return score(position);
    let value = -Infinity;
    for (const move of order(position.chess.moves({ verbose: true }))) {
      const child = Match.restore(position.snapshot(), () => 0.5);
      child.play(move.from, move.to, move.promotion);
      child.settle();
      value = Math.max(value, -search(child, depth - 1, -beta, -alpha));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  };
  for (let depth = 1; depth <= (difficulty === "easy" ? 1 : 5); depth++) {
    let candidate = best,
      high = -Infinity;
    try {
      for (const move of [best, ...moves.filter((item) => item !== best)]) {
        if (performance.now() >= deadline) throw timeout;
        const child = Match.restore(state, () => 0.5);
        child.play(move.from, move.to, move.promotion);
        child.settle();
        const value = -search(child, depth - 1, -Infinity, -high);
        if (performance.now() >= deadline) throw timeout;
        if (value > high) {
          high = value;
          candidate = move;
        }
        if (high === 100000) break;
      }
      best = candidate;
      if (high === 100000) break;
    } catch (error) {
      if (error !== timeout) throw error;
      break;
    }
  }
  return { from: best.from, to: best.to, promotion: best.promotion };
}
