import { Chess, type Color, type Move, type Piece, type Square } from 'chess.js';

export type Mode = 'periodic' | 'late' | 'random';
export type Effect = 'swap' | 'slide' | 'double';
export type Pair = [Square, Square];
export type Shift = { pairs: Pair[]; at: number; effect: Effect };
export const effects: Effect[] = ['swap', 'slide', 'double'];

const canShift = (piece?: Piece) => piece?.type !== 'k' && piece?.type !== 'p';

function pairsFor(chess: Chess, effect: Effect): Pair[] {
  const cells = chess.board().flat();
  const pairs: Pair[] = [];
  const occupied: Square[] = [];
  const empty: Square[] = [];
  cells.forEach((piece, index) => {
    const square = ('abcdefgh'[index % 8] + (8 - Math.floor(index / 8))) as Square;
    if (!piece) empty.push(square);
    else if (canShift(piece)) occupied.push(square);
  });
  occupied.forEach((a, index) => {
    const partners = effect === 'slide' ? empty : occupied.slice(index + 1);
    partners.forEach(b => {
      const first = chess.get(a);
      const second = chess.get(b);
      if (!first || (second && first.type === second.type && first.color === second.color)) return;
      pairs.push([a, b]);
    });
  });
  return pairs;
}

export function shiftedPosition(chess: Chess, shift: Shift): string | null {
  if (chess.isCheck() || !shift.pairs.length) return null;
  const original = chess.fen().split(' ');
  const result = new Chess(chess.fen());
  const touched = new Set<Square>();
  let changed = false;
  for (const [a, b] of shift.pairs) {
    if (a === b || touched.has(a) || touched.has(b)) return null;
    touched.add(a);
    touched.add(b);
    const first = result.get(a);
    const second = result.get(b);
    if (!canShift(first) || !canShift(second)) return null;
    if (shift.effect === 'slide' && Boolean(first) === Boolean(second)) continue;
    if ((!first && !second) || (first && second && first.type === second.type && first.color === second.color)) continue;
    changed = true;
    result.remove(a);
    result.remove(b);
    if (first) result.put(first, b);
    if (second) result.put(second, a);
  }
  if (!changed) return null;
  const parts = result.fen().split(' ');
  const fen = [parts[0], original[1], parts[2], original[3], original[4], original[5]].join(' ');
  const verified = new Chess(fen);
  for (const color of ['w', 'b'] as Color[]) {
    const king = verified.board().flat().find(piece => piece?.type === 'k' && piece.color === color);
    if (!king || verified.isAttacked(king.square, color === 'w' ? 'b' : 'w')) return null;
  }
  return fen;
}

export class Match {
  readonly chess = new Chess();
  readonly mode: Exclude<Mode, 'random'>;
  pending: Shift | null = null;
  plies = 0;
  readonly log: string[] = [];
  private readonly positions = new Map<string, number>();

  readonly effect: Effect;
  private readonly random: () => number;

  constructor(mode: Mode, effect: Effect, random = Math.random) {
    this.effect = effect;
    this.random = random;
    this.mode = mode === 'random' ? (random() < 0.5 ? 'periodic' : 'late') : mode;
    this.recordPosition();
  }

  private schedule(): Shift | null {
    const at = this.plies + 2;
    const due = this.mode === 'periodic' ? at % 6 === 0 : at === 24;
    if (!due) return null;
    const candidates = pairsFor(this.chess, this.effect);
    if (!candidates.length) return null;
    const first = candidates[Math.floor(this.random() * candidates.length)];
    const pairs = [first];
    if (this.effect === 'double') {
      const remaining = candidates.filter(pair => pair.every(square => !first.includes(square)));
      if (!remaining.length) return null;
      pairs.push(remaining[Math.floor(this.random() * remaining.length)]);
    }
    return { at, pairs, effect: this.effect };
  }

  private positionKey(): string {
    const position = this.chess.fen().split(' ').slice(0, 4).join(' ');
    const phase = this.mode === 'periodic' ? this.plies % 6 : Math.max(0, 24 - this.plies);
    return JSON.stringify([position, phase, this.pending?.pairs ?? []]);
  }

  private recordPosition() {
    const key = this.positionKey();
    this.positions.set(key, (this.positions.get(key) ?? 0) + 1);
  }

  isEnded() {
    return this.chess.isCheckmate() || this.chess.isStalemate() ||
      this.chess.isInsufficientMaterial() || this.chess.isDrawByFiftyMoves() ||
      (this.positions.get(this.positionKey()) ?? 0) >= 3;
  }

  play(from: Square, to: Square, promotion?: string): Move {
    const move = this.chess.move({ from, to, promotion });
    this.plies++;
    this.log.push(move.san);
    return move;
  }

  settle() {
    const terminal = this.chess.isCheckmate() || this.chess.isStalemate() ||
      this.chess.isInsufficientMaterial() || this.chess.isDrawByFiftyMoves();
    const due = this.pending?.at === this.plies ? this.pending : null;
    const previous = this.pending;
    let applied = false;
    if (due && !terminal) {
      const fen = shiftedPosition(this.chess, due);
      if (fen) {
        this.chess.load(fen);
        applied = true;
      }
      this.log.push(applied ? 'SHIFT' : 'shift-skipped');
    }
    if (terminal || due) this.pending = null;
    if (!terminal && !this.pending) this.pending = this.schedule();
    this.recordPosition();
    return { due, applied, announced: this.pending !== previous && Boolean(this.pending) };
  }
}
