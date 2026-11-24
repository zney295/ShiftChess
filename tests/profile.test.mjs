import assert from "node:assert/strict";
import test from "node:test";
import {
  BOT_RATINGS,
  STARTING_RATING,
  computeElo,
  formatSignedDelta,
  isRatedMode,
  loadProfile,
  recordMatchResult,
  saveProfile,
} from "../src/profile.ts";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test("only bot and active online matches qualify for Elo; local and spectating are unrated", () => {
  assert.equal(isRatedMode("bot", false), true);
  assert.equal(isRatedMode("online", false), true);
  assert.equal(isRatedMode("online", true), false);
  assert.equal(isRatedMode("local", false), false);
});

test("computeElo handles wins, draws, losses, provisional K-factor, and rating floor", () => {
  const equalWin = computeElo(1200, 1200, "win", 0);
  assert.deepEqual(equalWin, { before: 1200, delta: 16, after: 1216 });

  const equalDraw = computeElo(1200, 1200, "draw", 0);
  assert.deepEqual(equalDraw, { before: 1200, delta: 0, after: 1200 });

  const equalLoss = computeElo(1200, 1200, "loss", 0);
  assert.deepEqual(equalLoss, { before: 1200, delta: -16, after: 1184 });

  // Upset win against expert bot awards more than beating easy bot
  const upset = computeElo(1200, BOT_RATINGS.expert, "win", 5);
  const expectedWin = computeElo(1200, BOT_RATINGS.easy, "win", 5);
  assert.ok(upset.delta > expectedWin.delta);

  // Established player (>= 30 games) uses K=24
  const established = computeElo(1200, 1200, "win", 30);
  assert.equal(established.delta, 12);

  // Rating never drops below 100
  const floor = computeElo(105, 1200, "loss", 0);
  assert.ok(floor.after >= 100);
});

test("recordMatchResult is strictly idempotent per matchId and persists across restarts", () => {
  const storage = memoryStorage();
  const profile = loadProfile(storage);
  assert.equal(profile.rating, STARTING_RATING);

  const first = recordMatchResult(
    profile,
    {
      matchId: "bot-match-1",
      mode: "bot",
      watching: false,
      difficulty: "normal",
      opponentName: "Bot (Normal)",
      outcome: "win",
    },
    storage,
  );
  assert.equal(first.rated, true);
  assert.equal(first.before, 1200);
  assert.equal(first.delta, 16);
  assert.equal(first.after, 1216);
  assert.equal(formatSignedDelta(first.delta), "+16");
  assert.equal(profile.wins, 1);

  // Simulate refreshing or reopening the results screen -> exact same matchId must NOT double-count!
  const reloaded = loadProfile(storage);
  assert.equal(reloaded.rating, 1216);
  assert.equal(reloaded.wins, 1);
  const duplicate = recordMatchResult(
    reloaded,
    {
      matchId: "bot-match-1",
      mode: "bot",
      watching: false,
      difficulty: "normal",
      opponentName: "Bot (Normal)",
      outcome: "win",
    },
    storage,
  );
  assert.deepEqual(duplicate, first);
  assert.equal(reloaded.rating, 1216);
  assert.equal(reloaded.wins, 1);

  // Local pass-and-play match leaves Elo untouched
  const unrated = recordMatchResult(
    reloaded,
    {
      matchId: "local-match-1",
      mode: "local",
      watching: false,
      opponentName: "Local",
      outcome: "win",
    },
    storage,
  );
  assert.equal(unrated.rated, false);
  assert.equal(reloaded.rating, 1216);
  assert.equal(reloaded.wins, 1);

  // Name persists across restarts
  reloaded.name = "An";
  saveProfile(reloaded, storage);
  assert.equal(loadProfile(storage).name, "An");
});
