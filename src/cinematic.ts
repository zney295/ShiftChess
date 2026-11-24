import { Chess } from "chess.js";
import type { GameAudio } from "./audio";
import { shiftedPosition, type Shift } from "./rules";
import type { CameraShot, Stage } from "./stage";

const position = "2r3k1/5ppp/8/1Q6/8/8/5PPP/4R1K1 w - - 0 1";
const shift: Shift = { at: 6, effect: "slide", pairs: [["b5", "e5"]] };
const wideShot: CameraShot = {
  from: [0, 12.4, 8.1], to: [0, 11.4, 7.55], target: [0, 0.22, -0.35], duration: 2200,
};
const shiftShot: CameraShot = {
  from: [-0.95, 6.7, 3.7], to: [-0.95, 6, 3.2], target: [-0.95, 0.34, -0.9], duration: 1630,
};
const moves = [
  { san: "Qe8+", wait: 1240,
    shot: { from: [0.7, 6.2, 1.5], to: [0.7, 5.5, 1], target: [0.7, 0.45, -2.45], duration: 1550 } },
  { san: "Rxe8", wait: 1260,
    shot: { from: [-0.45, 4.5, 0.4], to: [-0.45, 4, -0.45], target: [-0.45, 0.54, -3.39], duration: 1930 } },
  { san: "Rxe8#", wait: 2250,
    shot: { from: [0.75, 9.2, 4.5], to: [0.75, 8, 3.45], target: [0.75, 0.42, -1.8], duration: 2600 } },
] satisfies { san: string; wait: number; shot: CameraShot }[];

function hold(signal: AbortSignal, ms: number) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason);
    };
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function playScene(stage: Stage, signal: AbortSignal, reveal: () => void, audio?: GameAudio) {
  const chess = new Chess(position);
  stage.indicate(null);
  stage.sync(chess.board());
  stage.setShot(wideShot);
  reveal();
  audio?.filmCue("opening");
  await hold(signal, 2000);

  stage.setShot(shiftShot);
  stage.indicate(shift);
  audio?.filmCue("shift");
  await hold(signal, 520);
  const shifted = shiftedPosition(chess, shift);
  if (!shifted) throw new Error("The cinematic SHIFT position is invalid");
  await stage.shift(shift, pair => audio?.shiftLand(pair));
  signal.throwIfAborted();
  chess.load(shifted);
  stage.sync(chess.board());
  stage.indicate(null);
  await hold(signal, 540);

  for (const beat of moves) {
    const move = chess.move(beat.san);
    stage.setShot(beat.shot);
    audio?.filmCue("cut");
    await hold(signal, 450);
    await stage.move(move, () => {
      if (!audio) return;
      audio.move(Boolean(move.captured), move.piece);
      if (chess.isCheckmate()) audio.filmCue("mate");
      else if (chess.isCheck()) audio.check();
    });
    signal.throwIfAborted();
    stage.sync(chess.board());
    stage.indicate(null, undefined, [], chess.isCheck() ? "g8" : undefined, move);
    await hold(signal, beat.wait);
  }
}

export async function loopLobbyCinematic(
  stage: Stage, signal: AbortSignal, setFaded: (faded: boolean) => void, audio?: GameAudio,
) {
  stage.setSetting("library");
  while (!signal.aborted) {
    await playScene(stage, signal, () => setFaded(false), audio);
    setFaded(true);
    await hold(signal, 460);
  }
}
