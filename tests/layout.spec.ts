import { expect, test, type Page } from "@playwright/test";
import { boardPoint } from "./board";

async function fitsScreen(page: Page, selectors: string[]) {
  const { width, height } = page.viewportSize()!;
  for (const selector of selectors) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds, selector).not.toBeNull();
    expect(bounds!.x, selector).toBeGreaterThanOrEqual(0);
    expect(bounds!.y, selector).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width, selector).toBeLessThanOrEqual(width + 1);
    expect(bounds!.y + bounds!.height, selector).toBeLessThanOrEqual(
      height + 1,
    );
  }
  expect(
    await page.evaluate(() => ({
      width: document.scrollingElement!.scrollWidth,
      height: document.scrollingElement!.scrollHeight,
    })),
  ).toEqual({ width, height });
}

test("click the piece and destination, then continue on a compact screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await fitsScreen(page, ["#start", "#locale"]);
  await expect(page.locator("#viewport canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Chuyển sang tiếng Việt" }).click();
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await expect(page.locator("#mode-screen")).toBeVisible();
  for (const viewport of [
    { width: 320, height: 480 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await fitsScreen(page, ["#mode-title", "#local-mode", "#mode-back"]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator("#local-mode").click();
  await page.locator("#accept-shift").click();
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  await expect(page.locator("#shift-heading")).toHaveText(/SHIFT/);
  const head = await boardPoint(page, "e2", { height: 0.73 });
  await page.mouse.click(head.x, head.y);
  await expect(page.locator("#piece")).toHaveValue("e2");
  const e4 = await boardPoint(page, "e4");
  await page.mouse.click(e4.x, e4.y);
  await expect(page.locator("#turn")).toHaveText("Lượt Đen");
  const e7 = await boardPoint(page, "e7", { height: 0.45 });
  const e5 = await boardPoint(page, "e5");
  await page.mouse.move(e7.x, e7.y);
  await page.mouse.down();
  await page.mouse.move(e4.x, e4.y, { steps: 5 });
  await page.mouse.up(); // Illegal drop returns the pawn to e7.
  await expect(page.locator("#piece")).toHaveValue("e7");
  await expect(page.locator("#turn")).toHaveText("Lượt Đen");
  await page.mouse.move(e7.x, e7.y);
  await page.mouse.down();
  await page.mouse.move(e5.x, e5.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  await page.getByRole("button", { name: "Nhìn thẳng" }).click();
  await expect(page.getByRole("button", { name: "Góc nghiêng" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.locator("#turn")).toHaveText("White to move");

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 320, height: 480 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await fitsScreen(page, [
      "#viewport canvas",
      "#view",
      "#menu",
      "#event",
      "#locale",
      ".history-link",
    ]);
  }
  await page.keyboard.press("g");
  await fitsScreen(page, [
    "#moves-dialog",
    "#piece",
    "#target",
    "#confirm-move",
  ]);
  await page.locator("#piece").selectOption("g1");
  await page.locator("#target").selectOption("f3");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.locator("#turn")).toHaveText("Black to move");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "New game" }).click();
  await page.locator("#leave").click();
  await expect(page.locator("#viewport canvas")).toBeHidden();
  await fitsScreen(page, ["#start", "#locale"]);
  await page.setViewportSize({ width: 320, height: 480 });
  await fitsScreen(page, ["#start", "#locale"]);
});
