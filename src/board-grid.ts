import type { Chess, Color, Move, Square } from "chess.js";
import type { CopyKey } from "./copy";

type Translate = (key: CopyKey) => string;
const glyphs = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export class BoardGrid {
  private readonly rows: HTMLElement[] = [];
  private readonly cells = new Map<Square, HTMLButtonElement>();
  private order: Square[] = [];
  private focusSquare: Square = "a8";
  private side?: Color;
  private lastMove?: Move;

  constructor(private readonly grid: HTMLElement, choose: (square: Square) => void) {
    for (let rank = 8; rank >= 1; rank--) {
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      this.rows.push(row);
      for (const file of "abcdefgh") {
        const square = (file + rank) as Square;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.setAttribute("role", "gridcell");
        cell.tabIndex = -1;
        cell.dataset.square = square;
        cell.dataset.light = String((file.charCodeAt(0) - 97 + rank) % 2 === 0);
        cell.onclick = () => choose(square);
        cell.onfocus = () => this.setFocus(square);
        this.cells.set(square, cell);
      }
    }
    grid.replaceChildren(...this.rows);
    grid.addEventListener("keydown", (event) => this.navigate(event));
  }

  private setFocus(square: Square) {
    this.cells.get(this.focusSquare)!.tabIndex = -1;
    this.focusSquare = square;
    this.cells.get(square)!.tabIndex = 0;
  }

  private navigate(event: KeyboardEvent) {
    const index = this.order.indexOf(this.focusSquare);
    const column = index % 8;
    const destinations: Record<string, number> = {
      ArrowLeft: index - Math.min(column, 1),
      ArrowRight: index + Math.min(7 - column, 1),
      ArrowUp: Math.max(index - 8, column),
      ArrowDown: Math.min(index + 8, 56 + column),
      Home: event.ctrlKey ? 0 : index - column,
      End: event.ctrlKey ? 63 : index - column + 7,
    };
    const next = this.order[destinations[event.key]];
    if (!next) return;
    event.preventDefault();
    this.cells.get(next)!.focus();
  }

  draw(chess: Chess, options: {
    side: Color; activeSide?: Color; playable: boolean; selected?: Square; lastMove?: Move;
    targets: Square[]; hints: boolean; check?: Square; shifts?: readonly (readonly Square[])[];
  }, t: Translate) {
    const { side, activeSide = chess.turn(), playable, selected, targets, hints, lastMove, check, shifts } = options;
    if (this.side !== side) {
      this.side = side;
      this.order = [...this.cells.keys()];
      if (side === "b") this.order.reverse();
      this.rows.forEach((row, index) => row.replaceChildren(
        ...this.order.slice(index * 8, index * 8 + 8).map((square) => this.cells.get(square)!),
      ));
      this.setFocus(this.order[0]);
    }
    this.grid.setAttribute("aria-label", t("board"));
    this.grid.setAttribute("aria-description", t("gridKeys"));
    this.grid.toggleAttribute("data-hints", hints);
    for (const [square, cell] of this.cells) {
      const piece = chess.get(square);
      const key = piece ? (piece.color === "w" ? piece.type.toUpperCase() : piece.type) as keyof typeof glyphs : undefined;
      const next = key ? glyphs[key] : "";
      const highlighted = targets.includes(square);
      const pair = shifts?.findIndex((squares) => squares.includes(square)) ?? -1;
      const label = [square, piece ? t(piece.color === "w" ? "whiteSide" : "blackSide") + " " + t(piece.type) : t("emptySquare")];
      if (highlighted) label.push(t("legalTarget"));
      if (square === check) label.push(t("check"));
      if (pair >= 0) label.push("SHIFT " + (pair === 0 ? "A" : "B"));
      if (cell.textContent !== next) cell.textContent = next;
      cell.setAttribute("aria-label", label.join(", "));
      cell.setAttribute("aria-selected", String(square === selected));
      cell.setAttribute("aria-disabled", String(!playable || (!highlighted && piece?.color !== activeSide)));
      cell.toggleAttribute("data-target", highlighted);
      cell.toggleAttribute("data-last", lastMove?.from === square || lastMove?.to === square);
      cell.toggleAttribute("data-check", square === check);
      cell.dataset.shift = pair === 0 ? "A" : pair === 1 ? "B" : "";
    }
    if (lastMove?.promotion && lastMove !== this.lastMove &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const piece = chess.get(lastMove.to);
      if (piece?.type === lastMove.promotion && piece.color === lastMove.color)
        this.cells.get(lastMove.to)?.animate(
          [{ opacity: 0.58 }, { opacity: 1, offset: 1 }], { duration: 260, easing: "ease-out" },
        );
    }
    this.lastMove = lastMove;
  }
}
