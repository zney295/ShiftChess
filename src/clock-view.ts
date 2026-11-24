import type { Color } from "chess.js";
import type { Clock } from "./network";

export class ClockView {
  private tick?: number;

  constructor(private readonly displays: Record<Color, HTMLElement>) {}

  pause() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  show(clock?: Clock, turn?: Color, receivedAt = performance.now()) {
    this.pause();
    const active = clock?.deadline != null ? turn : undefined;
    for (const display of Object.values(this.displays)) display.hidden = !clock;
    if (!clock) return;
    const draw = () => {
      for (const side of ["w", "b"] as const) {
        const remaining = active === side
          ? clock.deadline! - clock.serverNow - (performance.now() - receivedAt)
          : clock.remaining[side];
        const seconds = Math.max(0, Math.ceil(remaining / 1000));
        const value = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
        if (this.displays[side].textContent !== value) this.displays[side].textContent = value;
      }
    };
    draw();
    if (active) this.tick = window.setInterval(draw, 200);
  }
}

export class TurnClock {
  private tick?: number;

  constructor(private readonly cards: Record<Color, HTMLElement>) {}

  clear() {
    clearInterval(this.tick);
    for (const card of Object.values(this.cards)) delete card.dataset.timed;
  }

  show(side: Color, duration: number, remaining: number, running: boolean, expire?: () => void) {
    this.clear();
    const card = this.cards[side];
    const end = performance.now() + remaining;
    card.dataset.timed = "";
    const draw = () => {
      const left = Math.max(0, running ? end - performance.now() : remaining);
      card.style.setProperty("--turn-left", String(Math.min(1, left / duration) * 100));
      const label = card.querySelector<HTMLElement>(".turn-seconds")!;
      const seconds = String(Math.ceil(left / 1000));
      if (label.textContent !== seconds) label.textContent = seconds;
      if (running && !left) {
        clearInterval(this.tick);
        expire?.();
      }
    };
    if (running) this.tick = window.setInterval(draw, 100);
    draw();
  }
}
