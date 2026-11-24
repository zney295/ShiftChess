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
  await expect(page.locator("#briefing-badge-timing")).toContainText("Định kỳ mỗi 3 vòng");
  await page.locator("#accept-shift").click();
  await expect(page.locator("#viewport canvas")).toBeVisible();
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  await expect(page.locator("#shift-pips")).toHaveAttribute("aria-valuetext", "SHIFT sau 6 nước");
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
  await expect(page.locator("#event")).toContainText("a8 ↔ b8");
  await expect(page.locator("#event .pair")).toHaveAttribute("data-pair", "A");
  await expect(page.locator(".event")).toHaveAttribute("data-phase", "pending");
  await expect(page.locator("#event")).toContainText("Còn 2 nước");
  await expect(page.locator("#shift-pips")).toHaveAttribute("aria-valuenow", "4");
  await expect(page.locator("#shift-pips .filled")).toHaveCount(4);
  await expect(page.locator("#shift-pips .next")).toHaveCount(1);
  await switchLanguage(page, "en");
  await expect(page.locator("#event")).toContainText("2 moves left");
  await switchLanguage(page, "vi");
  await page.screenshot({ path: testInfo.outputPath("library.png") });
  await move("g1", "f3", "Lượt Đen");
  await expect(page.locator("#event")).toContainText("Còn 1 nước");
  await expect(page.locator("#shift-pips .filled")).toHaveCount(5);
  await move("b8", "c6", "Lượt Trắng");
  await expect(page.locator("#event")).toContainText("SHIFT đã đổi vị trí.");
  await expect(page.locator("#shift-pips .filled")).toHaveCount(0);
  await page.locator("#play-settings").click();
  await page.locator('[data-settings="visual"]').click();
  await page.locator("#view").selectOption("2d");
  await expect(page.locator("canvas")).toHaveAttribute("data-flat-side", "w");
  expect(errors).toEqual([]);
});
