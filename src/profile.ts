import type { Difficulty } from "./bot";

export const PROFILE_STORAGE_KEY = "shiftchess-profile";
export const STARTING_RATING = 1200;
export const ONLINE_DEFAULT_RATING = 1200;
export const BOT_RATINGS: Record<Difficulty, number> = {
  easy: 900,
  normal: 1200,
  expert: 1550,
};

export type MatchOutcome = "win" | "draw" | "loss";

export type EloDelta = {
  matchId: string;
  rated: boolean;
  opponentName: string;
  opponentRating?: number;
  before: number;
  delta: number;
  after: number;
  outcome: MatchOutcome;
};

export type LocalProfile = {
  name: string;
  rating: number;
  wins: number;
  draws: number;
  losses: number;
  recordedMatches: string[];
  resultsByMatch: Record<string, EloDelta>;
};

export function isRatedMode(
  mode: "local" | "bot" | "online",
  watching: boolean,
): boolean {
  if (watching) return false;
  return mode === "bot" || mode === "online";
}

export function computeElo(
  rating: number,
  opponentRating: number,
  outcome: MatchOutcome,
  gamesPlayed: number,
): { before: number; delta: number; after: number } {
  const score = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  const k = gamesPlayed < 30 ? 32 : 24;
  const rawDelta = Math.round(k * (score - expected));
  const after = Math.max(100, rating + rawDelta);
  return {
    before: rating,
    delta: after - rating,
    after,
  };
}

export function defaultProfile(): LocalProfile {
  return {
    name: "Player",
    rating: STARTING_RATING,
    wins: 0,
    draws: 0,
    losses: 0,
    recordedMatches: [],
    resultsByMatch: {},
  };
}

export function loadProfile(storage?: Pick<Storage, "getItem">): LocalProfile {
  const base = defaultProfile();
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    const raw = store?.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return base;
    if (typeof saved.name === "string" && saved.name.trim()) {
      base.name = saved.name.trim().slice(0, 24);
    }
    if (typeof saved.rating === "number" && Number.isFinite(saved.rating)) {
      base.rating = Math.max(100, Math.round(saved.rating));
    }
    for (const key of ["wins", "draws", "losses"] as const) {
      if (typeof saved[key] === "number" && Number.isInteger(saved[key]) && saved[key] >= 0) {
        base[key] = saved[key];
      }
    }
    if (Array.isArray(saved.recordedMatches)) {
      base.recordedMatches = saved.recordedMatches
        .filter((id: unknown): id is string => typeof id === "string")
        .slice(-200);
    }
    if (saved.resultsByMatch && typeof saved.resultsByMatch === "object") {
      const entries = Object.entries(saved.resultsByMatch).filter(
        ([id, val]) =>
          base.recordedMatches.includes(id) &&
          val &&
          typeof val === "object" &&
          typeof (val as EloDelta).after === "number",
      ) as [string, EloDelta][];
      base.resultsByMatch = Object.fromEntries(entries);
    }
  } catch {}
  return base;
}

export function saveProfile(
  profile: LocalProfile,
  storage?: Pick<Storage, "setItem">,
) {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    store?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

export function recordMatchResult(
  profile: LocalProfile,
  params: {
    matchId: string;
    mode: "local" | "bot" | "online";
    watching: boolean;
    difficulty?: Difficulty;
    opponentName: string;
    opponentRating?: number;
    outcome: MatchOutcome;
  },
  storage?: Pick<Storage, "setItem">,
): EloDelta {
  const existing = profile.resultsByMatch[params.matchId];
  if (existing) return existing;

  const rated = isRatedMode(params.mode, params.watching);
  if (!rated) {
    return {
      matchId: params.matchId,
      rated: false,
      opponentName: params.opponentName,
      before: profile.rating,
      delta: 0,
      after: profile.rating,
      outcome: params.outcome,
    };
  }

  const opponentRating =
    params.opponentRating ??
    (params.mode === "bot"
      ? BOT_RATINGS[params.difficulty ?? "normal"]
      : ONLINE_DEFAULT_RATING);
  const gamesPlayed = profile.wins + profile.draws + profile.losses;
  const calc = computeElo(profile.rating, opponentRating, params.outcome, gamesPlayed);

  profile.rating = calc.after;
  if (params.outcome === "win") profile.wins++;
  else if (params.outcome === "draw") profile.draws++;
  else profile.losses++;

  const record: EloDelta = {
    matchId: params.matchId,
    rated: true,
    opponentName: params.opponentName,
    opponentRating,
    before: calc.before,
    delta: calc.delta,
    after: calc.after,
    outcome: params.outcome,
  };

  profile.recordedMatches.push(params.matchId);
  if (profile.recordedMatches.length > 200) {
    const removed = profile.recordedMatches.shift();
    if (removed) delete profile.resultsByMatch[removed];
  }
  profile.resultsByMatch[params.matchId] = record;
  saveProfile(profile, storage);
  return record;
}

export function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return "±0";
}
