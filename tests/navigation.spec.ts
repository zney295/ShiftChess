import { expect, test } from "@playwright/test";

test("menus isolate input, shortcuts work, and leaving requires confirmation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.screenshot({ path: testInfo.outputPath("start-mobile.png") });
  await page.locator("#start").click();
  await expect(page.locator("#mode-screen button:disabled")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("modes-mobile.png") });
  await page.locator("#local-mode").click();
  await expect(page.locator("#briefing")).toBeVisible();
  await expect(page.locator("#briefing")).toContainText(
    "Cả hai bên dùng cùng một SHIFT",
  );
  await page.locator("#accept-shift").click();
  await page.screenshot({ path: testInfo.outputPath("play-mobile.png") });
  await expect(page.locator("#moves-dialog")).not.toBeVisible();
  await page.keyboard.press("v");
  await expect(page.locator("#view")).toHaveText("Góc nghiêng");
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-dialog")).toBeVisible();
  await page.keyboard.press("v");
  await expect(page.locator("#view")).toHaveText("Góc nghiêng");
  await page.locator("#settings").click();
  await expect(page.locator("#leave-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  await page.locator("#menu").focus();
  await page.keyboard.press("m");
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("h");
  await expect(page.locator("#history-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await expect(page.locator("#moves-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  await expect(page.locator("#help-dialog")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("help-mobile.png") });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator("#fullscreen").click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
});
