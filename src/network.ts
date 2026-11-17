import type { MatchState } from "./rules";
export type Room = {
  code: string;
  phase: "waiting" | "briefing" | "playing" | "ended";
  quick: boolean;
  setting: "park" | "library";
  state?: MatchState;
  revision: number;
  disconnectedUntil?: number;
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
export class Connection {
  private socket?: WebSocket;
  private token?: string;
  private closed = false;
  private retry?: number;
  private attempts = 0;
  onmessage: (message: any) => void = () => {};
  onstatus: (
    status: "connecting" | "connected" | "reconnecting" | "offline",
  ) => void = () => {};
  constructor(private readonly url: string) {}
  connect(first?: Record<string, unknown>) {
    this.closed = false;
    this.onstatus(this.token ? "reconnecting" : "connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;
    const timeout = window.setTimeout(() => socket.close(), 8000);
    socket.onopen = () => {
      clearTimeout(timeout);
      this.attempts = 0;
      this.onstatus("connected");
      if (this.token) this.send({ type: "resume", token: this.token });
      else if (first) this.send(first);
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
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
      if (this.token && ++this.attempts <= 20) {
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
