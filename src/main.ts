import { Chess, type Color, type Move, type Square } from "chess.js";
import { GameAudio } from "./audio";
import { copy, type CopyKey } from "./copy";
import { automaticMove, effects, Match, turnTimeMs, type MatchState } from "./rules";
import { Connection, serverUrl, type Room, type RoomPacket } from "./network";
import type { Difficulty } from "./bot";
import type { Stage } from "./stage";
import { BotPlayer, type MoveChoice } from "./bot-player";
import { BoardGrid } from "./board-grid";
import { ClockView, TurnClock } from "./clock-view";
import { drawPlayers } from "./players";
import { drawShift } from "./shift-hud";
import { template } from "./template";
import { bindPreferenceControls, loadPreferences, savePreferences } from "./preferences";
import "./style.css";

const host = document.querySelector<HTMLElement>("#app")!;
host.innerHTML = template;
const get = <E extends HTMLElement>(id: string) =>
  document.getElementById(id) as E;
const button = (id: string) => get<HTMLButtonElement>(id);
const dialog = (id: string) => get<HTMLDialogElement>(id);
const picker = get<HTMLSelectElement>("piece"),
  targetPicker = get<HTMLSelectElement>("target");
const screens = {
  start: get("start-screen"),
  mode: get("mode-screen"),
  online: get("online-screen"),
  lobby: get("lobby-screen"),
  play: get("play-screen"),
};
const audio = new GameAudio();
const bot = new BotPlayer();
const boardGrid = new BoardGrid(get("board-grid"), (square) => void choose(square));
const clockView = new ClockView({ w: get("white-clock"), b: get("black-clock") });
const turnClock = new TurnClock({ w: get("white-player"), b: get("black-player") });
const preferences = loadPreferences();
audio.muted = preferences.muted;
const t = (key: CopyKey) => copy[preferences.language][key];
let stage: Stage | undefined,
  match: Match | undefined,
  setting: "park" | "library" = "park";
let stageLoader: Promise<Stage | undefined> | undefined;
let flatBoard = false;
let selected: Square | undefined,
  busy = false,
  loading = false;
let mode: "local" | "bot" | "online" = "local",
  difficulty: Difficulty = "normal";
let message: CopyKey | undefined,
  generation = 0;
let lastMove: Move | undefined;
let botReply: MoveChoice | undefined;
const undoHistory: { state: MatchState; lastMove?: Move }[] = [];
let legalCache: { match: Match; plies: number; moves: Move[] } | undefined;
let network: Connection | undefined,
  room: Room | undefined,
  ownColor: Color = "w",
  status: CopyKey = "connected";
let watching = false;
let localReady = false;
let forcedResult: { winner: Color | null; reason: string } | undefined;
let roomQueue = Promise.resolve(),
  toastTimer: number | undefined,
  acceptSent = false,
  lastOutcomeGeneration = -1;
let lobbyCinematic: AbortController | undefined;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const input = (id: string) => get<HTMLInputElement>(id);
const select = (id: string) => get<HTMLSelectElement>(id);
const visualTheme = () => preferences.theme === "random" ? setting : preferences.theme;
function applyStagePreferences() {
  stage?.quality(preferences.quality === "high");
  stage?.preferences({
    speed: preferences.speed,
    cameraShake: preferences.shake,
    showHints: preferences.hints,
  });
}
function frameMatch() {
  host.dataset.boardView = flatBoard ? "2d" : preferences.boardView;
  host.dataset.facing = cameraSide();
  if (!flatBoard) stage?.frame(cameraSide(), preferences.boardView === "2d",
    preferences.boardView === "3d-high" ? 60 : 45);
}
function hideBriefing() {
  dialog("briefing").close();
}

function closePanels() {
  for (const d of host.querySelectorAll<HTMLDialogElement>("dialog[open]"))
    d.close();
}
function showScreen(active: keyof typeof screens, focus?: HTMLElement) {
  const enteringStart = active === "start" && host.dataset.screen !== "start";
  if (active !== "start") stopLobbyCinematic();
  for (const [key, node] of Object.entries(screens))
    node.hidden = key !== active;
  host.dataset.screen = active;
  button("menu").hidden = active !== "play";
  get("board-grid").inert = active !== "play";
  get("board-grid").hidden = active !== "play";
  if (active !== "play") {
    hideBriefing();
    clearTimeout(toastTimer);
    clearToast();
  }
  focus?.focus({ preventScroll: true });
  if (enteringStart) void showPreview();
}
function openPanel(id: string) {
  if (document.querySelector("dialog[open]")) return;
  dialog(id).showModal();
  updateLobbyCinematic();
}
const noticeTitles: Partial<Record<CopyKey, CopyKey>> = {
  automaticMove: "automaticMoveTitle",
  pausedOnline: "connectionInterrupted",
};
function clearToast() {
  get("board-toast-title").textContent = "";
  get("board-toast-text").textContent = "";
}
function toast(key: CopyKey) {
  const title = noticeTitles[key];
  get("board-toast").dataset.tone = key === "automaticMove" || key === "webgl" ? "info" : "warning";
  get("board-toast-title").textContent = title ? t(title) : "";
  get("board-toast-text").textContent = t(key);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(clearToast, 4200);
}
const ended = () => Boolean(match?.isEnded() || forcedResult);
const cameraSide = (): Color => {
  if (mode === "local") {
    return preferences.localFlip && match ? match.chess.turn() : "w";
  }
  return watching ? "w" : ownColor;
};
const mayPlay = (over = ended()) =>
  Boolean(
    match &&
    !watching &&
    !busy &&
    !over &&
    (mode === "local" || match.chess.turn() === ownColor) &&
    (mode !== "online" ||
      (status === "connected" &&
        room?.phase === "playing" &&
        room.players.every((p) => p.connected))) &&
    (mode === "online" || localReady),
  );

function draw(keepTarget = false) {
  if (!match) return;
  const { chess, pending, plies, effect } = match,
    side = chess.turn();
  const over = ended();
  const playable = mayPlay(over);
  const king = chess.isCheck()
    ? chess
        .board()
        .flat()
        .find((p) => p?.type === "k" && p.color === side)
    : undefined;
  if (playable && (legalCache?.match !== match || legalCache.plies !== plies))
    legalCache = { match, plies, moves: chess.moves({ verbose: true }) };
  const legal = playable ? legalCache!.moves : [];
  const squares = [...new Set(legal.filter((move) => move.from === selected).map((move) => move.to))];
  const turn = get("turn");
  turn.dataset.side = side;
  turn.textContent = forcedResult
    ? resultTitle(forcedResult.winner)
    : over && chess.isCheckmate()
      ? t(side === "w" ? "blackWins" : "whiteWins")
      : over
        ? t("draw")
        : bot.thinking && side !== ownColor
          ? t("thinking")
          : t(side === "w" ? "whiteTurn" : "blackTurn") +
          (king ? " · " + t("check") : "");
  get("rule").textContent =
    t("sharedShift") + " · " + t(effect) + " · " + t(match.mode);
  get("location").textContent = t(visualTheme());
  get("match-identity").textContent =
    mode === "local"
      ? t("localMode")
      : (mode === "bot"
          ? t("botMode") + " · " + t(difficulty)
          : t("roomCode") + " " + room?.code) +
        " · " +
        t(watching ? "watching" : ownColor === "w" ? "yourWhite" : "yourBlack");
  drawShift(match, t, message, pending, over);
  drawPlayers(match, side, over, t);
  const previous = keepTarget ? targetPicker.value : "";
  const possible = new Set(legal.map((m) => m.from));
  picker.replaceChildren(new Option(t("pickPiece"), ""));
  for (const p of chess.board().flat())
    if (p?.color === side && possible.has(p.square))
      picker.add(new Option(t(p.type) + " " + p.square, p.square));
  picker.value = selected ?? "";
  picker.disabled = !playable;
  targetPicker.replaceChildren(
    new Option(t("pickTarget"), ""),
    ...squares.map((s) => new Option(s, s)),
  );
  targetPicker.value = previous;
  targetPicker.disabled = !playable || !squares.length;
  button("confirm-move").disabled =
    targetPicker.disabled || !targetPicker.value;
  get("log").replaceChildren(
    ...match.log.map((entry, i) => {
      const li = document.createElement("li");
      li.textContent =
        i +
        1 +
        ". " +
        (entry === "shift-skipped" ? t("shiftSkippedLog") : entry);
      return li;
    }),
  );
  button("resign").hidden = button("new-game").hidden = watching;
  button("resign").disabled = over || busy || (mode === "online" && room?.phase !== "playing");
  button("new-game").disabled = busy || (mode === "online" && room?.phase !== "playing");
  button("undo").hidden = mode === "online";
  button("undo").disabled = !canUndo();
  boardGrid.draw(chess, {
    side: cameraSide(), playable, selected, lastMove,
    targets: squares, hints: preferences.hints, check: king?.square, shifts: over ? undefined : pending?.pairs,
  }, t);
  stage?.indicate(
    over ? null : pending,
    selected,
    squares,
    king?.square,
    lastMove,
    message === "shiftApplied",
  );
  stage?.setInteraction(!flatBoard && playable, side);
}
function resultTitle(winner: Color | null) {
  return t(
    winner === null ? "draw" : winner === "w" ? "whiteWins" : "blackWins",
  );
}
function winner() {
  return forcedResult ? forcedResult.winner : match?.chess.isCheckmate()
    ? (match.chess.turn() === "w" ? "b" : "w") : null;
}
function playOutcome() {
  if (lastOutcomeGeneration === generation) return;
  lastOutcomeGeneration = generation;
  const result = winner();
  if (result === null) audio.draw();
  else if (mode === "local" || watching || result === ownColor) audio.victory();
  else audio.defeat();
}
function drawResult() {
  get("result-title").textContent = resultTitle(winner());
  get("result-detail").textContent =
    forcedResult?.reason === "left"
      ? t("opponentLeft")
      : forcedResult?.reason === "resigned"
        ? t("resigned")
        : forcedResult?.reason === "timeout" ? t("timeout") : t("finished");
  button("result-undo").hidden = !canUndo();
  button("rematch").hidden = watching;
  button("rematch").disabled =
    mode === "online" &&
    (!room?.players.every((p) => p.connected) ||
      room.players.length < 2 ||
      Boolean(room.players.find((p) => p.color === ownColor)?.rematch));
  button("rematch").textContent = t(
    button("rematch").disabled ? "waitingRematch" : "rematch",
  );
}
function showResult() {
  if (!match || !ended()) return;
  hideBriefing();
  drawResult();
  if (dialog("result-dialog").open) return;
  closePanels();
  dialog("result-dialog").showModal();
}
function drawBriefing() {
  if (!match) return;
  const map = t(visualTheme());
  const timing = t(match.mode);
  for (const panel of ["briefing", "shift-rules"]) {
    get(`${panel}-title`).textContent = t(match.effect);
    get(`${panel}-map`).textContent = map + " · " + timing;
    get(`${panel}-badge-map`).textContent = map;
    get(`${panel}-badge-timing`).textContent = timing;
    get(`${panel}-effect`).textContent = t(`${match.effect}Text`);
  }
}
function showBriefing() {
  drawBriefing();
  updateBriefingStatus();
  if (!dialog("briefing").open) dialog("briefing").showModal();
}
function updateBriefingStatus() {
  const disconnected = mode === "online" && status !== "connected";
  const accepted = mode === "online" &&
    (acceptSent || Boolean(room?.players.find((p) => p.id === playerId)?.accepted));
  button("accept-shift").disabled = accepted || disconnected;
  const waiting = get("briefing-status");
  waiting.hidden = !accepted && !disconnected;
  waiting.dataset.status = disconnected ? status : "";
  waiting.textContent = disconnected ? t(status) : accepted ? t("waitingAccept") : "";
}
function labelIcon(control: HTMLElement, label: string) {
  control.setAttribute("aria-label", label);
  control.dataset.hint = label;
}
function drawSound() {
  const control = button("sound");
  control.dataset.active = String(!audio.muted);
  get("sound-action").textContent = t(audio.muted ? "soundOff" : "mute");
}
function drawFullscreen() {
  const active = Boolean(document.fullscreenElement);
  button("fullscreen").dataset.active = String(active);
  get("fullscreen-action").textContent = t(active ? "exitFullscreen" : "enterFullscreen");
}
function translate() {
  document.documentElement.lang = preferences.language;
  host
    .querySelectorAll<HTMLElement>("[data-copy]")
    .forEach((n) => (n.textContent = t(n.dataset.copy as CopyKey)));
  host
    .querySelectorAll<HTMLElement>("[data-label]")
    .forEach((n) =>
      n.setAttribute("aria-label", t(n.dataset.label as CopyKey)),
    );
  for (const node of host.querySelectorAll<HTMLElement>("[data-tooltip]"))
    labelIcon(node, t(node.dataset.tooltip as CopyKey));
  drawSound();
  drawFullscreen();
  if (get("settings-notice").textContent) {
    get("settings-notice").textContent = t("fullscreenUnavailable");
  }
  drawBriefing();
  updateBriefingStatus();
  drawLobby();
  draw(true);
  if (ended() && dialog("result-dialog").open) drawResult();
}
function ensureStage() {
  if (flatBoard) return Promise.resolve(undefined);
  return stageLoader ??= import("./stage").then(({ Stage }) => {
    get<HTMLProgressElement>("loading-progress").value = 1;
    const scene = new Stage(get("viewport"));
    stage = scene;
    scene.onSquare = (s, keepSelected) => void choose(s, keepSelected);
    applyStagePreferences();
    scene.canvas.setAttribute("aria-hidden", "true");
    scene.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      useFlatBoard();
    });
    return scene;
  }).catch(() => {
    useFlatBoard();
    return undefined;
  });
}
function useFlatBoard() {
  stopLobbyCinematic();
  flatBoard = true;
  get("viewport").dataset.flatBoard = "true";
  stage?.suspend();
  stage = undefined;
  frameMatch();
  draw();
  if (host.dataset.screen === "play") toast("webgl");
}
function renderLobbyBoard(scene: Stage) {
  scene.setSetting(visualTheme());
  scene.sync(new Chess().board());
  scene.frame("w");
  scene.setPresentation(true);
}

async function showPreview() {
  try {
    const scene = await ensureStage();
    if (!scene || host.dataset.screen !== "start" || match || lobbyCinematic) return;
    renderLobbyBoard(scene);
    updateLobbyCinematic();
  } catch {
    toast("webgl");
  }
}

function stopLobbyCinematic() {
  if (!lobbyCinematic) return;
  lobbyCinematic.abort();
  lobbyCinematic = undefined;
  stage?.cancelAnimations();
  stage?.indicate(null);
  stage?.setShot();
  get("viewport").removeAttribute("data-cinematic-fade");
  if (preferences.lobbySound) audio.stopEffects();
}

function updateLobbyCinematic() {
  if (!stage || host.dataset.screen !== "start" || reducedMotion.matches ||
      document.hidden || document.querySelector("dialog[open]")) {
    stopLobbyCinematic();
    return;
  }
  if (!lobbyCinematic) void startLobbyCinematic(stage);
}

async function startLobbyCinematic(scene: Stage) {
  const run = new AbortController();
  lobbyCinematic = run;
  const viewport = get("viewport");
  try {
    const { loopLobbyCinematic } = await import("./cinematic");
    run.signal.throwIfAborted();
    await loopLobbyCinematic(scene, run.signal,
      (faded) => viewport.toggleAttribute("data-cinematic-fade", faded),
      preferences.lobbySound ? audio : undefined);
  } catch (error) {
    if (run.signal.aborted) return;
    console.error(error);
    stopLobbyCinematic();
    renderLobbyBoard(scene);
  }
}

async function prepare() {
  const current = match;
  if (!current) return false;
  loading = true;
  const progress = get<HTMLProgressElement>("loading-progress");
  progress.value = 0;
  get("loading").hidden = false;
  showScreen("play");
  try {
    const scene = await ensureStage();
    if (match !== current) return false;
    progress.value = 2;
    lastMove = undefined;
    scene?.cancelAnimations();
    scene?.setPresentation(false);
    scene?.setSetting(visualTheme());
    scene?.sync(current.chess.board());
    frameMatch();
    audio.stopEffects();
    void audio.enable(visualTheme()).catch(() => {});
    draw();
    progress.value = 3;
    if (flatBoard) toast("webgl");
    return true;
  } catch {
    closePanels();
    showScreen("mode", button("local-mode"));
    get("mode-error").textContent = t("invalid");
    return false;
  } finally {
    loading = false;
    get("loading").hidden = true;
  }
}
async function startLocal(next: "local" | "bot") {
  if (loading) return;
  generation++;
  resetBot();
  mode = next;
  watching = false;
  localReady = false;
  turnClock.clear();
  undoHistory.length = 0;
  forcedResult = undefined;
  room = undefined;
  difficulty = get<HTMLSelectElement>("difficulty").value as Difficulty;
  const color = select("bot-color").value;
  ownColor = next === "local" ? "w" : color === "random"
    ? (Math.random() < 0.5 ? "w" : "b")
    : color === "b" ? "b" : "w";
  if (next === "bot") bot.warm();
  setting = Math.random() < 0.5 ? "park" : "library";
  match = new Match(
    "periodic",
    effects[Math.floor(Math.random() * effects.length)],
  );
  selected = undefined;
  message = undefined;
  busy = false;
  closePanels();
  if (!(await prepare())) return;
  showBriefing();
}

function startLocalClock() {
  const current = match;
  if (!current || mode === "online" || !localReady || ended()) return;
  const plies = current.plies;
  turnClock.show(current.chess.turn(), turnTimeMs, turnTimeMs, true, () => {
    if (match !== current || current.plies !== plies || ended()) return;
    const move = automaticMove(current);
    if (!move) return;
    dialog("promotion").close();
    busy = false;
    resetBot();
    toast("automaticMove");
    void makeMove(move.from, move.to, move.promotion);
  });
}
async function animateMove(
  move: Move,
  settlement: ReturnType<Match["settle"]>,
  beforeShift: ReturnType<Match["chess"]["board"]>,
) {
  const scene = stage;
  const activeGeneration = generation;
  const shift = settlement.applied ? settlement.due : null;
  const impact = () => audio.move(Boolean(move.captured), move.piece);
  if (scene) await scene.move(move, impact);
  else impact();
  if (generation !== activeGeneration) return;
  if (stage === scene) scene?.sync(beforeShift);
  lastMove = move;
  if (move.promotion) {
    if (scene && stage === scene) await scene.promote(move.to);
    if (generation !== activeGeneration) return;
  }
  if (shift) {
    if (match) drawShift(match, t, message, shift, false, beforeShift);
    audio.shiftExecute(preferences.speed === "fast" ? 0.58 : 1);
    if (stage === scene) await scene?.shift(shift, pair => audio.shiftLand(pair));
    if (generation !== activeGeneration) return;
    message = "shiftApplied";
  } else if (settlement.due) message = "shiftSkipped";
  if (settlement.announced) audio.shiftWarning();
}
async function makeMove(from: Square, to: Square, promotion?: string) {
  if (!match || busy || ended()) return;
  turnClock.clear();
  const current = match;
  busy = true;
  selected = undefined;
  message = undefined;
  draw();
  try {
    const previous = { state: current.snapshot(), lastMove };
    const move = current.play(from, to, promotion),
      beforeShift = current.chess.board();
    undoHistory.push(previous);
    const settlement = current.settle();
    if (mode === "bot" && current.chess.turn() !== ownColor && !current.isEnded()) requestBotMove(current);
    await animateMove(move, settlement, beforeShift);
    if (match !== current) return;
    stage?.sync(current.chess.board());
    if (mode === "local" && preferences.localFlip && !ended()) {
      host.dataset.facing = cameraSide();
      if (!flatBoard && stage) {
        await stage.rotateTo(cameraSide());
      } else {
        frameMatch();
      }
    }
  } finally {
    if (match === current) {
      busy = false;
      draw();
    }
  }
  if (match !== current) return;
  if (ended()) {
    playOutcome();
    showResult();
  } else {
    if (current.chess.isCheck()) audio.check();
    startLocalClock();
    playBotReply();
  }
}
function undoIndex() {
  if (mode === "local") return undoHistory.length - 1;
  for (let i = undoHistory.length - 1; i >= 0; i--) {
    if (undoHistory[i].state.fen.split(" ")[1] === ownColor) return i;
  }
  return -1;
}
function canUndo() {
  return Boolean(match && !busy && mode !== "online" && undoIndex() >= 0);
}
function undoMove() {
  if (!canUndo()) return;
  const index = undoIndex();
  const previous = undoHistory[index];
  generation++;
  resetBot();
  undoHistory.length = index;
  closePanels();
  forcedResult = undefined;
  message = undefined;
  selected = undefined;
  lastMove = previous.lastMove;
  match = Match.restore(previous.state);
  audio.stopEffects();
  stage?.cancelAnimations();
  stage?.sync(match.chess.board());
  frameMatch();
  draw();
  startLocalClock();
}
async function choose(square: Square, keepSelected = false) {
  if (!mayPlay() || !match) return;
  const chess = match.chess;
  if (chess.get(square)?.color === chess.turn()) {
    if (keepSelected && selected === square) return;
    selected = selected === square ? undefined : square;
    audio.select();
    draw();
    return;
  }
  if (!selected) return;
  const from = selected,
    candidates = legalCache?.match === match && legalCache.plies === match.plies
      ? legalCache.moves.filter((m) => m.from === from && m.to === square)
      : chess.moves({ square: from, verbose: true }).filter((m) => m.to === square);
  if (!candidates.length) return;
  dialog("moves-dialog").close();
  let promotion: string | undefined;
  if (candidates[0].promotion && preferences.autoQueen) promotion = "q";
  else if (candidates[0].promotion) {
    const current = match;
    const plies = current.plies;
    const revision = room?.revision;
    busy = true;
    const p = dialog("promotion");
    p.returnValue = "";
    p.showModal();
    promotion = await new Promise<string>((resolve) =>
      p.addEventListener("close", () => resolve(p.returnValue), { once: true }),
    );
    if (match !== current || current.plies !== plies || room?.revision !== revision) return;
    busy = false;
    if (!promotion) {
      draw();
      return;
    }
  }
  if (mode === "online") {
    if (
      network?.send({
        type: "move",
        from,
        to: square,
        promotion,
        revision: room!.revision,
      })
    ) {
      busy = true;
      selected = undefined;
      draw();
    } else toast("pausedOnline");
  } else await makeMove(from, square, promotion);
}
function resetBot() {
  bot.reset();
  botReply = undefined;
}
function requestBotMove(current: Match) {
  bot.request(current, difficulty, (move) => {
    if (match !== current) return;
    botReply = move;
    playBotReply();
  });
}
function playBotReply() {
  if (busy || !localReady || mode !== "bot" || match?.chess.turn() === ownColor || !botReply) return;
  const move = botReply;
  botReply = undefined;
  void makeMove(move.from, move.to, move.promotion);
}
function leaveGame() {
  generation++;
  resetBot();
  network?.close();
  network = undefined;
  room = undefined;
  watching = false;
  clockView.show();
  turnClock.clear();
  localReady = false;
  undoHistory.length = 0;
  match = undefined;
  forcedResult = undefined;
  selected = undefined;
  busy = false;
  acceptSent = false;
  closePanels();
  stage?.cancelAnimations();
  stage?.indicate(null);
  stage?.setInteraction(false);
  audio.stopAmbience();
  audio.stopEffects();
  showScreen("start", button("start"));
}
function drawLobby() {
  const connectionState = get("connection-state");
  connectionState.textContent = t(status);
  connectionState.dataset.status = status;
  get("server-config").dataset.status = status === "offline" || network ? status : "";
  get("server-status").textContent = status === "offline" || network ? t(status) : "";
  if (!room) return;
  get("invite-code").textContent = room.code;
  get("players").replaceChildren(
    ...room.players.map((p) => {
      const li = document.createElement("li");
      li.textContent =
        (p.color === "w" ? "♙ " : "♟ ") +
        p.name +
        " · " +
        t(!p.connected ? "reconnecting" : p.ready ? "ready" : "connected");
      return li;
    }),
  );
  get("lobby-hint").textContent = t(
    watching ? "waitingWatch" : room.quick
      ? "searching"
      : room.players.length < 2
        ? "waitingPlayer"
        : "readyHint",
  );
  button("ready").hidden = room.quick || watching;
  button("ready").textContent = t(
    room.players.find((p) => p.color === ownColor)?.ready
      ? "notReady"
      : "ready",
  );
}
async function receiveRoom(packet: RoomPacket, receivedAt: number) {
  if (!network) return;
  const next = packet.room;
  const connection = network;
  const old = room;
  room = next;
  const turn = next.state?.fen.split(" ")[1] as Color | undefined;
  clockView.show(next.clock, turn, receivedAt);
  const clock = next.clock;
  if (next.phase === "playing" && clock?.turnMs && turn) {
    const running = clock.turnDeadline != null;
    const remaining = running
      ? clock.turnDeadline! - clock.serverNow - (performance.now() - receivedAt)
      : clock.turnRemaining;
    turnClock.show(turn, clock.turnMs, Math.max(0, remaining), running);
  } else turnClock.clear();
  ownColor = next.players.find((p) => p.id === playerId)?.color ?? ownColor;
  drawLobby();
  if (next.phase === "waiting") {
    showScreen("lobby");
    return;
  }
  if (!next.state) return;
  if (next.phase === "briefing") {
    if (old?.phase !== "briefing" || !match) {
      generation++;
      acceptSent = false;
      forcedResult = undefined;
      busy = false;
      selected = undefined;
      message = undefined;
      closePanels();
      match = Match.restore(next.state);
      setting = next.setting;
      if (!(await prepare()) || network !== connection) return;
      if (!watching) showBriefing();
    }
    updateBriefingStatus();
    return;
  }
  hideBriefing();
  if (packet.automatic) {
    dialog("promotion").close();
    toast("automaticMove");
  }
  if (!match) {
    generation++;
    match = Match.restore(next.state);
    setting = next.setting;
    if (!(await prepare()) || network !== connection) return;
  }
  if (match.plies !== next.state.plies) {
    lastMove = undefined;
    message = undefined;
  }
  if (packet.move && packet.settlement && match.plies + 1 === next.state.plies && !document.hidden) {
    const current = match;
    busy = true;
    selected = undefined;
    draw();
    const move = match.chess.move(packet.move);
    await animateMove(move, packet.settlement, match.chess.board());
    if (match !== current || network !== connection) return;
  }
  match = Match.restore(next.state);
  forcedResult = next.result;
  busy = false;
  stage?.sync(match.chess.board());
  frameMatch();
  draw();
  if (!watching && !next.players.every((p) => p.connected) && next.phase === "playing") toast("opponentDisconnected");
  if (next.phase === "ended") {
    playOutcome();
    showResult();
  } else if (packet.move && match.chess.isCheck()) audio.check();
}
let playerId: string | undefined;
function bindNetwork(connection: Connection) {
  network = connection;
  connection.onstatus = (next) => {
    if (network !== connection) return;
    status = next;
    if (next === "reconnecting" || next === "offline") {
      clockView.pause();
      turnClock.clear();
    }
    if (next === "reconnecting") acceptSent = false;
    updateBriefingStatus();
    drawLobby();
    draw();
    if (next === "offline") {
      get("online-error").textContent = t("offline");
      if (!match) showScreen("online");
    }
    if (next === "reconnecting" && match) toast("pausedOnline");
  };
  connection.onmessage = (packet) => {
    if (network !== connection) return;
    if (packet.type === "session") {
      ownColor = packet.color;
      playerId = packet.playerId;
    }
    if (packet.type === "error") {
      busy = false;
      draw();
      const key = (packet.key in copy.vi ? packet.key : "invalid") as CopyKey;
      get("online-error").textContent = t(key);
      get("connection-state").textContent = t(key);
      if (match) toast(key);
      if (packet.key === "expired" || !room) {
        leaveGame();
        showScreen("online");
      }
    }
    if (packet.type === "room") {
      const receivedAt = performance.now();
      roomQueue = roomQueue
        .then(() =>
          network === connection ? receiveRoom(packet, receivedAt) : undefined,
        )
        .catch(() => {
          if (network !== connection) return;
          busy = false;
          draw();
          toast("invalid");
        });
    }
  };
}
function connectOnline(type: "quick" | "create" | "join" | "watch") {
  const name = get<HTMLInputElement>("player-name").value.trim();
  get("online-error").textContent = "";
  if (type !== "watch" && !name) {
    get("online-error").textContent = t("nameRequired");
    return;
  }
  try {
    network?.close();
    room = undefined;
    playerId = undefined;
    watching = type === "watch";
    mode = "online";
    match = undefined;
    const connection = new Connection(serverUrl(input("server-url").value));
    bindNetwork(connection);
    showScreen("lobby", button("cancel-online"));
    get("invite-code").textContent = "…";
    get("players").replaceChildren();
    button("ready").hidden = true;
    get("lobby-hint").textContent = "";
    const code = input("room-code").value.trim().toUpperCase();
    if (type === "watch") connection.watch(code);
    else connection.connect({ type, name, code });
  } catch {
    get("online-error").textContent = t("offline");
    showScreen("online");
  }
}

button("start").onclick = () => showScreen("mode", button("local-mode"));
button("mode-back").onclick = () => showScreen("start", button("start"));
button("local-mode").onclick = () => void startLocal("local");
button("online-mode").onclick = () => showScreen("online", get("player-name"));
button("start-bot").onclick = () => void startLocal("bot");
dialog("briefing").addEventListener("cancel", (event) => event.preventDefault());
button("briefing-leave").onclick = leaveGame;
button("accept-shift").onclick = () => {
  if (mode === "online") {
    acceptSent = network?.send({ type: "accept" }) ?? false;
    updateBriefingStatus();
    if (!acceptSent) toast("pausedOnline");
    return;
  }
  localReady = true;
  hideBriefing();
  if (mode === "bot" && ownColor === "b" && match) requestBotMove(match);
  if (!busy) startLocalClock();
  draw();
};
button("shift-info").onclick = () => {
  hideBriefing();
  drawBriefing();
  openPanel("shift-rules-dialog");
};
button("quick").onclick = () => connectOnline("quick");
button("create-room").onclick = () => connectOnline("create");
get("join-form").onsubmit = (event) => {
  event.preventDefault();
  connectOnline((event as SubmitEvent).submitter?.getAttribute("value") === "watch" ? "watch" : "join");
};
button("ready").onclick = () => network?.send({ type: "ready" });
button("cancel-online").onclick = () => {
  leaveGame();
  showScreen("online", button("quick"));
};
button("copy-code").onclick = async () => {
  try {
    await navigator.clipboard.writeText(room?.code ?? "");
    button("copy-code").textContent = t("copied");
  } catch {
    const range = document.createRange();
    range.selectNodeContents(get("invite-code"));
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
  }
};
button("result-leave").onclick = leaveGame;
button("undo").onclick = undoMove;
button("result-undo").onclick = undoMove;
button("leave").onclick = leaveGame;
button("rematch").onclick = () => {
  if (watching) return;
  if (mode === "online") {
    network?.send({ type: "rematch" });
    button("rematch").disabled = true;
    button("rematch").textContent = t("waitingRematch");
  } else void startLocal(mode);
};
function resign() {
  if (!match || watching || busy || ended()) return;
  closePanels();
  if (mode === "online") {
    if (!network?.send({ type: "resign" })) toast("pausedOnline");
  }
  else {
    generation++;
    resetBot();
    turnClock.clear();
    forcedResult = {
      winner: (mode === "local" ? match.chess.turn() : ownColor) === "w" ? "b" : "w",
      reason: "resigned",
    };
    draw();
    playOutcome();
    showResult();
  }
}
button("resign").onclick = resign;
button("settings").onclick = () => {
  dialog("menu-dialog").close();
  openPanel("preferences-dialog");
};
button("home").onclick = () => {
  dialog("menu-dialog").close();
  openPanel("leave-dialog");
};
button("new-game").onclick = () => {
  dialog("menu-dialog").close();
  get("restart-hint").textContent = t(mode === "online" ? "restartOnlineHint" : "restartHint");
  openPanel("restart-dialog");
};
button("confirm-restart").onclick = () => {
  if (mode === "online") resign();
  else void startLocal(mode);
};
function toggleSound() {
  audio.toggle();
  preferences.muted = audio.muted;
  savePreferences(preferences);
  drawSound();
}
button("sound").onclick = toggleSound;
picker.onchange = () => {
  if (!mayPlay()) return;
  selected = (picker.value || undefined) as Square | undefined;
  draw();
};
targetPicker.onchange = () =>
  (button("confirm-move").disabled = !mayPlay() || !targetPicker.value);
get("compact-move").onsubmit = (event) => {
  event.preventDefault();
  if (!button("confirm-move").disabled)
    void choose(targetPicker.value as Square);
};
for (const b of host.querySelectorAll<HTMLElement>("[data-open]"))
  b.onclick = () => {
    b.closest("dialog")?.close();
    openPanel(b.dataset.open!);
  };
for (const b of host.querySelectorAll<HTMLElement>("[data-close]"))
  b.onclick = () => b.closest("dialog")!.close();
for (const b of host.querySelectorAll<HTMLElement>("[data-back]"))
  b.onclick = () => showScreen(b.dataset.back as keyof typeof screens);
for (const panel of host.querySelectorAll("dialog"))
  panel.addEventListener("close", () => {
    playBotReply();
    updateLobbyCinematic();
  });
document.addEventListener("visibilitychange", updateLobbyCinematic);
reducedMotion.addEventListener("change", () => {
  updateLobbyCinematic();
  if (reducedMotion.matches && host.dataset.screen === "start") void showPreview();
});
dialog("result-dialog").addEventListener("cancel", (event) =>
  { if (!watching) event.preventDefault(); },
);
const fullscreen = button("fullscreen");
fullscreen.hidden = !document.fullscreenEnabled;
const settingsNotice = get("settings-notice");
dialog("preferences-dialog").addEventListener("close", () => {
  settingsNotice.textContent = "";
});
fullscreen.onclick = async () => {
  settingsNotice.textContent = "";
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    if (dialog("preferences-dialog").open) {
      settingsNotice.textContent = t("fullscreenUnavailable");
    } else {
      toast("fullscreenUnavailable");
    }
  }
};
document.addEventListener("fullscreenchange", drawFullscreen);
document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (event.target instanceof HTMLElement &&
      event.target.matches("input,select,textarea"))
  )
    return;
  const key = event.key.toLowerCase();
  const panel = document.querySelector("dialog[open]");
  if (panel?.id === "preferences-dialog" && key === "m") {
    event.preventDefault();
    toggleSound();
    return;
  }
  if (panel && (panel.id !== "preferences-dialog" || key !== "f")) return;
  if (key === "f") {
    event.preventDefault();
    fullscreen.click();
  }
  if (key === "?") {
    event.preventDefault();
    openPanel("help-dialog");
  }
  if (host.dataset.screen !== "play") return;
  const actions: Record<string, () => void> = {
    escape: () => openPanel("menu-dialog"),
    m: () => button("sound").click(),
    g: () => openPanel("moves-dialog"),
    h: () => openPanel("history-dialog"),
  };
  if (actions[key]) {
    event.preventDefault();
    actions[key]();
  }
});
host.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest("button:not(:disabled)")) return;
  void audio.unlock().then(() => audio.uiClick()).catch(() => {});
}, { capture: true });
for (const control of host.querySelectorAll("button"))
  control.addEventListener("pointerenter", () => {
    if (!control.disabled) audio.uiHover();
  });
bindPreferenceControls(preferences, audio, {
  viewChanged: () => { if (match) frameMatch(); },
  stageChanged: () => { applyStagePreferences(); draw(true); },
  themeChanged: () => {
    stage?.setSetting(visualTheme());
    if (match) void audio.enable(visualTheme()).catch(() => {});
    drawBriefing();
    draw(true);
  },
  translate,
});
showScreen("start", button("start"));
translate();
try {
  const saved = JSON.parse(
    sessionStorage.getItem("shiftchess-session") || "null",
  );
  if (saved?.token && saved?.url) {
    mode = "online";
    showScreen("lobby");
    const connection = new Connection(saved.url);
    bindNetwork(connection);
    connection.resume(saved.token);
  }
} catch {}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const workerUrl = new URL("./sw.js", document.baseURI);
  void navigator.serviceWorker.register(workerUrl).catch((error) =>
    console.warn("Offline setup failed", error),
  );
}
