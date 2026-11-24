import type { Square } from "chess.js";
import type { CopyKey } from "./copy";
import { movesShiftPair, type Match, type Shift } from "./rules";
import { pieceIcons } from "./players";

export function drawShift(
  match: Match,
  t: (key: CopyKey) => string,
  message: CopyKey | undefined,
  pending: Shift | null,
  over: boolean,
  beforeShift?: ReturnType<Match["chess"]["board"]>,
) {
  const { chess, plies, effect, mode: timing } = match;
  const event = document.getElementById("event")!;
  const panel = event.parentElement!;
  panel.dataset.phase = beforeShift ? "active" : pending && !over ? "pending" : "idle";
  event.replaceChildren();
  document.getElementById("shift-heading")!.textContent = "SHIFT · " + t(effect);
  const cycle = timing === "periodic" ? 6 : 24;
  const until = pending ? pending.at - plies : timing === "periodic" ? cycle - plies % cycle : cycle - plies;
  const charged = Math.floor(6 * (cycle - until) / cycle);
  const progress = over ? 0 : beforeShift ? 6 : Math.min(6, Math.max(0, charged));
  const countdown = over ? t("finished") : beforeShift ? t("shifting")
    : until <= 0 ? t("lateDone") : t(pending ? (until === 1 ? "oneMove" : "manyMoves") : "nextShift")
      .replace("{n}", String(until));
  const pips = document.getElementById("shift-pips")!;
  pips.setAttribute("aria-valuenow", String(progress));
  pips.setAttribute("aria-valuetext", countdown);
  document.getElementById("shift-info")!.title = countdown;
  for (let i = 0; i < 6; i++) {
    const pip = pips.children[i];
    pip.classList.toggle("filled", i < progress);
    pip.classList.toggle("next", i === progress && Boolean(pending) && !over);
  }
  if (pending && !over) {
    pending.pairs.forEach(([a, b], i) => {
      const mark = document.createElement("strong");
      mark.className = i ? "pair alternate" : "pair";
      mark.dataset.pair = i ? "B" : "A";
      const getPiece = (square: Square) => beforeShift
        ? beforeShift[8 - Number(square[1])][square.charCodeAt(0) - 97]
        : chess.get(square);
      const first = getPiece(a);
      const second = getPiece(b);
      if (beforeShift && !movesShiftPair(pending.effect, first ?? undefined, second ?? undefined)) return;
      const blocked = pending.effect === "slide" &&
        !movesShiftPair("slide", first ?? undefined, second ?? undefined);
      const arrow = blocked ? " · " : Boolean(first) !== Boolean(second)
        ? (first ? " → " : " ← ") : " ↔ ";
      const from = first ? pieceIcons[first.type] + " " + a : a;
      const to = second ? b + " " + pieceIcons[second.type] : b;
      mark.textContent = from + arrow + to + (blocked ? " · " + t("slideBlocked") : "");
      event.append(mark);
    });
    const count = document.createElement("span");
    count.className = "shift-count";
    count.textContent = countdown;
    event.append(count);
    return;
  }
  const count = document.createElement("span");
  count.className = "shift-count";
  count.textContent = countdown;
  event.append(count);
  if (message && !over) event.append(document.createTextNode(t(message)));
}
