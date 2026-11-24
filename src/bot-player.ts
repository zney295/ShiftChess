import type { Move } from "chess.js";
import type { Match } from "./rules";
import type { Difficulty } from "./bot";

export type MoveChoice = Pick<Move, "from" | "to" | "promotion">;

export class BotPlayer {
  private worker?: Worker;
  thinking = false;
  private requestId = 0;

  reset() {
    this.requestId++;
    this.worker?.terminate();
    this.worker = undefined;
    this.thinking = false;
  }

  warm() {
    try {
      if (this.worker) return;
      const worker = new Worker(new URL("./bot.worker.ts", import.meta.url), { type: "module" });
      this.worker = worker;
      worker.onerror = () => {
        worker.terminate();
        if (this.worker === worker) this.worker = undefined;
      };
    } catch {}
  }

  request(match: Match, difficulty: Difficulty, onMove: (move?: MoveChoice) => void) {
    this.warm();
    const requestId = ++this.requestId;
    this.thinking = true;
    const finish = (move?: MoveChoice) => {
      if (requestId !== this.requestId || !this.thinking) return;
      this.thinking = false;
      onMove(move ?? match.chess.moves({ verbose: true })[0]);
    };
    const worker = this.worker;
    if (!worker) return finish();
    worker.onmessage = (event) => finish(event.data.move);
    worker.onerror = () => {
      worker.terminate();
      if (this.worker === worker) this.worker = undefined;
      finish();
    };
    worker.postMessage({ state: match.snapshot(), difficulty });
  }
}
