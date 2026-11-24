import { expect, test } from "@playwright/test";

test("menus isolate input, shortcuts work, and leaving requires confirmation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(page.locator("#viewport canvas[data-camera-position]")).toBeVisible();
  await expect(page.locator("#viewport canvas[data-cinematic]")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("start-mobile.png") });
  await page.locator("#start").click();
  await expect(page.locator("#mode-screen button:disabled")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("modes-mobile.png") });
  await page.locator("#local-mode").click();
  await expect(page.locator("#briefing")).toBeVisible();
  await expect(page.locator("#briefing")).toContainText(
    "Each turn lasts 30 seconds.",
  );
  await page.locator("#accept-shift").click();
  await page.screenshot({ path: testInfo.outputPath("play-mobile.png") });
  await expect(page.locator("#moves-dialog")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-dialog")).toBeVisible();
  await page.locator("#settings").click();
  await expect(page.locator("#preferences-dialog")).toBeVisible();
  await page.locator("#view").selectOption("2d");
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveAccessibleName("Unmute");
  await page.locator("#quality").selectOption("low");
  await page.locator("#animation-speed").selectOption("fast");
  await page.locator("#camera-shake").uncheck();
  await page.getByRole("tab", { name: "Graphics" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Gameplay" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Gameplay" })).toBeVisible();
  await page.locator("#move-hints").uncheck();
  await page.locator("#auto-queen").check();
  await page.locator("#board-theme").selectOption("library");
  await expect(page.locator("#preferences-dialog [data-close]")).toBeInViewport();
  await page.locator("#preferences-dialog [data-close]").click();
  await expect(page.locator("#turn")).toHaveText("White to move");
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
  await page.locator("#play-settings").click();
  await page.locator("#fullscreen").click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await expect(page.locator("#fullscreen")).toHaveAccessibleName("Exit fullscreen");
  await page.locator("#fullscreen").click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
  await expect(page.locator("#fullscreen")).toHaveAccessibleName("Fullscreen");
  await page.locator("#preferences-dialog [data-close]").click();
  await page.locator("#menu").click();
  await page.locator("#new-game").click();
  await expect(page.locator("#restart-dialog")).toBeVisible();
  await page.locator("#confirm-restart").click();
  await expect(page.locator("#briefing")).toBeVisible();
  await page.reload();
  await page.locator("#start-screen [data-open='preferences-dialog']").click();
  await expect(page.locator("#quality")).toHaveValue("low");
  await expect(page.locator("#animation-speed")).toHaveValue("fast");
  await expect(page.locator("#camera-shake")).not.toBeChecked();
  await expect(page.locator("#view")).toHaveValue("2d");
  await page.locator('[data-settings="play"]').click();
  await expect(page.locator("#move-hints")).not.toBeChecked();
  await expect(page.locator("#auto-queen")).toBeChecked();
  await expect(page.locator("#board-theme")).toHaveValue("library");
  await expect(page.locator("#sound")).toHaveAccessibleName("Unmute");
});

test("the lobby cinematic loops and releases the board for settings and a match", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const scene = page.locator("#viewport canvas[data-cinematic]");
  await expect(scene).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#start")).toBeVisible();
  const openingTarget = await scene.getAttribute("data-camera-target");
  await expect(scene).not.toHaveAttribute("data-camera-target", openingTarget!);
  await expect(scene).toHaveAttribute("data-camera-target", openingTarget!, { timeout: 22000 });
  await page.locator("#start-settings").click();
  await page.locator('[data-settings="audio"]').click();
  await expect(page.locator("#lobby-sound")).not.toBeChecked();
  await expect(scene).toHaveCount(0);
  await page.locator("#lobby-sound").check();
  await page.locator("#preferences-dialog [data-close]").click();
  await expect(scene).toBeVisible();
  await page.locator("#start").click();
  await expect(scene).toHaveCount(0);
  await page.locator("#local-mode").click();
  await expect(page.locator("#turn")).toHaveText("White to move");
  await expect(page.locator("#viewport canvas")).toHaveAttribute("data-presenting", "false");
});
