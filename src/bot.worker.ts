import { bestMove } from "./bot";
self.onmessage = (event) => {
  try {
    self.postMessage({
      move: bestMove(event.data.state, event.data.difficulty),
    });
  } catch {
    self.postMessage({ error: true });
  }
};
