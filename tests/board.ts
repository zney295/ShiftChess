import type { Page } from "@playwright/test";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

export async function boardPoint(
  page: Page,
  square: string,
  { height = 0.004 } = {},
) {
  const view = page.locator('#viewport canvas[data-presenting="false"]');
  const { x, y, width, height: viewHeight, position, target, fov, flatHeight, flatSide } = await view.evaluate(async (canvas: HTMLCanvasElement) => {
    // Let ResizeObserver and the following render update the projection after a viewport resize.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const { x, y, width, height } = canvas.getBoundingClientRect();
    return {
      x, y, width, height,
      position: JSON.parse(canvas.dataset.cameraPosition!) as [number, number, number],
      target: JSON.parse(canvas.dataset.cameraTarget!) as [number, number, number],
      fov: Number(canvas.dataset.cameraFov),
      flatHeight: Number(canvas.dataset.flatHeight),
      flatSide: canvas.dataset.flatSide,
    };
  });
  const aspect = width / viewHeight;
  const camera = flatHeight
    ? new OrthographicCamera(-flatHeight * aspect, flatHeight * aspect, flatHeight, -flatHeight, 0.1, 100)
    : new PerspectiveCamera(fov, aspect, 0.1, 100);
  if (flatHeight) camera.up.set(0, 0, flatSide === "b" ? 1 : -1);
  camera.position.set(...position);
  camera.lookAt(...target);
  camera.updateMatrixWorld();
  const point = new Vector3(
    square.charCodeAt(0) - 100.5, height, 4.5 - Number(square[1]),
  ).project(camera);
  return {
    x: x + (point.x + 1) * width / 2,
    y: y + (1 - point.y) * viewHeight / 2,
  };
}

export async function clickMove(page: Page, from: string, to: string) {
  // At a seated angle the pedestal can be behind a piece in the nearer rank.
  const source = await boardPoint(page, from, { height: 0.66 });
  const target = await boardPoint(page, to);
  await page.mouse.click(source.x, source.y);
  await page.mouse.click(target.x, target.y);
}
