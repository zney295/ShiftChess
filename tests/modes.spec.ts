import { expect, test } from "@playwright/test";
import { clickMove } from "./board";

test("bot answers, result offers rematch, and setup fits a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator("#difficulty").selectOption("easy");
  await page.locator("#start-bot").click();
  await page.locator("#accept-shift").click();
  await expect(page.locator("#play-screen")).toBeVisible();
  await expect(page.locator("#piece")).toBeEnabled();
  await clickMove(page, "e2", "e4");
  await expect(page.locator("#log li")).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator("#turn")).toHaveText("White to move");
  await page.locator("#menu").click();
  await page.locator("#resign").click();
  await expect(page.locator("#result-dialog")).toBeVisible();
  await page.locator("#rematch").click();
  await expect(page.locator("#briefing")).toBeVisible();
  await expect(page.locator("#log li")).toHaveCount(0);
});
test("two browsers confirm SHIFT, reconnect, spectate, and rematch", async ({
  browser,
}) => {
  const contextA = await browser.newContext({ reducedMotion: "reduce" }),
    contextB = await browser.newContext({ reducedMotion: "reduce" }),
    contextC = await browser.newContext({ reducedMotion: "reduce" });
  const a = await contextA.newPage(),
    b = await contextB.newPage();
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const [page, name] of [
      [a, "Alice"],
      [b, "Bob"],
    ] as const) {
      await page.goto("/");
      await page.locator("#start").click();
      await page.locator("#online-mode").click();
      await page.locator("#player-name").fill(name);
    }
    await a.locator("#create-room").click();
    await expect(a.locator("#invite-code")).toHaveText(/^[A-Z2-9]{6}$/);
    await b
      .locator("#room-code")
      .fill((await a.locator("#invite-code").textContent())!);
    await b.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(a.locator("#players li")).toHaveCount(2);
    await a.locator("#ready").click();
    await b.locator("#ready").click();
    await expect(a.locator("#briefing-title")).toHaveText(/\S/, { timeout: 20000 });
    await expect(b.locator("#briefing-title")).toHaveText(/\S/, { timeout: 20000 });
    expect(await a.locator("#briefing-title").textContent()).toEqual(
      await b.locator("#briefing-title").textContent(),
    );
    await a.locator("#accept-shift").click();
    await expect(a.locator("#briefing-status")).toBeVisible();
    await expect(a.locator("#piece")).toBeDisabled();
    await b.locator("#accept-shift").click();
    await expect(a.locator("#piece")).toBeEnabled();
    await expect(a.locator("#white-clock")).toHaveText(/^[0-5]:[0-5][0-9]$/);
    await expect(a.locator("#black-clock")).toHaveText("5:00");
    await clickMove(a, "e2", "e4");
    await expect(b.locator("#turn")).toHaveText("Black to move");
    await expect(b.locator("#piece")).toBeEnabled();
    await clickMove(b, "e7", "e5");
    await expect(a.locator("#turn")).toHaveText("White to move");
    await b.reload();
    await expect(b.locator("#turn")).toHaveText("White to move", { timeout: 20000 });
    await expect(b.locator("#viewport canvas")).toBeVisible();
    const viewer = await contextC.newPage();
    await viewer.goto("/");
    await viewer.locator("#start").click();
    await viewer.locator("#online-mode").click();
    await viewer.locator("#room-code").fill((await a.locator("#invite-code").textContent())!);
    await viewer.getByRole("button", { name: "Watch match" }).click();
    await expect(viewer.locator("#log li").nth(0)).toContainText("e4");
    await expect(viewer.locator("#log li").nth(1)).toContainText("e5");
    await expect(viewer.locator("#white-clock")).toBeVisible();
    await expect(viewer.locator("#piece")).toBeDisabled();
    await a.locator("#menu").click();
    await a.locator("#resign").click();
    await expect(a.locator("#result-dialog")).toBeVisible();
    await expect(b.locator("#result-dialog")).toBeVisible();
    await expect(viewer.locator("#result-dialog")).toBeVisible();
    await expect(viewer.locator("#rematch")).toBeHidden();
    await a.locator("#rematch").click();
    await b.locator("#rematch").click();
    await expect(a.locator("#log li")).toHaveCount(0);
    await expect(b.locator("#log li")).toHaveCount(0);
    await a.locator("#accept-shift").click();
    await b.locator("#accept-shift").click();
    await expect(b.locator("#piece")).toBeEnabled();
    await expect(viewer.locator("#result-dialog")).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await contextA.close();
    await contextB.close();
    await contextC.close();
  }
});

test("Black can play and undo a full bot turn on the keyboard board without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...options: unknown[]) {
      return kind === "webgl2" || kind === "webgl"
        ? null : Reflect.apply(original, this, [kind, ...options]);
    } as typeof original;
  });
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator("#difficulty").selectOption("easy");
  await page.locator("#bot-color").selectOption("b");
  await page.locator("#start-bot").click();
  await page.locator("#accept-shift").click();
  await expect(page.locator("#viewport")).toHaveAttribute("data-flat-board", "true");
  await expect(page.locator("#turn")).toHaveText("Black to move");
  await expect(page.locator("#log li")).toHaveCount(1);
  const board = page.getByRole("grid", { name: "Chessboard" });
  const pawn = board.getByRole("gridcell", { name: "e7, Black Pawn" });
  await pawn.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(board.getByRole("gridcell", { name: /e5.*Legal destination/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#log li")).toHaveCount(3);
  await page.keyboard.press("h");
  await page.locator("#undo").click();
  await expect(page.locator("#log li")).toHaveCount(1);
  await expect(pawn).toHaveText("♟");
});

test("local turn stays paused during the briefing, then advances automatically", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...options: unknown[]) {
      return kind === "webgl2" ? null : Reflect.apply(original, this, [kind, ...options]);
    } as typeof original;
  });
  await page.clock.install();
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator("#local-mode").click();
  await expect(page.locator("#briefing")).toBeVisible();
  await page.clock.fastForward(31_000);
  await expect(page.locator("#log li")).toHaveCount(0);
  await page.locator("#accept-shift").click();
  await expect(page.locator("#white-player .turn-seconds")).toHaveText("30");
  await page.clock.fastForward(31_000);
  await expect(page.locator("#log li")).toHaveCount(1);
  await expect(page.locator("#turn")).toHaveText("Black to move");
  await expect(page.locator("#black-player .turn-seconds")).toBeVisible();
  await expect(page.locator("#board-toast")).toContainText("Turn time expired");
  await expect(page.locator("#board-toast")).toContainText("The game made a legal move.");
});
