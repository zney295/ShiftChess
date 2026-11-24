import type { Color, Move, Square } from "chess.js";
import type { Match, MatchState, MoveInput } from "./rules";
import type { CopyKey } from "./copy";

export type Clock = {
  remaining: Record<Color, number>; deadline: number | null; serverNow: number;
  turnMs: number; turnRemaining: number; turnDeadline: number | null;
};
export type Room = {
  code: string;
  phase: "waiting" | "briefing" | "playing" | "ended";
  quick: boolean;
  setting: "park" | "library";
  state?: MatchState;
  simultaneous?: { w: boolean; b: boolean };
  revision: number;
  disconnectedUntil?: number;
  clock?: Clock;
  result?: { winner: "w" | "b" | null; reason: string };
  players: {
    id: string;
    name: string;
    color: "w" | "b";
    connected: boolean;
    ready: boolean;
    accepted: boolean;
    rematch: boolean;
  }[];
};
export type SimultaneousPacket = {
  white: MoveInput;
  black: MoveInput;
  clash: boolean;
  clashSquare?: Square;
  clashMidpoint?: [Square, Square];
  neutralizedCheck?: boolean;
};
type RoomPacket = {
  type: "room";
  room: Room;
  move?: Pick<Move, "from" | "to" | "promotion">;
  simultaneous?: SimultaneousPacket;
  settlement?: ReturnType<Match["settle"]>;
  automatic?: boolean;
};
type Packet = RoomPacket |
  { type: "session"; token: string; color: Color; playerId: string } |
  { type: "error"; key: CopyKey };
export type { RoomPacket };

export class Connection {
  private socket?: WebSocket;
  private token?: string;
  private watchCode?: string;
  private closed = false;
  private retry?: number;
  private attempts = 0;
  onmessage: (message: Packet) => void = () => {};
  onstatus: (
    status: "connecting" | "connected" | "reconnecting" | "offline",
  ) => void = () => {};
  constructor(private readonly url: string) {}
  connect(first?: Record<string, unknown>) {
    this.closed = false;
    this.onstatus(this.token || this.attempts ? "reconnecting" : "connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;
    const timeout = window.setTimeout(() => socket.close(), 8000);
    socket.onopen = () => {
      clearTimeout(timeout);
      this.onstatus("connected");
      if (this.token) this.send({ type: "resume", token: this.token });
      else if (this.watchCode) this.send({ type: "watch", code: this.watchCode });
      else if (first) this.send(first);
    };
    socket.onmessage = (event) => {
      const msg: Packet = JSON.parse(event.data);
      if (msg.type === "room") this.attempts = 0;
      if (msg.type === "session") {
        this.token = msg.token;
        try {
          sessionStorage.setItem(
            "shiftchess-session",
            JSON.stringify({ token: this.token, url: this.url }),
          );
        } catch {}
      }
      this.onmessage(msg);
    };
    socket.onclose = () => {
      clearTimeout(timeout);
      if (this.closed) return;
      if ((this.token || this.watchCode) && ++this.attempts <= 20) {
        this.onstatus("reconnecting");
        this.retry = window.setTimeout(() => this.connect(), 1500);
      } else this.onstatus("offline");
    };
    socket.onerror = () => {};
  }
  resume(token: string) {
    this.token = token;
    this.connect();
  }
  watch(code: string) {
    this.watchCode = code;
    this.connect();
  }
  send(message: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }
  close() {
    this.closed = true;
    clearTimeout(this.retry);
    this.send({ type: "leave" });
    this.socket?.close();
    try {
      sessionStorage.removeItem("shiftchess-session");
    } catch {}
  }
}

export function serverUrl(entered: string) {
  const configured = entered.trim() || import.meta.env.VITE_SERVER_URL;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const localDev = import.meta.env.DEV || ["4173", "48648", "48649"].includes(location.port);
  const address = loopback && localDev
    ? location.hostname + ":48700"
    : location.host;
  const url = new URL(configured || protocol + "//" + address + "/socket");
  if (!["ws:", "wss:"].includes(url.protocol)) throw new Error("url");
  return url.href;
}
