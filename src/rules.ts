import {
  Chess,
  type Color,
  type Move,
  type Piece,
  type PieceSymbol,
  type Square,
} from "chess.js";

export type Mode = "periodic" | "late" | "random";
export type Effect = "swap" | "slide" | "double";
export type Pair = [Square, Square];
export type Shift = { pairs: Pair[]; at: number; effect: Effect };
export type MoveInput = { from: Square; to: Square; promotion?: string };
export const effects: Effect[] = ["swap", "slide", "double"];
export const turnTimeMs = 30_000;

export function squareColor(square: Square): 0 | 1 {
  return (((square.charCodeAt(0) - 97) + (Number(square[1]) - 1)) % 2) as 0 | 1;
}

export function willSquareMorph(
  effect: Effect,
  piece: Piece | undefined,
  from: Square,
  to: Square,
): boolean {
  return (
    effect === "swap" &&
    (piece?.type === "n" || piece?.type === "b") &&
    squareColor(from) !== squareColor(to)
  );
}

export function morphedPieceType(
  effect: Effect,
  piece: Piece,
  from: Square,
  to: Square,
): PieceSymbol {
  if (!willSquareMorph(effect, piece, from, to)) return piece.type;
  return piece.type === "n" ? "b" : "n";
}

export function fenForColor(fen: string, color: Color): string {
  const parts = fen.split(" ");
  if (parts[1] === color) return fen;
  parts[1] = color;
  parts[3] = "-";
  return parts.join(" ");
}

export function automaticMove(match: Match, random = Math.random) {
  return automaticMoveFor(match, match.chess.turn(), random);
}

export function automaticMoveFor(
  match: Match,
  color: Color,
  random = Math.random,
) {
  const moves = match
    .legalMovesFor(color)
    .filter((move) => !move.promotion || move.promotion === "q");
  return moves[Math.floor(random() * moves.length)];
}

export type MatchState = {
  fen: string;
  mode: "periodic" | "late";
  effect: Effect;
  pending: Shift | null;
  plies: number;
  log: string[];
  positions: [string, number][];
};

export type Settlement = {
  due: Shift | null;
  applied: boolean;
  announced: boolean;
  morphedSquares: Square[];
};

export type SimultaneousOutcome = Settlement & {
  whiteMove: Move;
  blackMove: Move;
  clash: boolean;
  clashSquare?: Square;
  clashMidpoint?: [Square, Square];
  neutralizedCheck: boolean;
  beforeShift: ReturnType<Chess["board"]>;
};

const canShift = (piece?: Piece) => piece?.type !== "k" && piece?.type !== "p";

export function movesShiftPair(effect: Effect, first?: Piece, second?: Piece) {
  if (!canShift(first) || !canShift(second)) return false;
  if (effect === "slide") return Boolean(first) !== Boolean(second);
  return first?.type !== second?.type || first?.color !== second?.color;
}

export function movePath(
  from: Square,
  to: Square,
  piece: PieceSymbol,
): Square[] {
  if (piece === "n") return [];
  const f1 = from.charCodeAt(0) - 97;
  const r1 = Number(from[1]);
  const f2 = to.charCodeAt(0) - 97;
  const r2 = Number(to[1]);
  const df = Math.sign(f2 - f1);
  const dr = Math.sign(r2 - r1);
  const dist = Math.max(Math.abs(f2 - f1), Math.abs(r2 - r1));
  if (dist <= 1) return [];
  if (df !== 0 && dr !== 0 && Math.abs(f2 - f1) !== Math.abs(r2 - r1)) return [];
  const squares: Square[] = [];
  for (let step = 1; step < dist; step++) {
    const file = String.fromCharCode(97 + f1 + df * step);
    const rank = r1 + dr * step;
    squares.push((file + rank) as Square);
  }
  return squares;
}

export function detectSimultaneousCollision(
  wFrom: Square,
  wTo: Square,
  wPiece: PieceSymbol,
  bFrom: Square,
  bTo: Square,
  bPiece: PieceSymbol,
): { clash: boolean; clashSquare?: Square; clashMidpoint?: [Square, Square] } {
  if (wTo === bTo) return { clash: true, clashSquare: wTo };
  if (wFrom === bTo && bFrom === wTo) {
    return { clash: true, clashMidpoint: [wFrom, bFrom] };
  }
  const pathW = movePath(wFrom, wTo, wPiece);
  const pathB = movePath(bFrom, bTo, bPiece);
  if (pathW.includes(bTo)) return { clash: true, clashSquare: bTo };
  if (pathB.includes(wTo)) return { clash: true, clashSquare: wTo };
  for (const sq of pathW) {
    if (pathB.includes(sq)) return { clash: true, clashSquare: sq };
  }
  return { clash: false };
}

export function evaluatePair(
  chess: Chess,
  a: Square,
  b: Square,
  effect: Effect = "swap",
): number {
  const pA = chess.get(a);
  const pB = chess.get(b);
  if (!pA && !pB) return -1000;

  const fileA = a.charCodeAt(0) - 97;
  const rankA = Number(a[1]);
  const fileB = b.charCodeAt(0) - 97;
  const rankB = Number(b[1]);

  const rankDist = Math.abs(rankA - rankB);
  const fileDist = Math.abs(fileA - fileB);

  // Material balance
  let whiteMaterial = 0;
  let blackMaterial = 0;
  const weights: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
  chess.board().flat().forEach((p) => {
    if (p && p.type !== "k") {
      const val = weights[p.type] ?? 0;
      if (p.color === "w") whiteMaterial += val;
      else blackMaterial += val;
    }
  });
  const materialDiff = Math.abs(whiteMaterial - blackMaterial);
  const weakerSide: Color | null =
    whiteMaterial < blackMaterial
      ? "w"
      : blackMaterial < whiteMaterial
        ? "b"
        : null;

  // Centrality bonus (columns c-f, ranks 3-6)
  const centerA = 4 - Math.max(Math.abs(fileA - 3.5), Math.abs(rankA - 4.5));
  const centerB = 4 - Math.max(Math.abs(fileB - 3.5), Math.abs(rankB - 4.5));
  const centralFilesBonus =
    (fileA >= 2 && fileA <= 5 ? 10 : 0) + (fileB >= 2 && fileB <= 5 ? 10 : 0);
  let score = centerA + centerB + centralFilesBonus;

  const isOppositeColor = Boolean(pA && pB && pA.color !== pB.color);
  const isSameColor = Boolean(pA && pB && pA.color === pB.color);

  if (materialDiff <= 1) {
    // Balanced position: Prioritize Cross-Side Shift (rank difference >= 3, opposite colors)
    // Preserve earned advantages by penalizing extreme value asymmetry (e.g. Queen vs minor piece)
    const valDiff =
      pA && pB ? Math.abs((weights[pA.type] ?? 0) - (weights[pB.type] ?? 0)) : 0;
    if (isOppositeColor && rankDist >= 3) {
      score += 120 + rankDist * 12;
      if (valDiff > 3) score -= 85;
      else if (valDiff <= 2) score += 12;
    } else if (isOppositeColor && rankDist >= 2) {
      score += 65 + rankDist * 6;
      if (valDiff > 3) score -= 60;
    } else if (rankDist >= 4) {
      score += 45 + rankDist * 4;
    }
  } else {
    // Unbalanced position: Prioritize Intra-Side Shift (same color, rankDiff <= 1, fileDiff >= 2)
    // Strongly favor the weaker side so they can reorganize wing defense
    const underdogBonus =
      isSameColor && pA && weakerSide && pA.color === weakerSide ? 45 : 0;
    if (isSameColor && rankDist <= 1 && fileDist >= 2) {
      score += 100 + fileDist * 10 + underdogBonus;
    } else if (isSameColor && fileDist >= 2 && rankDist <= 2) {
      score += 60 + fileDist * 6 + Math.round(underdogBonus * 0.7);
    } else if (fileDist >= 3 && rankDist <= 2) {
      score += 45 + fileDist * 3;
    }
  }

  // Secondary priority for minor pieces (Knight, Bishop) & Square Morph opportunities
  if (pA?.type === "n" || pA?.type === "b") score += 8;
  if (pB?.type === "n" || pB?.type === "b") score += 8;
  if (
    willSquareMorph(effect, pA, a, b) ||
    willSquareMorph(effect, pB, b, a)
  ) {
    score += 6;
  }

  return score;
}

export function classifyShiftPair(
  chess: Chess,
  a: Square,
  b: Square,
): "cross-side" | "intra-side" | "slide" {
  const pA = chess.get(a);
  const pB = chess.get(b);
  if (Boolean(pA) !== Boolean(pB)) return "slide";
  if (pA && pB && pA.color === pB.color) return "intra-side";
  return "cross-side";
}

export type ShiftZonePreview = {
  squares: Square[];
  kind: "cross-side" | "intra-side" | "slide";
  until: number;
};

/**
 * Two-stage anticipation: 3-4 plies before a SHIFT (e.g. plies 16-17),
 * reveals the heated region/squares on the board before the exact pair locks at ply 18.
 */
export function shiftZonePreview(match: Match): ShiftZonePreview | null {
  if (match.pending || match.isEnded()) return null;
  const cycle = match.mode === "periodic" ? 20 : 24;
  const until =
    match.mode === "periodic" ? cycle - (match.plies % cycle) : cycle - match.plies;
  if (until <= 2 || until > 4) return null;
  const at = match.plies + until;
  if (at < 30 && match.log.some((entry) => entry === "SHIFT")) return null;
  const candidates = pairsFor(match.chess, match.effect);
  if (!candidates.length) return null;
  const scored = candidates
    .map((pair) => ({
      pair,
      score: evaluatePair(match.chess, pair[0], pair[1], match.effect),
      key: pair[0] + pair[1],
    }))
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.key.localeCompare(b.key),
    );
  const squares = new Set<Square>();
  for (const entry of scored) {
    squares.add(entry.pair[0]);
    squares.add(entry.pair[1]);
    if (squares.size >= 4) break;
  }
  const top = scored[0].pair;
  return {
    squares: [...squares].slice(0, 4),
    kind: classifyShiftPair(match.chess, top[0], top[1]),
    until,
  };
}

function pairsFor(chess: Chess, effect: Effect): Pair[] {
  const cells = chess.board().flat();
  const pairs: Pair[] = [];
  const occupied: (Piece & { square: Square })[] = [];
  const empty: Square[] = [];
  cells.forEach((piece, index) => {
    const square = ("abcdefgh"[index % 8] +
      (8 - Math.floor(index / 8))) as Square;
    if (!piece) empty.push(square);
    else if (canShift(piece)) occupied.push(piece);
  });
  occupied.forEach((first, index) => {
    if (effect === "slide") {
      for (const square of empty) pairs.push([first.square, square]);
      return;
    }
    for (let i = index + 1; i < occupied.length; i++) {
      const second = occupied[i];
      if (movesShiftPair(effect, first, second))
        pairs.push([first.square, second.square]);
    }
  });
  return pairs;
}

export function shiftedPositionDetails(
  chess: Chess,
  shift: Shift,
): { fen: string; morphedSquares: Square[] } | null {
  if (chess.isCheck() || !shift.pairs.length) return null;
  const fen = chess.fen();
  const original = fen.split(" ");
  const result = new Chess(fen);
  const touched = new Set<Square>();
  const morphedSquares: Square[] = [];
  let changed = false;
  for (const [a, b] of shift.pairs) {
    if (a === b || touched.has(a) || touched.has(b)) return null;
    touched.add(a);
    touched.add(b);
    const first = result.get(a);
    const second = result.get(b);
    if (!canShift(first) || !canShift(second)) return null;
    if (!movesShiftPair(shift.effect, first, second)) continue;
    changed = true;
    result.remove(a);
    result.remove(b);
    if (first) {
      const nextType = morphedPieceType(shift.effect, first, a, b);
      if (nextType !== first.type) morphedSquares.push(b);
      result.put({ ...first, type: nextType }, b);
    }
    if (second) {
      const nextType = morphedPieceType(shift.effect, second, b, a);
      if (nextType !== second.type) morphedSquares.push(a);
      result.put({ ...second, type: nextType }, a);
    }
  }
  if (!changed) return null;
  // King safety & instant check neutralization: neither King may be exposed or in check after SHIFT
  for (const color of ["w", "b"] as const) {
    const [king] = result.findPiece({ type: "k", color });
    if (!king || result.isAttacked(king, color === "w" ? "b" : "w"))
      return null;
  }
  const parts = result.fen().split(" ");
  return {
    fen: [
      parts[0],
      original[1],
      parts[2],
      original[3],
      original[4],
      original[5],
    ].join(" "),
    morphedSquares,
  };
}

export function shiftedPosition(chess: Chess, shift: Shift): string | null {
  return shiftedPositionDetails(chess, shift)?.fen ?? null;
}

function buildSimultaneousFen(
  baseFen: string,
  moveW: Move | null,
  moveB: Move | null,
  clash: boolean,
): { fen: string; kingsSafe: boolean } | null {
  const parts = baseFen.split(" ");
  const board = new Chess(baseFen);
  let castling = parts[2];

  const stripCastlingForSquare = (sq: Square) => {
    if (sq === "e1") castling = castling.replace(/[KQ]/g, "");
    if (sq === "a1") castling = castling.replace(/Q/g, "");
    if (sq === "h1") castling = castling.replace(/K/g, "");
    if (sq === "e8") castling = castling.replace(/[kq]/g, "");
    if (sq === "a8") castling = castling.replace(/q/g, "");
    if (sq === "h8") castling = castling.replace(/k/g, "");
  };

  if (moveW) {
    board.remove(moveW.from);
    stripCastlingForSquare(moveW.from);
    if (moveW.isKingsideCastle()) {
      board.remove("h1");
      stripCastlingForSquare("h1");
    } else if (moveW.isQueensideCastle()) {
      board.remove("a1");
      stripCastlingForSquare("a1");
    }
  }
  if (moveB) {
    board.remove(moveB.from);
    stripCastlingForSquare(moveB.from);
    if (moveB.isKingsideCastle()) {
      board.remove("h8");
      stripCastlingForSquare("h8");
    } else if (moveB.isQueensideCastle()) {
      board.remove("a8");
      stripCastlingForSquare("a8");
    }
  }

  if (!clash) {
    if (moveW) {
      if (moveW.isEnPassant()) {
        const epSq = (moveW.to[0] + moveW.from[1]) as Square;
        if (!moveB || moveB.from !== epSq) board.remove(epSq);
      }
      stripCastlingForSquare(moveW.to);
      board.put(
        { type: (moveW.promotion ?? moveW.piece) as PieceSymbol, color: "w" },
        moveW.to,
      );
      if (moveW.isKingsideCastle()) board.put({ type: "r", color: "w" }, "f1");
      else if (moveW.isQueensideCastle())
        board.put({ type: "r", color: "w" }, "d1");
    }
    if (moveB) {
      if (moveB.isEnPassant()) {
        const epSq = (moveB.to[0] + moveB.from[1]) as Square;
        if (!moveW || moveW.from !== epSq) board.remove(epSq);
      }
      stripCastlingForSquare(moveB.to);
      board.put(
        { type: (moveB.promotion ?? moveB.piece) as PieceSymbol, color: "b" },
        moveB.to,
      );
      if (moveB.isKingsideCastle()) board.put({ type: "r", color: "b" }, "f8");
      else if (moveB.isQueensideCastle())
        board.put({ type: "r", color: "b" }, "d8");
    }
  } else {
    // Kings must never be eliminated by a simultaneous clash
    if (moveW?.piece === "k") board.put({ type: "k", color: "w" }, moveW.from);
    if (moveB?.piece === "k") board.put({ type: "k", color: "b" }, moveB.from);
  }

  let kingsSafe = true;
  for (const color of ["w", "b"] as const) {
    const [king] = board.findPiece({ type: "k", color });
    if (!king) return null;
    if (board.isAttacked(king, color === "w" ? "b" : "w")) kingsSafe = false;
  }

  const nextPlacement = board.fen().split(" ")[0];
  const resetHalfmove =
    clash ||
    moveW?.piece === "p" ||
    moveB?.piece === "p" ||
    Boolean(moveW?.captured) ||
    Boolean(moveB?.captured);
  const halfmove = resetHalfmove ? 0 : Number(parts[4]) + 2;
  const fullmove = Number(parts[5]) + 1;
  const nextFen = [
    nextPlacement,
    parts[1],
    castling || "-",
    "-",
    String(halfmove),
    String(fullmove),
  ].join(" ");
  return { fen: nextFen, kingsSafe };
}

export class Match {
  readonly chess = new Chess();
  readonly mode: Exclude<Mode, "random">;
  pending: Shift | null = null;
  plies = 0;
  readonly log: string[] = [];
  private readonly positions = new Map<string, number>();

  readonly effect: Effect;
  private readonly random: () => number;

  constructor(mode: Mode, effect: Effect, random = Math.random) {
    this.effect = effect;
    this.random = random;
    this.mode =
      mode === "random" ? (random() < 0.5 ? "periodic" : "late") : mode;
    this.recordPosition();
  }

  isSimultaneousTurn(): boolean {
    return (
      !this.isEnded() &&
      this.effect === "swap" &&
      this.pending !== null &&
      this.pending.at === this.plies + 2 &&
      !this.chess.isCheck()
    );
  }

  legalMovesFor(color: Color): Move[] {
    if (color === this.chess.turn()) {
      return this.chess.moves({ verbose: true });
    }
    try {
      const probe = new Chess(fenForColor(this.chess.fen(), color));
      return probe.moves({ verbose: true });
    } catch {
      return [];
    }
  }

  private schedule(): Shift | null {
    const at = this.plies + 2;
    const due = this.mode === "periodic" ? at % 20 === 0 : at === 24;
    if (!due) return null;
    // Opening stability rule: strictly at most 1 SHIFT before ply 30
    if (at < 30 && this.log.some((entry) => entry === "SHIFT")) return null;
    const candidates = pairsFor(this.chess, this.effect);
    if (!candidates.length) return null;

    const scored = candidates.map((pair) => ({
      pair,
      score: evaluatePair(this.chess, pair[0], pair[1], this.effect),
      key: pair[0] + pair[1],
    }));
    scored.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.key.localeCompare(b.key),
    );

    const safe = scored.filter(
      ({ pair }) =>
        shiftedPositionDetails(this.chess, {
          at,
          pairs: [pair],
          effect: this.effect,
        }) !== null,
    );
    const pool = safe.length ? safe : scored;
    const first = pool[0].pair;
    const pairs: Pair[] = [first];

    if (this.effect === "double") {
      const disjoint = pool.filter(({ pair }) =>
        pair.every((square) => !first.includes(square)),
      );
      const safeDouble = disjoint.find(
        ({ pair }) =>
          shiftedPositionDetails(this.chess, {
            at,
            pairs: [first, pair],
            effect: "double",
          }) !== null,
      );
      const second = safeDouble?.pair ?? disjoint[0]?.pair;
      if (!second) return null;
      pairs.push(second);
    }
    return { at, pairs, effect: this.effect };
  }

  private positionKey(): string {
    const position = this.chess.fen().split(" ").slice(0, 4).join(" ");
    const phase =
      this.mode === "periodic" ? this.plies % 20 : Math.max(0, 24 - this.plies);
    return JSON.stringify([position, phase, this.pending?.pairs ?? []]);
  }

  private recordPosition() {
    const key = this.positionKey();
    this.positions.set(key, (this.positions.get(key) ?? 0) + 1);
  }

  playSimultaneous(
    white: MoveInput,
    black: MoveInput,
  ): SimultaneousOutcome {
    const baseFen = this.chess.fen();
    const chessW = new Chess(fenForColor(baseFen, "w"));
    const chessB = new Chess(fenForColor(baseFen, "b"));

    const moveW = chessW.move(white);
    const moveB = chessB.move(black);
    if (!moveW || !moveB) {
      throw new Error("Invalid simultaneous move attempt");
    }

    const collision = detectSimultaneousCollision(
      white.from,
      white.to,
      moveW.piece,
      black.from,
      black.to,
      moveB.piece,
    );
    const involvesKing = moveW.piece === "k" || moveB.piece === "k";
    let clash = collision.clash && !involvesKing;

    let neutralizedCheck = false;
    let outcome = buildSimultaneousFen(baseFen, moveW, moveB, clash);

    // King protection & post-SHIFT check neutralization:
    // Neither king may be left exposed or in immediate check after simultaneous resolution
    if (!outcome || !outcome.kingsSafe) {
      neutralizedCheck = true;
      clash = false;
      const fallbacks = [
        buildSimultaneousFen(baseFen, moveW, null, false),
        buildSimultaneousFen(baseFen, null, moveB, false),
        buildSimultaneousFen(baseFen, null, null, false),
      ];
      outcome =
        fallbacks.find((candidate) => candidate && candidate.kingsSafe) ??
        fallbacks[2]!;
    }

    this.chess.load(outcome.fen);

    if (clash) {
      const clashDesc = collision.clashSquare
        ? `CLASH: ${moveW.piece.toUpperCase()}x${moveB.piece} ${collision.clashSquare}`
        : `CLASH: ${moveW.piece.toUpperCase()}x${moveB.piece} ${white.from}↔${black.from}`;
      this.log.push(clashDesc);
    } else if (neutralizedCheck) {
      this.log.push(`${moveW.san} | ${moveB.san} (shield)`);
    } else {
      this.log.push(`${moveW.san} | ${moveB.san}`);
    }

    const beforeShift = this.chess.board();
    this.plies += 2;
    const settlement = this.settle();
    return {
      ...settlement,
      whiteMove: moveW,
      blackMove: moveB,
      clash,
      clashSquare: collision.clashSquare,
      clashMidpoint: collision.clashMidpoint,
      neutralizedCheck,
      beforeShift,
    };
  }

  isEnded() {
    return (
      this.chess.isCheckmate() ||
      this.chess.isStalemate() ||
      this.chess.isInsufficientMaterial() ||
      this.chess.isDrawByFiftyMoves() ||
      (this.positions.get(this.positionKey()) ?? 0) >= 3
    );
  }

  snapshot(): MatchState {
    return {
      fen: this.chess.fen(),
      mode: this.mode,
      effect: this.effect,
      pending: this.pending ? structuredClone(this.pending) : null,
      plies: this.plies,
      log: [...this.log],
      positions: [...this.positions],
    };
  }

  static restore(state: MatchState, random = Math.random) {
    const match = new Match(state.mode, state.effect, random);
    match.chess.load(state.fen);
    match.pending = state.pending ? structuredClone(state.pending) : null;
    match.plies = state.plies;
    match.log.push(...state.log);
    match.positions.clear();
    state.positions.forEach(([key, count]) => match.positions.set(key, count));
    return match;
  }

  play(from: Square, to: Square, promotion?: string): Move {
    const move = this.chess.move({ from, to, promotion });
    this.plies++;
    this.log.push(move.san);
    return move;
  }

  settle(): Settlement {
    const terminal =
      this.chess.isCheckmate() ||
      this.chess.isStalemate() ||
      this.chess.isInsufficientMaterial() ||
      this.chess.isDrawByFiftyMoves();
    const due = this.pending?.at === this.plies ? this.pending : null;
    const previous = this.pending;
    let applied = false;
    let morphedSquares: Square[] = [];
    if (due && !terminal) {
      const details = shiftedPositionDetails(this.chess, due);
      if (details) {
        this.chess.load(details.fen);
        applied = true;
        morphedSquares = details.morphedSquares;
      }
      this.log.push(applied ? "SHIFT" : "shift-skipped");
    }
    if (terminal || due) this.pending = null;
    if (!terminal && !this.pending) this.pending = this.schedule();
    this.recordPosition();
    return {
      due,
      applied,
      announced: this.pending !== previous && Boolean(this.pending),
      morphedSquares,
    };
  }
}
