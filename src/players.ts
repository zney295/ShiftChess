import type { Color, PieceSymbol } from "chess.js";
import type { Match } from "./rules";
import type { CopyKey } from "./copy";

const startingPieces = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const pieceIcons = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const pieceTypes = ["q", "r", "b", "n", "p", "k"] as const;
export function drawPlayers(current: Match, side: Color, over: boolean, t: (key: CopyKey) => string) {
  const remaining = { w: { ...startingPieces }, b: { ...startingPieces } };
  const material = { w: 0, b: 0 };
  // A SHIFT changes squares only. SAN promotions account for pieces added since the initial board.
  let moveSide: Color = "w";
  for (const entry of current.log) {
    if (entry === "SHIFT" || entry === "shift-skipped") continue;
    const promoted = entry.match(/=([QRBN])/)?.[1].toLowerCase() as PieceSymbol | undefined;
    if (promoted) {
      remaining[moveSide].p--;
      remaining[moveSide][promoted]++;
    }
    moveSide = moveSide === "w" ? "b" : "w";
  }
  for (const piece of current.chess.board().flat()) {
    if (!piece) continue;
    remaining[piece.color][piece.type]--;
    material[piece.color] += pieceValues[piece.type];
  }
  for (const [color, opponent, name] of [["w", "b", "white"], ["b", "w", "black"]] as const) {
    const player = document.getElementById(`${name}-player`)!;
    player.dataset.active = String(!over && side === color);
    const label = t(!over && side === color ? color === "w" ? "whiteTurn" : "blackTurn" : color === "w" ? "whiteSide" : "blackSide");
    player.setAttribute("aria-label", label);
    player.title = label;
    const lead = material[color] - material[opponent];
    document.getElementById(`advantage-${name}`)!.textContent = lead > 0 ? `+${lead}` : "";
    const icons: HTMLElement[] = [];
    for (const piece of pieceTypes) {
      for (let i = 0; i < remaining[opponent][piece]; i++) {
        const icon = document.createElement("span");
        icon.textContent = pieceIcons[piece];
        icon.setAttribute("role", "img");
        icon.setAttribute("aria-label", t(piece));
        icon.title = t(piece);
        icons.push(icon);
      }
    }
    const tray = document.getElementById(`captured-${name}`)!;
    tray.replaceChildren(...icons);
    tray.dataset.capturedSide = opponent;
  }
}
