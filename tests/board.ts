import type { Page } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";

export async function boardPoint(
  page: Page,
  square: string,
  { side = "w", overhead = false, height = 0.004 } = {},
) {
  const canvas = (await page.locator("#viewport canvas").boundingBox())!;
  const aspect = canvas.width / canvas.height;
  const vertical = Math.max(9.05, 9.15 / aspect) / 2;
  const horizontal = vertical * aspect;
  const camera = new OrthographicCamera(-horizontal, horizontal, vertical, -vertical, 0.1, 40);
  camera.position.set(0, 14, (side === "w" ? 1 : -1) * (overhead ? 0.001 : 6.8));
  camera.lookAt(0, 0.08, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(
    square.charCodeAt(0) - 100.5, height, 4.5 - Number(square[1]),
  ).project(camera);
  return {
    x: canvas.x + (point.x + 1) * canvas.width / 2,
    y: canvas.y + (1 - point.y) * canvas.height / 2,
  };
}

export async function clickMove(page: Page, from: string, to: string, side = "w") {
  const source = await boardPoint(page, from, { side, height: 0.24 });
  const target = await boardPoint(page, to, { side });
  await page.mouse.click(source.x, source.y);
  await page.mouse.click(target.x, target.y);
}
