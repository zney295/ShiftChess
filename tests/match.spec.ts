import { expect, test } from "@playwright/test";

test("two players see a capture, a countdown, and a SHIFT in the library", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await page.evaluate(() => {
    let calls = 0;
    Math.random = () => (calls++ === 0 ? 0.75 : 0);
  });
  await page.locator("#local-mode").click();
  await expect(page.locator("#viewport canvas")).toBeVisible();
  await expect(page.locator("#location")).toHaveText("Thư viện");
  await expect(page.locator("#turn")).toHaveText("Lượt Trắng");
  await expect(page.locator("#rule")).toContainText("Định kỳ mỗi 3 vòng");
  await page.locator("#accept-shift").click();
  const move = async (from: string, to: string, next: string) => {
    await page.locator('[data-open="moves-dialog"]').click();
    await page.locator("#piece").selectOption(from);
    await page.locator("#target").selectOption(to);
    await page.locator("#confirm-move").click();
    await expect(page.locator("#turn")).toHaveText(next);
  };
  await move("e2", "e4", "Lượt Đen");
  await move("d7", "d5", "Lượt Trắng");
  await move("e4", "d5", "Lượt Đen");
  await expect(page.locator("#log")).toContainText("exd5");
  await move("g8", "f6", "Lượt Trắng");
  await expect(page.locator("#event")).toContainText("a8 ↔ b8");
  await expect(page.locator("#event")).toContainText("Còn 2 nước");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.locator("#event")).toContainText("2 moves left");
  await page.getByRole("button", { name: "Chuyển sang tiếng Việt" }).click();
  await page.screenshot({ path: testInfo.outputPath("library.png") });
  await move("g1", "f3", "Lượt Đen");
  await expect(page.locator("#event")).toContainText("Còn 1 nước");
  await move("b8", "c6", "Lượt Trắng");
  await expect(page.locator("#event")).toContainText("SHIFT đã đổi vị trí.");
  await page.getByRole("button", { name: "Toàn bàn" }).click();
  await expect(page.getByRole("button", { name: "Nhập vai" })).toBeVisible();
  expect(errors).toEqual([]);
});
