import { expect, test, type Page } from "@playwright/test";

async function move(page: Page, from: string, to: string) {
  await page.locator('[data-open="moves-dialog"]').click();
  await page.locator("#piece").selectOption(from);
  await page.locator("#target").selectOption(to);
  await page.locator("#confirm-move").click();
}
test("bot answers, result offers rematch, and setup fits a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator("#bot-mode").click();
  await page.locator("#difficulty").selectOption("easy");
  await page.locator("#start-bot").click();
  await page.locator("#accept-shift").click();
  await move(page, "e2", "e4");
  await expect(page.locator("#log li")).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  await page.locator("#menu").click();
  await page.locator("#resign").click();
  await expect(page.locator("#result-dialog")).toBeVisible();
  await page.locator("#rematch").click();
  await expect(page.locator("#briefing")).toBeVisible();
  await expect(page.locator("#log li")).toHaveCount(0);
});
test("two browsers join by code, agree SHIFT, play, reconnect, and rematch", async ({
  browser,
}) => {
  const contextA = await browser.newContext({ reducedMotion: "reduce" }),
    contextB = await browser.newContext({ reducedMotion: "reduce" });
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
      await page.locator(".server-config summary").click();
      await page.locator("#server-url").fill("ws://127.0.0.1:48700/socket");
    }
    await a.locator("#create-room").click();
    await expect(a.locator("#invite-code")).toHaveText(/^[A-Z2-9]{6}$/);
    await b
      .locator("#room-code")
      .fill((await a.locator("#invite-code").textContent())!);
    await b.locator("#join-form button").click();
    await expect(a.locator("#players li")).toHaveCount(2);
    await a.locator("#ready").click();
    await b.locator("#ready").click();
    await expect(a.locator("#briefing")).toBeVisible({ timeout: 20000 });
    await expect(b.locator("#briefing")).toBeVisible({ timeout: 20000 });
    expect(await a.locator("#briefing-title").textContent()).toEqual(
      await b.locator("#briefing-title").textContent(),
    );
    await a.locator("#accept-shift").click();
    await b.locator("#accept-shift").click();
    await expect(a.locator("#briefing")).toBeHidden();
    await move(a, "e2", "e4");
    await expect(b.locator("#turn")).toHaveText("Lượt Đen");
    await move(b, "e7", "e5");
    await expect(a.locator("#turn")).toHaveText("Lượt Trắng");
    await b.reload();
    await expect(b.locator("#viewport canvas")).toBeVisible();
    await expect(b.locator("#turn")).toHaveText("Lượt Trắng");
    await a.locator("#menu").click();
    await a.locator("#resign").click();
    await expect(a.locator("#result-dialog")).toBeVisible();
    await expect(b.locator("#result-dialog")).toBeVisible();
    await a.locator("#rematch").click();
    await b.locator("#rematch").click();
    await expect(a.locator("#briefing")).toBeVisible();
    await expect(b.locator("#briefing")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
