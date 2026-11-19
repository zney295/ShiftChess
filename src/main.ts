import type { Color, Move, Square } from "chess.js";
import { GameAudio } from "./audio";
import { copy, type CopyKey, type Locale } from "./copy";
import { effects, Match, movesShiftPair, type Effect, type Shift } from "./rules";
import { Connection, type Room } from "./network";
import type { Difficulty } from "./bot";
import type { Stage } from "./stage";
import { template } from "./template";
import { drawStartArt } from "./start-art";
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
  bot: get("bot-screen"),
  online: get("online-screen"),
  lobby: get("lobby-screen"),
  play: get("play-screen"),
};
const audio = new GameAudio();
let locale: Locale = "vi";
try {
  if (localStorage.getItem("shiftchess-language") === "en") locale = "en";
} catch {}
const t = (key: CopyKey) => copy[locale][key];
let stage: Stage | undefined,
  match: Match | undefined,
  setting: "park" | "library" = "park";
let stageLoader: Promise<typeof import("./stage")> | undefined;
let selected: Square | undefined,
  overhead = false,
  busy = false,
  accepted = false,
  loading = false;
let mode: "local" | "bot" | "online" = "local",
  difficulty: Difficulty = "normal";
let message: CopyKey | undefined,
  worker: Worker | undefined,
  generation = 0;
let lastMove: Move | undefined;
let botThinking = false;
let botReply: Pick<Move, "from" | "to" | "promotion"> | undefined;
let legalCache: { match: Match; plies: number; moves: Move[] } | undefined;
let network: Connection | undefined,
  room: Room | undefined,
  ownColor: Color = "w",
  status: CopyKey = "connected";
let forcedResult: { winner: Color | null; reason: string } | undefined;
let roomQueue = Promise.resolve(),
  toastTimer: number | undefined;

function closePanels() {
  for (const d of host.querySelectorAll<HTMLDialogElement>("dialog[open]"))
    d.close();
}
function showScreen(active: keyof typeof screens, focus?: HTMLElement) {
  for (const [key, node] of Object.entries(screens))
    node.hidden = key !== active;
  host.dataset.screen = active;
  get("play-actions").hidden = active !== "play";
  focus?.focus({ preventScroll: true });
}
function openPanel(id: string) {
  if (document.querySelector("dialog[open]")) return;
  dialog(id).showModal();
}
function toast(key: CopyKey) {
  const node = get("board-toast");
  node.textContent = t(key);
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (node.hidden = true), 2600);
}
const ended = () => Boolean(match?.isEnded() || forcedResult);
const cameraSide = (): Color =>
  mode === "local" ? "w" : ownColor;
const mayPlay = (over = ended()) =>
  Boolean(
    match &&
    accepted &&
    !busy &&
    !over &&
    (mode === "local" || match.chess.turn() === ownColor) &&
    (mode !== "online" ||
      (status === "connected" &&
        room?.phase === "playing" &&
        room.players.every((p) => p.connected))),
  );

function drawShift(
  pending: Shift | null,
  over: boolean,
  beforeShift?: ReturnType<Match["chess"]["board"]>,
) {
  if (!match) return;
  const { chess, plies, effect, mode: timing } = match;
  const event = get("event");
  const panel = event.parentElement!;
  panel.dataset.phase = beforeShift ? "active" : pending ? "pending" : "idle";
  event.replaceChildren();
  get("shift-heading").textContent = "SHIFT · " + t(effect);
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
      const arrow = effect === "slide" && Boolean(first) !== Boolean(second)
        ? (first ? " → " : " ← ") : " ↔ ";
      mark.textContent = a + arrow + b;
      event.append(mark);
    });
    const count = document.createElement("span");
    const n = pending.at - plies;
    count.textContent = beforeShift ? t("shifting") : t(n === 1 ? "oneMove" : "manyMoves")
      .replace("{n}", String(n));
    event.append(count);
    return;
  }
  if (over || message) {
    event.textContent = t(message ?? "finished");
    return;
  }
  const until = timing === "periodic" ? 6 - plies % 6 : 24 - plies;
  event.textContent = until > 0
    ? t("nextShift").replace("{n}", String(until))
    : t(`${effect}Text`);
}

function draw(keepTarget = false) {
  if (!match || !stage) return;
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
        : botThinking && side === "b"
          ? t("thinking")
          : t(side === "w" ? "whiteTurn" : "blackTurn") +
          (king ? " · " + t("check") : "");
  get("rule").textContent =
    t("sharedShift") + " · " + t(effect) + " · " + t(match.mode);
  get("location").textContent = t(setting);
  get("match-identity").textContent =
    mode === "local"
      ? t("localMode")
      : (mode === "bot"
          ? t("botMode") + " · " + t(difficulty)
          : t("roomCode") + " " + room?.code) +
        " · " +
        t(ownColor === "w" ? "yourWhite" : "yourBlack");
  stage.canvas.setAttribute("aria-label", t("board"));
  drawShift(pending, over);
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
  button("view").textContent = t(overhead ? "rider" : "overview");
  button("view").disabled = busy;
  button("resign").disabled = over || busy || !accepted;
  stage.indicate(
    over ? null : pending,
    selected,
    squares,
    king?.square,
    lastMove,
    message === "shiftApplied",
  );
  stage.setInteraction(playable, side);
}
function resultTitle(winner: Color | null) {
  return t(
    winner === null ? "draw" : winner === "w" ? "whiteWins" : "blackWins",
  );
}
function showResult() {
  if (!match || !ended()) return;
  closePanels();
  const winner = forcedResult
    ? forcedResult.winner
    : match.chess.isCheckmate()
      ? match.chess.turn() === "w"
        ? "b"
        : "w"
      : null;
  get("result-title").textContent = resultTitle(winner);
  get("result-detail").textContent =
    forcedResult?.reason === "left"
      ? t("opponentLeft")
      : forcedResult?.reason === "resigned"
        ? t("resigned")
        : t("finished");
  button("rematch").disabled =
    mode === "online" &&
    (!room?.players.every((p) => p.connected) ||
      room.players.length < 2 ||
      Boolean(room.players.find((p) => p.color === ownColor)?.rematch));
  button("rematch").textContent = t(
    button("rematch").disabled ? "waitingRematch" : "rematch",
  );
  dialog("result-dialog").showModal();
}
function drawBriefing() {
  if (!match) return;
  get("briefing-title").textContent = t(match.effect);
  get("briefing-map").textContent = t(setting) + " · " + t(match.mode);
  get("briefing-effect").textContent = t(`${match.effect}Text`);
  const mine = room?.players.find((p) => p.color === ownColor);
  button("accept-shift").textContent = t(
    mode === "online" && mine?.accepted ? "waitingAccept" : "understood",
  );
  button("accept-shift").disabled =
    mode === "online" && Boolean(mine?.accepted);
}
function translate() {
  document.documentElement.lang = locale;
  host
    .querySelectorAll<HTMLElement>("[data-copy]")
    .forEach((n) => (n.textContent = t(n.dataset.copy as CopyKey)));
  host
    .querySelectorAll<HTMLElement>("[data-label]")
    .forEach((n) =>
      n.setAttribute("aria-label", t(n.dataset.label as CopyKey)),
    );
  button("locale").textContent = locale === "vi" ? "EN" : "VI";
  button("locale").setAttribute("aria-label", t("switchLanguage"));
  button("sound").textContent = t(audio.muted ? "soundOff" : "soundOn");
  drawBriefing();
  drawLobby();
  draw(true);
}
async function ensureStage() {
  if (stage) return;
  const { Stage } = await (stageLoader ??= import("./stage"));
  stage = new Stage(get("viewport"));
  stage.onSquare = (s, keepSelected) => void choose(s, keepSelected);
  stage.quality(get<HTMLSelectElement>("quality").value === "high");
  stage.canvas.tabIndex = 0;
  stage.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    toast("webgl");
  });
}
async function prepare() {
  loading = true;
  get("loading").hidden = false;
  showScreen("play");
  try {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await ensureStage();
    lastMove = undefined;
    stage!.setSetting(setting);
    stage!.sync(match!.chess.board());
    stage!.frame(cameraSide(), overhead);
    void audio.enable(setting).catch(() => {});
    draw();
    return true;
  } catch {
    closePanels();
    showScreen("mode", button("local-mode"));
    get("mode-error").textContent = t("webgl");
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
  forcedResult = undefined;
  room = undefined;
  difficulty = get<HTMLSelectElement>("difficulty").value as Difficulty;
  if (next === "bot") warmBot();
  ownColor = "w";
  setting = Math.random() < 0.5 ? "park" : "library";
  match = new Match(
    "periodic",
    effects[Math.floor(Math.random() * effects.length)],
  );
  selected = undefined;
  message = undefined;
  overhead = false;
  accepted = false;
  busy = false;
  closePanels();
  if (!(await prepare())) return;
  drawBriefing();
  dialog("briefing").showModal();
  audio.cue();
}
function acceptBriefing() {
  if (mode === "online" && room?.phase === "briefing") {
    network?.send({ type: "accept" });
    return;
  }
  if (accepted) {
    dialog("briefing").close();
    return;
  }
  accepted = true;
  dialog("briefing").close();
  draw();
  stage?.revealPieces();
}
async function animateMove(
  move: Move,
  settlement: ReturnType<Match["settle"]>,
  beforeShift: ReturnType<Match["chess"]["board"]>,
) {
  if (!stage) return;
  const activeGeneration = generation;
  const shift = settlement.applied ? settlement.due : null;
  await stage.move(move, () => audio.move(Boolean(move.captured)));
  if (generation !== activeGeneration) return;
  stage.sync(beforeShift);
  lastMove = move;
  if (shift) {
    drawShift(shift, false, beforeShift);
    audio.cue(true);
    await stage.shift(shift);
    if (generation !== activeGeneration) return;
    message = "shiftApplied";
  } else if (settlement.due) message = "shiftSkipped";
  if (settlement.announced) audio.cue();
}
async function makeMove(from: Square, to: Square, promotion?: string) {
  if (!match || busy) return;
  const current = match;
  busy = true;
  selected = undefined;
  message = undefined;
  draw();
  try {
    const move = current.play(from, to, promotion),
      beforeShift = current.chess.board();
    const settlement = current.settle();
    if (mode === "bot" && move.color === ownColor && !current.isEnded())
      requestBotMove(current);
    await animateMove(move, settlement, beforeShift);
    if (match !== current) return;
    stage!.sync(current.chess.board());
  } finally {
    if (match === current) {
      busy = false;
      draw();
    }
  }
  if (ended()) {
    audio.result();
    showResult();
  } else playBotReply();
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
  if (candidates[0].promotion) {
    busy = true;
    const p = dialog("promotion");
    p.returnValue = "";
    p.showModal();
    promotion = await new Promise<string>((resolve) =>
      p.addEventListener("close", () => resolve(p.returnValue), { once: true }),
    );
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
  worker?.terminate();
  worker = undefined;
  botThinking = false;
  botReply = undefined;
}
function warmBot() {
  try {
    worker ??= new Worker(new URL("./bot.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onerror = () => resetBot();
  } catch {}
}
function requestBotMove(current: Match) {
  warmBot();
  const finish = (move?: Pick<Move, "from" | "to" | "promotion">) => {
    if (match !== current || !botThinking) return;
    botThinking = false;
    botReply = move ?? current.chess.moves({ verbose: true })[0];
    playBotReply();
  };
  botThinking = true;
  if (!worker) {
    finish();
    return;
  }
  worker.onmessage = (event) => finish(event.data.move);
  worker.onerror = () => {
    worker?.terminate();
    worker = undefined;
    finish();
  };
  worker.postMessage({ state: current.snapshot(), difficulty });
}
function playBotReply() {
  if (busy || mode !== "bot" || match?.chess.turn() !== "b" || !botReply) return;
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
  match = undefined;
  forcedResult = undefined;
  selected = undefined;
  busy = false;
  accepted = false;
  closePanels();
  stage?.cancelAnimations();
  stage?.indicate(null);
  stage?.setInteraction(false);
  audio.stopAmbience();
  showScreen("start", button("start"));
}
function drawLobby() {
  get("connection-state").textContent = t(status);
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
    room.quick
      ? "searching"
      : room.players.length < 2
        ? "waitingPlayer"
        : "readyHint",
  );
  button("ready").hidden = room.quick;
  button("ready").textContent = t(
    room.players.find((p) => p.color === ownColor)?.ready
      ? "notReady"
      : "ready",
  );
}
async function receiveRoom(next: Room, packet: any) {
  if (!network) return;
  const old = room;
  room = next;
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
      accepted = false;
      forcedResult = undefined;
      busy = false;
      selected = undefined;
      message = undefined;
      closePanels();
      match = Match.restore(next.state);
      setting = next.setting;
      overhead = false;
      if (!(await prepare())) return;
      audio.cue();
    }
    drawBriefing();
    if (!dialog("briefing").open) dialog("briefing").showModal();
    return;
  }
  if (!match) {
    match = Match.restore(next.state);
    setting = next.setting;
    if (!(await prepare())) return;
  }
  if (dialog("briefing").open) dialog("briefing").close();
  const reveal =
    next.phase === "playing" && old?.phase === "briefing" && next.state.plies === 0;
  accepted = true;
  if (match.plies !== next.state.plies) {
    lastMove = undefined;
    message = undefined;
  }
  if (packet.move && match.plies + 1 === next.state.plies && !document.hidden) {
    const current = match;
    busy = true;
    selected = undefined;
    draw();
    const move = match.chess.move(packet.move);
    await animateMove(move, packet.settlement, match.chess.board());
    if (match !== current) return;
  }
  match = Match.restore(next.state);
  forcedResult = next.result;
  busy = false;
  stage!.sync(match.chess.board());
  stage!.frame(cameraSide(), overhead);
  draw();
  if (reveal) stage!.revealPieces();
  if (!next.players.every((p) => p.connected)) toast("opponentDisconnected");
  if (next.phase === "ended") {
    audio.result();
    showResult();
  }
}
let playerId: string | undefined;
function bindNetwork(connection: Connection) {
  network = connection;
  connection.onstatus = (next) => {
    status = next;
    drawLobby();
    draw();
    if (next === "offline") get("online-error").textContent = t("offline");
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
      if (packet.key === "expired") {
        connection.close();
        network = undefined;
        showScreen("online");
      }
    }
    if (packet.type === "room")
      roomQueue = roomQueue
        .then(() =>
          network === connection ? receiveRoom(packet.room, packet) : undefined,
        )
        .catch(() => {
          busy = false;
          toast("invalid");
        });
  };
}
function serverUrl() {
  const configured =
    get<HTMLInputElement>("server-url").value.trim() ||
    import.meta.env.VITE_SERVER_URL;
  const url = new URL(
    configured ||
      (location.port === "48648" ||
      location.port === "48649" ||
      location.port === "5173"
        ? "ws://" + location.hostname + ":48700/socket"
        : (location.protocol === "https:" ? "wss:" : "ws:") +
          "//" +
          location.host +
          "/socket"),
  );
  if (!["ws:", "wss:"].includes(url.protocol)) throw new Error("url");
  return url.href;
}
function connectOnline(type: "quick" | "create" | "join") {
  const name = get<HTMLInputElement>("player-name").value.trim();
  get("online-error").textContent = "";
  if (!name) {
    get("online-error").textContent = t("nameRequired");
    return;
  }
  try {
    network?.close();
    room = undefined;
    playerId = undefined;
    mode = "online";
    match = undefined;
    const connection = new Connection(serverUrl());
    bindNetwork(connection);
    showScreen("lobby", button("cancel-online"));
    get("invite-code").textContent = "…";
    get("players").replaceChildren();
    connection.connect({
      type,
      name,
      code: get<HTMLInputElement>("room-code").value.trim().toUpperCase(),
    });
  } catch {
    get("online-error").textContent = t("offline");
    showScreen("online");
  }
}

button("start").onclick = () => {
  showScreen("mode", button("local-mode"));
  void (stageLoader ??= import("./stage")).catch(() => { stageLoader = undefined; });
};
button("mode-back").onclick = () => showScreen("start", button("start"));
button("local-mode").onclick = () => void startLocal("local");
button("bot-mode").onclick = () => showScreen("bot", get("difficulty"));
button("online-mode").onclick = () => showScreen("online", get("player-name"));
button("start-bot").onclick = () => void startLocal("bot");
button("accept-shift").onclick = acceptBriefing;
button("shift-info").onclick = () => {
  drawBriefing();
  openPanel("briefing");
};
button("quick").onclick = () => connectOnline("quick");
button("create-room").onclick = () => connectOnline("create");
get("join-form").onsubmit = (event) => {
  event.preventDefault();
  connectOnline("join");
};
button("ready").onclick = () => network?.send({ type: "ready" });
button("cancel-online").onclick = () => {
  network?.close();
  network = undefined;
  room = undefined;
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
button("leave").onclick = leaveGame;
button("rematch").onclick = () => {
  if (mode === "online") {
    network?.send({ type: "rematch" });
    button("rematch").disabled = true;
    button("rematch").textContent = t("waitingRematch");
  } else void startLocal(mode);
};
button("resign").onclick = () => {
  if (busy || ended()) return;
  closePanels();
  if (mode === "online") network?.send({ type: "resign" });
  else {
    generation++;
    resetBot();
    forcedResult = {
      winner: (mode === "local" ? match?.chess.turn() : ownColor) === "w" ? "b" : "w",
      reason: "resigned",
    };
    draw();
    showResult();
  }
};
button("menu").onclick = () => openPanel("menu-dialog");
button("open-preferences").onclick = () => {
  dialog("menu-dialog").close();
  openPanel("preferences-dialog");
};
button("settings").onclick = () => {
  dialog("menu-dialog").close();
  openPanel("leave-dialog");
};
button("view").onclick = () => {
  if (busy || !match) return;
  overhead = !overhead;
  stage!.frame(cameraSide(), overhead);
  draw();
};
button("sound").onclick = () => {
  audio.toggle();
  button("sound").textContent = t(audio.muted ? "soundOff" : "soundOn");
  button("sound").setAttribute("aria-pressed", String(!audio.muted));
};
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
get("effects-volume").oninput = () =>
  audio.volumes(
    Number(get<HTMLInputElement>("effects-volume").value) / 100,
    Number(get<HTMLInputElement>("ambient-volume").value) / 100,
  );
get("ambient-volume").oninput = get("effects-volume").oninput;
get("quality").onchange = () =>
  stage?.quality(get<HTMLSelectElement>("quality").value === "high");
button("locale").onclick = () => {
  locale = locale === "vi" ? "en" : "vi";
  try {
    localStorage.setItem("shiftchess-language", locale);
  } catch {}
  translate();
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
dialog("briefing").addEventListener("cancel", (event) => {
  if (!accepted) event.preventDefault();
});
dialog("result-dialog").addEventListener("cancel", (event) =>
  event.preventDefault(),
);
const fullscreen = button("fullscreen");
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("fullscreenUnavailable");
  }
};
document.addEventListener("fullscreenchange", () =>
  fullscreen.setAttribute(
    "aria-pressed",
    String(Boolean(document.fullscreenElement)),
  ),
);
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
  if (document.querySelector("dialog[open]")) return;
  const key = event.key.toLowerCase();
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
    v: () => button("view").click(),
    m: () => button("sound").click(),
    g: () => openPanel("moves-dialog"),
    h: () => openPanel("history-dialog"),
  };
  if (actions[key]) {
    event.preventDefault();
    actions[key]();
  }
});
showScreen("start", button("start"));
translate();
drawStartArt(host.querySelector(".start-art")!, screens.start);
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
