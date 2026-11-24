import * as T from "three";
import type { Color } from "chess.js";
import { tabletopSize } from "./models";

const flip = (side: Color) => (side === "w" ? 1 : -1);
const smooth = (x: number) => x * x * (3 - 2 * x);

export type CameraShot = {
  from: [number, number, number];
  to: [number, number, number];
  target: [number, number, number];
  duration: number;
};
type CameraLayout = {
  height: number;
  hudTop: number;
  side: Color;
  overhead: boolean;
  presentation: boolean;
  shakeUntil: number;
  facingAngle?: number;
};

function corners(halfWidth: number, bottom: number, top: number, halfDepth: number) {
  return [-halfWidth, halfWidth].flatMap(x => [bottom, top].flatMap(y =>
    [-halfDepth, halfDepth].map(z => new T.Vector3(x, y - 0.08, z))));
}

const framingPoints = [
  ...corners(tabletopSize.width / 2, tabletopSize.y - tabletopSize.height / 2,
    tabletopSize.y + tabletopSize.height / 2, tabletopSize.depth / 2),
  ...corners(3.93, 0, 1.55, 3.93),
];

export class StageCamera {
  playPitch = 45;
  readonly camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
  readonly flatCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  readonly cameraTarget = new T.Vector3(0, 0.08, 0);
  shot?: CameraShot & { start: number; origin: T.Vector3; destination: T.Vector3 };

  setShot(shot?: CameraShot) {
    this.shot = shot && {
      ...shot,
      start: performance.now(),
      origin: new T.Vector3(...shot.from),
      destination: new T.Vector3(...shot.to),
    };
  }

  place(ms: number, reduced: boolean, layout: CameraLayout) {
    const aspect = this.camera.aspect;
    const viewport = layout.height;
    const angle = layout.facingAngle ?? (layout.side === "w" ? 0 : Math.PI);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const facing = flip(layout.side);
    const topInset = layout.hudTop + 12;
    const bottomInset = layout.overhead ? 14 : 30;
    if (layout.overhead) {
      const halfHeight = Math.max(
        (tabletopSize.width / 2 + 0.16) / aspect,
        tabletopSize.depth / 2 * viewport / Math.max(120, viewport - topInset - bottomInset),
      );
      const halfWidth = halfHeight * aspect;
      Object.assign(this.flatCamera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight });
      const shiftOffset = halfHeight * (topInset - bottomInset) / viewport;
      this.cameraTarget.set(-sinA * shiftOffset, 0, -cosA * shiftOffset);
      this.flatCamera.position.copy(this.cameraTarget).setY(20);
      this.flatCamera.up.set(-sinA, 0, -cosA);
      this.flatCamera.lookAt(this.cameraTarget);
      this.flatCamera.updateProjectionMatrix();
      this.flatCamera.updateMatrixWorld();
      return;
    }

    if (layout.presentation) {
      const width = Math.round(aspect * viewport);
      const compact = width <= 660 || aspect <= 1;
      const view = this.camera.view;
      if (!view?.enabled || view.width !== width || view.height !== viewport) {
        // Compose the action beside the menu or above it on narrow screens.
        this.camera.setViewOffset(width, viewport,
          compact ? 0 : -width * 0.19, compact ? viewport * 0.19 : 0, width, viewport);
      }
      if (this.shot) {
        const { origin, destination, target, start, duration } = this.shot;
        const t = reduced ? 0 : smooth(T.MathUtils.clamp((ms - start) / duration, 0, 1));
        const distanceScale = compact ? Math.max(1.08, 0.98 / aspect) : Math.max(1.12, 1.52 / aspect);
        this.cameraTarget.set(...target);
        this.camera.position.lerpVectors(origin, destination, t)
          .sub(this.cameraTarget).multiplyScalar(distanceScale).add(this.cameraTarget);
      } else {
        const distance = Math.max(15.5, 14.8 / aspect);
        this.cameraTarget.set(0, 0.22, 0);
        this.camera.position.set(0, distance * 0.82, distance * 0.57).add(this.cameraTarget);
      }
      this.settleCamera(ms, layout.shakeUntil);
      return;
    }

    const pitch = T.MathUtils.degToRad(this.playPitch);
    const height = Math.sin(pitch);
    const depth = Math.cos(pitch);

    const top = 1 - 2 * topInset / viewport;
    const bottom = Math.min(top - 0.08, -1 + 2 * bottomInset / viewport);
    const tangent = Math.tan(T.MathUtils.degToRad(this.camera.fov / 2));
    let lowerLift = -Infinity;
    let upperLift = Infinity;
    let distance = 0;
    // Fit the tabletop and the tallest pieces inside the available play area.
    for (const corner of framingPoints) {
      const towardCamera = corner.y * height + corner.z * facing * depth;
      const up = corner.y * depth - corner.z * facing * height;
      lowerLift = Math.max(lowerLift, up + towardCamera * top * tangent);
      upperLift = Math.min(upperLift, up + towardCamera * bottom * tangent);
      distance = Math.max(distance, towardCamera + Math.abs(corner.x) / (0.97 * aspect * tangent));
    }
    distance = Math.max(distance, (lowerLift - upperLift) / ((top - bottom) * tangent));
    distance *= 1.07;
    const lift = (lowerLift + upperLift - distance * (top + bottom) * tangent) / 2;
    this.cameraTarget.set(-sinA * lift * height, 0.08 + lift * depth, -cosA * lift * height);
    this.camera.position.set(sinA * distance * depth, distance * height, cosA * distance * depth).add(this.cameraTarget);
    this.settleCamera(ms, layout.shakeUntil);
  }

  private settleCamera(ms: number, shakeUntil: number) {
    if (ms < shakeUntil) {
      const strength = (shakeUntil - ms) / 160 * 0.055;
      this.camera.position.y += Math.sin(ms * 0.15) * strength;
    }
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  }
}
