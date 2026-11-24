import type { Square } from "chess.js";
import type { CopyKey } from "./copy";
import {
  classifyShiftPair,
  morphedPieceType,
  movesShiftPair,
  shiftZonePreview,
  willSquareMorph,
  type Match,
  type Shift,
} from "./rules";
import { pieceIcons } from "./players";
import { icons } from "./icons";

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
  const simultaneous = !beforeShift && !over && match.isSimultaneousTurn();
  const zone = !beforeShift && !over && !pending ? shiftZonePreview(match) : null;
  panel.dataset.phase = beforeShift
    ? "active"
    : simultaneous
      ? "simultaneous"
      : pending && !over
        ? "pending"
        : zone
          ? "zone"
          : "idle";
  event.replaceChildren();
  document.getElementById("shift-heading")!.textContent = "SHIFT · " + t(effect);
  const symbolEl = panel.querySelector(".shift-symbol");
  if (symbolEl) {
    symbolEl.innerHTML =
      effect === "slide" ? icons.slideArrow : effect === "double" ? icons.shiftGrid : icons.swapArrows;
  }
  const cycle = timing === "periodic" ? 20 : 24;
  const until = pending
    ? pending.at - plies
    : timing === "periodic"
      ? cycle - (plies % cycle)
      : cycle - plies;
  const pips = document.getElementById("shift-pips")!;
  const totalPips = pips.children.length;
  const charged = Math.floor((totalPips * (cycle - until)) / cycle);
  const progress = over
    ? 0
    : beforeShift
      ? totalPips
      : Math.min(totalPips, Math.max(0, charged));
  const countdown = over
    ? t("finished")
    : beforeShift
      ? t("shifting")
      : until <= 0
        ? t("lateDone")
        : t(pending ? (until === 1 ? "oneMove" : "manyMoves") : "nextShift")
            .replace("{n}", String(until));
  pips.setAttribute("aria-valuenow", String(progress));
  pips.setAttribute("aria-valuetext", countdown);
  document.getElementById("shift-info")!.title = countdown;
  const countdownEl = document.getElementById("shift-countdown");
  if (countdownEl) countdownEl.textContent = countdown;
  for (let i = 0; i < totalPips; i++) {
    const pip = pips.children[i];
    pip.classList.toggle("filled", i < progress);
    pip.classList.toggle("next", i === progress && (Boolean(pending) || Boolean(zone)) && !over);
  }
  if (pending && !over) {
    pending.pairs.forEach(([a, b], i) => {
      const mark = document.createElement("strong");
      mark.className = i ? "pair alternate" : "pair";
      mark.dataset.pair = i ? "B" : "A";
      const getPiece = (square: Square) =>
        beforeShift
          ? beforeShift[8 - Number(square[1])][square.charCodeAt(0) - 97]
          : chess.get(square);
      const first = getPiece(a);
      const second = getPiece(b);
      if (
        beforeShift &&
        !movesShiftPair(pending.effect, first ?? undefined, second ?? undefined)
      )
        return;
      const blocked =
        pending.effect === "slide" &&
        !movesShiftPair("slide", first ?? undefined, second ?? undefined);
      const arrow = blocked
        ? " · "
        : Boolean(first) !== Boolean(second)
          ? first
            ? " → "
            : " ← "
          : " ↔ ";
      const firstMorph = first && willSquareMorph(pending.effect, first, a, b);
      const secondMorph = second && willSquareMorph(pending.effect, second, b, a);
      const from = first
        ? (firstMorph
            ? `${pieceIcons[first.type]}→${pieceIcons[morphedPieceType(pending.effect, first, a, b)]} `
            : pieceIcons[first.type] + " ") + a
        : a;
      const to = second
        ? b +
          (secondMorph
            ? ` ${pieceIcons[second.type]}→${pieceIcons[morphedPieceType(pending.effect, second, b, a)]}`
            : " " + pieceIcons[second.type])
        : b;
      if (firstMorph || secondMorph) mark.dataset.morph = "true";
      mark.textContent =
        from + arrow + to + (blocked ? " · " + t("slideBlocked") : "");
      event.append(mark);
    });
    if (!beforeShift && pending.pairs.length === 1 && pending.effect !== "slide") {
      const [a, b] = pending.pairs[0];
      const kind = classifyShiftPair(chess, a, b);
      if (kind !== "slide") {
        const tag = document.createElement("span");
        tag.className = "shift-kind-tag";
        tag.dataset.kind = kind;
        tag.textContent = t(kind === "cross-side" ? "crossSideTag" : "intraSideTag");
        event.append(tag);
      }
    }
    return;
  }
  if (zone) {
    const tag = document.createElement("span");
    tag.className = "shift-kind-tag shift-zone-tag";
    tag.textContent = t("zoneApproaching");
    event.append(tag);
  }
  if (message && !over) {
    const note = document.createElement("span");
    note.className = "shift-status-note";
    note.textContent = t(message);
    event.append(note);
  }
}
