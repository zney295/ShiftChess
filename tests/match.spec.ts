import { expect, test } from "@playwright/test";
import { clickMove } from "./board";

async function switchLanguage(page: import("@playwright/test").Page, language: "en" | "vi", entrance = "#play-settings") {
  await page.locator(entrance).click();
  await page.locator('[data-settings="play"]').click();
  await page.locator("#language").selectOption(language);
  await page.keyboard.press("Escape");
}

test("two players see a capture, a countdown, and a SHIFT in the library", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("shiftchess-preferences", JSON.stringify({ theme: "library", language: "vi" }));
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await page.locator("#local-mode").click();
  await expect(page.locator("#briefing-badge-map")).toHaveText("Thư viện");
  await expect(page.locator("#briefing-badge-timing")).toContainText("Định kỳ mỗi 10 lượt");
  await page.locator("#accept-shift").click();
  await expect(page.locator("#viewport canvas")).toBeVisible();
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  await expect(page.locator("#shift-pips")).toHaveAttribute("aria-valuetext", "SHIFT sau 20 nước");
  await expect(page.locator("#shift-pips .filled")).toHaveCount(0);
  const move = async (from: string, to: string, next: string) => {
    await clickMove(page, from, to);
    await expect(page.locator("#turn")).toHaveText(next);
  };
  await move("e2", "e4", "Lượt Đen");
  await move("d7", "d5", "Lượt Trắng");
  await move("e4", "d5", "Lượt Đen");
  await expect(page.locator("#log")).toContainText("exd5");
  await expect(page.locator("#captured-white span")).toHaveCount(1);
  await expect(page.locator("#advantage-white")).toHaveText("+1");
  await move("g8", "f6", "Lượt Trắng");
  await expect(page.locator("#shift-pips")).toHaveAttribute("aria-valuetext", "SHIFT sau 16 nước");
  await switchLanguage(page, "en");
  await expect(page.locator("#shift-pips")).toHaveAttribute("aria-valuetext", "SHIFT in 16 half-moves");
  await switchLanguage(page, "vi");
  await page.screenshot({ path: testInfo.outputPath("library.png") });
  await page.locator("#play-settings").click();
  await page.locator('[data-settings="visual"]').click();
  await page.locator("#view").selectOption("2d");
  await expect(page.locator("canvas")).toHaveAttribute("data-flat-side", "w");
  expect(errors).toEqual([]);
});

test("start showcase switches SHIFT modes, 10-pip HUD stays single-row, and ply-18 swap triggers simultaneous handoff", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...options: unknown[]) {
      return kind === "webgl2" || kind === "webgl"
        ? null
        : Reflect.apply(original, this, [kind, ...options]);
    } as typeof original;
    localStorage.setItem("shiftchess-preferences", JSON.stringify({ theme: "library", language: "vi" }));
    Math.random = () => 0; // selects periodic + swap
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  // Verify interactive Shift Showcase Widget on Start screen
  await expect(page.locator("#shift-showcase")).toHaveAttribute("data-showcase", "swap");
  await page.locator('[data-showcase-tab="slide"]').click();
  await expect(page.locator("#shift-showcase")).toHaveAttribute("data-showcase", "slide");
  await page.locator('[data-showcase-tab="clash"]').click();
  await expect(page.locator("#shift-showcase")).toHaveAttribute("data-showcase", "clash");
  await expect(page.locator("#showcase-caption")).toContainText("triệt tiêu");

  // Enter local match
  await page.locator("#start").click();
  await page.locator("#local-mode").click();
  await expect(page.locator("#briefing-title")).toContainText("SHIFT · Đổi chỗ");
  await page.locator("#accept-shift").click();

  // Verify all 10 shift-pips align on a single horizontal row
  const pipRows = await page.locator("#shift-pips i").evaluateAll((els) =>
    new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size,
  );
  expect(pipRows).toBe(1);
  await expect(page.locator("#shift-pips i")).toHaveCount(10);

  // Play 18 plies quickly via coordinate move dialog to reach ply-18 Simultaneous Turn
  const moves: [string, string][] = [
    ["e2", "e4"], ["e7", "e5"],
    ["g1", "f3"], ["b8", "c6"],
    ["f1", "b5"], ["a7", "a6"],
    ["b5", "a4"], ["g8", "f6"],
    ["e1", "g1"], ["f8", "e7"],
    ["f1", "e1"], ["b7", "b5"],
    ["a4", "b3"], ["d7", "d6"],
    ["c2", "c3"], ["e8", "g8"],
    ["h2", "h3"], ["c6", "b8"],
  ];
  for (const [from, to] of moves) {
    await page.keyboard.press("g");
    await page.locator("#piece").selectOption(from);
    await page.locator("#target").selectOption(to);
    await page.locator("#confirm-move").click();
  }

  // At ply 18, Swap enters Simultaneous Turn!
  await expect(page.locator("#simultaneous-banner")).toBeVisible();
  await expect(page.locator("#lock-w")).toHaveAttribute("data-locked", "false");
  await expect(page.locator("#lock-b")).toHaveAttribute("data-locked", "false");

  // White locks secret move d2 -> d4
  await page.keyboard.press("g");
  await page.locator("#piece").selectOption("d2");
  await page.locator("#target").selectOption("d4");
  await page.locator("#confirm-move").click();

  // Handoff button appears for Black
  await expect(page.locator("#lock-w")).toHaveAttribute("data-locked", "true");
  await expect(page.locator("#simultaneous-handoff")).toBeVisible();
  await page.locator("#simultaneous-handoff").click();

  // Black locks secret move b8 -> d7 -> both resolve simultaneously + ply-20 SHIFT!
  await page.keyboard.press("g");
  await page.locator("#piece").selectOption("b8");
  await page.locator("#target").selectOption("d7");
  await page.locator("#confirm-move").click();

  await expect(page.locator("#simultaneous-banner")).toBeHidden();
  await expect(page.locator("#log")).toContainText("d4 | Nbd7");
  await expect(page.locator("#log")).toContainText("SHIFT");
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  expect(errors).toEqual([]);
});

test("rated bot match records Elo once, allows final-position inspection, and captures lobby & active-SHIFT visuals", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("shiftchess-preferences", JSON.stringify({ theme: "library", language: "vi" }));
    Math.random = () => 0; // periodic + swap
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.locator("#profile-elo-value")).toHaveText("1200");
  await expect(page.locator("#viewport canvas")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#initial-loader")).toHaveCount(0, { timeout: 5000 });
  await page.screenshot({ path: "output/remake-lobby-start.png" });

  await page.locator("#start").click();
  await expect(page.locator("#mode-profile-elo")).toHaveText("1200");
  await expect(page.locator(".mode-miniboard")).toHaveCount(3);
  await page.screenshot({ path: "output/remake-lobby-modes.png" });

  // Start a rated Bot match (Normal = Elo 1200)
  await page.locator("#difficulty").selectOption("normal");
  await page.locator("#start-bot").click();
  await expect(page.locator("#briefing")).toBeVisible();
  await page.screenshot({ path: "output/remake-briefing.png" });
  await page.locator("#accept-shift").click();

  // Resign to finish the rated match and verify Elo delta + Inspect Board + idempotency
  await page.locator("#menu").click();
  await page.locator("#resign").click();
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-rating")).toBeVisible();
  await expect(page.locator("#result-elo-before")).toHaveText("1200");
  await expect(page.locator("#result-elo-delta")).toHaveText("-16");
  await expect(page.locator("#result-elo-after")).toHaveText("1184");
  await page.screenshot({ path: "output/remake-results-elo.png" });

  // Inspect final board position, then reopen results -> Elo must NOT be double-counted!
  await page.locator("#result-inspect").click();
  await expect(page.locator("#result-dialog")).toBeHidden();
  await expect(page.locator("#reopen-result")).toBeVisible();
  await page.locator("#reopen-result").click();
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-elo-after")).toHaveText("1184");

  // Return to lobby & reload -> persisted Elo 1184 remains across browser restart
  await page.locator("#result-leave").click();
  await expect(page.locator("#profile-elo-value")).toHaveText("1184");
  await page.reload();
  await expect(page.locator("#profile-elo-value")).toHaveText("1184");
  expect(errors).toEqual([]);
});

test("captures 3D active-SHIFT board with Vermilion/Jade surface alteration and simultaneous dock", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "shiftchess-preferences",
      JSON.stringify({ theme: "park", language: "vi", quality: "low", speed: "fast", localFlip: false }),
    );
    Math.random = () => 0; // periodic + swap
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator("#local-mode").click();
  await page.locator("#accept-shift").click();
  await expect(page.locator("#piece")).toBeEnabled();
  const initialCamera = await page.locator("canvas").getAttribute("data-camera-position");
  const moves: [string, string][] = [
    ["e2", "e4"], ["e7", "e5"],
    ["g1", "f3"], ["b8", "c6"],
    ["f1", "b5"], ["a7", "a6"],
    ["b5", "a4"], ["g8", "f6"],
    ["e1", "g1"], ["f8", "e7"],
    ["f1", "e1"], ["b7", "b5"],
    ["a4", "b3"], ["d7", "d6"],
    ["c2", "c3"], ["e8", "g8"],
    ["h2", "h3"], ["c6", "b8"],
  ];
  for (const [index, [from, to]] of moves.entries()) {
    await expect(page.locator("#piece")).toBeEnabled();
    await page.keyboard.press("g");
    await page.locator("#piece").selectOption(from);
    await page.locator("#target").selectOption(to);
    await page.locator("#confirm-move").click();
    await expect(page.locator("#log li")).toHaveCount(index + 1);
  }
  await expect(page.locator("#simultaneous-banner")).toBeVisible();
  expect(await page.locator("canvas").getAttribute("data-camera-position")).toBe(initialCamera);
  await page.screenshot({ path: "output/remake-active-shift-3d.png" });
  expect(errors).toEqual([]);
});
