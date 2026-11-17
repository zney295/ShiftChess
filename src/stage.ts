import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Color, Move, Piece, Square } from "chess.js";
import {
  boardMaterials,
  box,
  furniture,
  handModel,
  mesh,
  pieceModel,
  type Setting,
} from "./models";
import type { Shift } from "./rules";

const alphabet = "abcdefgh";
const squareAt = (x: number, z: number) => (alphabet[x] + (8 - z)) as Square;
const point = (s: Square) =>
  new T.Vector3(alphabet.indexOf(s[0]) - 3.5, 0.004, 4.5 - Number(s[1]));
const smooth = (x: number) => x * x * (3 - 2 * x);
const flip = (side: Color) => (side === "w" ? 1 : -1);
type Board = (({ square: Square } & Piece) | null)[][];
type Tween = {
  duration: number;
  start: number;
  render: (progress: number) => void;
  end: () => void;
};

export class Stage {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(47, 1, 0.1, 80);
  private readonly aim = new T.Vector3();
  private readonly destination = new T.Vector3();
  private readonly target = new T.Vector3();
  private readonly light = new T.DirectionalLight("#fff0d8", 3.15);
  private readonly sky = new T.HemisphereLight("#d6e8f5", "#5a493d", 0.79);
  private readonly rim = new T.DirectionalLight("#c7dcff", 0.73);
  private readonly meshes = new Map<Square, T.Group>();
  private legalTargets = new Set<Square>();
  private inputEnabled = true;
  private activeSide: Color = "w";
  private readonly hoverMarker = new T.Mesh(
    new T.RingGeometry(0.33, 0.39, 40),
    new T.MeshBasicMaterial({
      color: "#a9efda",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  private readonly dots = new T.Group();
  private readonly markers = new Map<Square, T.Mesh>();
  private readonly models = new Map<string, T.Group>();
  private readonly links = new T.Group();
  private readonly props = new Map<Setting, T.Group>();
  private readonly hands = { w: handModel("w"), b: handModel("b") };
  private readonly raycaster = new T.Raycaster();
  private readonly pointer = new T.Vector2();
  private readonly groundPlane = new T.Plane(new T.Vector3(0, 1, 0), -0.012);
  private readonly markGeometry = new T.PlaneGeometry(0.89, 0.89);
  private readonly moveMarker = new T.MeshBasicMaterial({
    color: "#d8d28d",
    transparent: true,
    opacity: 0.47,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly shiftMarkers = [
    new T.MeshBasicMaterial({
      color: "#65f1d8",
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    new T.MeshBasicMaterial({
      color: "#e5a3ff",
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  ];
  private readonly selectMarker = new T.MeshBasicMaterial({
    color: "#ffcf7e",
    transparent: true,
    opacity: 0.69,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly checkMarker = new T.MeshBasicMaterial({
    color: "#ff5d52",
    transparent: true,
    opacity: 0.59,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly linkMaterials = this.shiftMarkers.map(
    (surface) =>
      new T.LineBasicMaterial({
        color: surface.color,
        transparent: true,
        opacity: 0.69,
      }),
  );
  private readonly tileMaterials = {
    park: boardMaterials("park"),
    library: boardMaterials("library"),
  };
  private readonly tiles: T.Mesh[] = [];
  private tween?: Tween;
  private setting?: Setting;
  private cameraFrame: { side: Color; chosen?: Square; overhead: boolean } = {
    side: "w",
    overhead: true,
  };
  private time = 0;
  private lastDraw = 0;
  private needsRender = true;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  onSquare?: (square: Square) => void;

  constructor(host: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    const studio = new RoomEnvironment();
    const probe = new T.PMREMGenerator(this.renderer);
    this.scene.environment = probe.fromScene(studio, 0.06, 0.1, 100, {
      size: 128,
    }).texture;
    studio.dispose();
    probe.dispose();
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-label", "Bàn cờ 3D");
    host.append(this.canvas);
    this.scene.add(this.sky, this.light, this.rim, this.links);
    this.hoverMarker.rotation.x = -Math.PI / 2;
    this.hoverMarker.visible = false;
    this.scene.add(this.hoverMarker, this.dots);
    this.light.position.set(-4.5, 10.5, 5);
    this.rim.position.set(4, 5, -6);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    Object.assign(this.light.shadow.camera, {
      left: -6.4,
      right: 6.4,
      top: 6.4,
      bottom: -6.4,
      near: 0.8,
      far: 23,
    });
    this.light.shadow.radius = 2;
    this.light.shadow.normalBias = 0.018;
    this.light.shadow.bias = -0.00017;
    for (let z = 0; z < 8; z++)
      for (let x = 0; x < 8; x++) {
        const tile = box(
          0.997,
          0.08,
          0.997,
          this.tileMaterials.park[(x + z) % 2],
          x - 3.5,
          -0.04,
          z - 3.5,
        );
        const uv = tile.geometry.getAttribute("uv");
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(
            i,
            uv.getX(i) + x * 0.69 + z * 0.29,
            uv.getY(i) + z * 0.55 + x * 0.22,
          );
        }
        tile.castShadow = false;
        this.tiles.push(tile);
        this.scene.add(tile);
        const marker = mesh(
          this.markGeometry,
          this.moveMarker,
          x - 3.5,
          0.004,
          z - 3.5,
        );
        marker.rotation.x = -Math.PI / 2;
        marker.castShadow = marker.receiveShadow = marker.visible = false;
        this.markers.set(squareAt(x, z), marker);
        this.scene.add(marker);
      }
    for (let i = 0; i < 8; i++) {
      this.label(alphabet[i], i - 3.5, 4.13, 0);
      this.label(alphabet[i], i - 3.5, -4.13, Math.PI);
      this.label(String(8 - i), -4.12, i - 3.5, 0);
      this.label(String(8 - i), 4.12, i - 3.5, Math.PI);
    }
    this.canvas.addEventListener("click", (event) => {
      if (!this.inputEnabled) return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const onBoard = this.raycaster.ray.intersectPlane(
        this.groundPlane,
        new T.Vector3(),
      );
      const tile =
        onBoard && Math.abs(onBoard.x) < 4 && Math.abs(onBoard.z) < 4
          ? squareAt(Math.floor(onBoard.x + 4), Math.floor(onBoard.z + 4))
          : undefined;
      const piece = this.raycaster.intersectObjects(
        [...this.meshes.values()],
        true,
      )[0];
      let pieceSquare: Square | undefined;
      if (piece) {
        let root = piece.object;
        while (root.parent && root.parent !== this.scene) root = root.parent;
        pieceSquare = [...this.meshes].find(([, model]) => root === model)?.[0];
      }
      // Exact visible geometry wins over a floor square projected behind it.
      // Forgiving bounds only apply when neither geometry nor a legal tile was hit.
      let nearby: Square | undefined;
      if (!pieceSquare && !(tile && this.legalTargets.has(tile))) {
        let closest = Infinity;
        for (const [square, model] of this.meshes) {
          const bounds = new T.Box3()
            .setFromObject(model)
            .expandByScalar(0.055);
          const hit = this.raycaster.ray.intersectBox(bounds, new T.Vector3());
          if (hit) {
            const distance = hit.distanceToSquared(this.camera.position);
            if (distance < closest) {
              closest = distance;
              nearby = square;
            }
          }
        }
      }
      const picked =
        pieceSquare ??
        (tile && this.legalTargets.has(tile) ? tile : (nearby ?? tile));
      if (picked) this.onSquare?.(picked);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.inputEnabled || this.tween) return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(
        [...this.meshes.values()],
        true,
      )[0];
      let square: Square | undefined;
      if (hit) {
        let root = hit.object;
        while (root.parent && root.parent !== this.scene) root = root.parent;
        square = [...this.meshes].find(([, model]) => model === root)?.[0];
      }
      if (!square) {
        const p = this.raycaster.ray.intersectPlane(
          this.groundPlane,
          new T.Vector3(),
        );
        if (p && Math.abs(p.x) < 4 && Math.abs(p.z) < 4)
          square = squareAt(Math.floor(p.x + 4), Math.floor(p.z + 4));
      }
      const piece = square && this.meshes.get(square);
      const valid = Boolean(
        square &&
        (this.legalTargets.has(square) ||
          piece?.userData.color === this.activeSide),
      );
      this.hoverMarker.visible = valid;
      if (valid && square) {
        this.hoverMarker.position.copy(point(square));
        this.hoverMarker.position.y = 0.035;
      }
      this.canvas.style.cursor = valid ? "pointer" : "default";
      this.needsRender = true;
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hoverMarker.visible = false;
      this.needsRender = true;
    });
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.fov = w / h < 1.1 ? 55 : 47;
      this.camera.updateProjectionMatrix();
      if (!this.tween) {
        const { side, chosen, overhead } = this.cameraFrame;
        this.frame(side, chosen, overhead, true);
      }
      this.needsRender = true;
    };
    new ResizeObserver(resize).observe(host);
    resize();
    this.setSetting("park");
    this.frame("w", undefined, true, true);
    this.renderer.setAnimationLoop((ms) => this.tick(ms));
  }

  private label(value: string, x: number, z: number, angle: number) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const c = canvas.getContext("2d")!;
    c.font = "bold 44px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#f5d4a7";
    c.fillText(value, 32, 33);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const item = new T.Mesh(
      new T.PlaneGeometry(0.23, 0.23),
      new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    item.position.set(x, 0.013, z);
    item.rotation.set(-Math.PI / 2, 0, angle);
    this.scene.add(item);
  }

  setSetting(setting: Setting) {
    if (setting === this.setting) return;
    if (this.setting) this.scene.remove(this.props.get(this.setting)!);
    if (!this.props.has(setting)) this.props.set(setting, furniture(setting));
    this.setting = setting;
    this.scene.add(this.props.get(setting)!);
    const park = setting === "park";
    const color = park ? "#a2b9ad" : "#5a483c";
    this.scene.background = new T.Color(color);
    this.scene.fog = new T.FogExp2(color, park ? 0.022 : 0.015);
    this.light.color.set(park ? "#fff1da" : "#ffdfb4");
    this.light.intensity = park ? 2.75 : 2.52;
    this.sky.intensity = park ? 0.74 : 0.56;
    this.rim.intensity = park ? 0.64 : 0.85;
    this.scene.environmentIntensity = park ? 0.43 : 0.39;
    this.renderer.toneMappingExposure = park ? 0.95 : 1;
    this.tiles.forEach(
      (tile, i) =>
        (tile.material =
          this.tileMaterials[setting][(i + Math.floor(i / 8)) % 2]),
    );
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  sync(board: Board) {
    for (const object of this.meshes.values()) this.scene.remove(object);
    this.meshes.clear();
    for (const cell of board.flat()) {
      if (!cell) continue;
      const key = cell.color + cell.type;
      if (!this.models.has(key))
        this.models.set(key, pieceModel(cell.type, cell.color));
      const model = this.models.get(key)!.clone();
      model.userData.color = cell.color;
      model.position.copy(point(cell.square));
      this.scene.add(model);
      this.meshes.set(cell.square, model);
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  indicate(
    shift: Shift | null,
    chosen?: Square,
    legal: Square[] = [],
    checked?: Square,
  ) {
    this.legalTargets = new Set(legal);
    while (this.dots.children.length) {
      const dot = this.dots.children[0] as T.Mesh;
      this.dots.remove(dot);
      dot.geometry.dispose();
      (dot.material as T.Material).dispose();
    }
    for (const square of legal) {
      const capture = this.meshes.has(square);
      const dot = new T.Mesh(
        capture
          ? new T.RingGeometry(0.39, 0.46, 32)
          : new T.CircleGeometry(0.12, 24),
        new T.MeshBasicMaterial({
          color: capture ? "#ff956d" : "#a9efda",
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.copy(point(square));
      dot.position.y = 0.045;
      this.dots.add(dot);
    }
    while (this.links.children.length) {
      const line = this.links.children[0] as T.Line;
      this.links.remove(line);
      line.geometry.dispose();
    }
    for (const [square, marker] of this.markers) {
      const index =
        shift?.pairs.findIndex((pair) => pair.includes(square)) ?? -1;
      marker.visible =
        index >= 0 ||
        square === chosen ||
        legal.includes(square) ||
        square === checked;
      marker.material =
        square === checked
          ? this.checkMarker
          : square === chosen
            ? this.selectMarker
            : index >= 0
              ? this.shiftMarkers[index]
              : this.moveMarker;
    }
    shift?.pairs.forEach(([a, b], index) => {
      const from = point(a),
        to = point(b);
      const mid = from.clone().lerp(to, 0.5);
      from.y = to.y = 0.11;
      mid.y = 0.69;
      const curve = new T.QuadraticBezierCurve3(from, mid, to);
      this.links.add(
        new T.Line(
          new T.BufferGeometry().setFromPoints(curve.getPoints(26)),
          this.linkMaterials[index],
        ),
      );
    });
    this.needsRender = true;
  }

  frame(side: Color, chosen?: Square, overhead = false, immediate = false) {
    this.cameraFrame = { side, chosen, overhead };
    const dir = flip(side);
    const narrow = this.camera.aspect < 1.1;
    if (overhead) {
      const distance = Math.max(1, 0.98 / this.camera.aspect);
      this.destination.set(0, 10.1 * distance, dir * 8.55 * distance);
      this.target.set(0, 0.04, 0);
    } else if (chosen) {
      this.follow(side, point(chosen));
    } else {
      const distance = Math.max(1, 0.85 / this.camera.aspect);
      // Show the heads of the pawns above the taller back rank before a piece is picked.
      this.destination.set(
        0,
        (narrow ? 7.4 : 5.9) * distance,
        dir * (narrow ? 10.8 : 8.65) * distance,
      );
      this.target.set(0, 0.26, 0);
    }
    if (immediate) {
      this.camera.position.copy(this.destination);
      this.aim.copy(this.target);
      this.camera.lookAt(this.aim);
    }
    this.needsRender = true;
  }

  setInteraction(enabled: boolean, side: Color = "w") {
    this.inputEnabled = enabled;
    this.activeSide = side;
    if (!enabled) this.hoverMarker.visible = false;
  }

  quality(high: boolean) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1));
    this.renderer.shadowMap.enabled = high;
    const size = this.canvas.getBoundingClientRect();
    this.renderer.setSize(size.width, size.height, false);
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  private follow(side: Color, location: T.Vector3) {
    const dir = flip(side);
    this.destination.set(
      location.x * 0.93,
      location.y + 2.05,
      location.z + dir * 2.8,
    );
    this.target.set(
      location.x * 0.73,
      location.y + 0.25,
      location.z - dir * 2.05,
    );
  }

  private animate(duration: number, render: Tween["render"]) {
    return new Promise<void>((resolve) => {
      this.tween = {
        duration: this.reduced ? duration * 0.32 : duration,
        start: performance.now(),
        render,
        end: resolve,
      };
    });
  }

  async move(move: Move, overhead: boolean, impact: () => void) {
    const object = this.meshes.get(move.from);
    if (!object) return;
    const from = point(move.from),
      to = point(move.to);
    const capturedSquare = move.isEnPassant()
      ? ((move.to[0] + move.from[1]) as Square)
      : move.to;
    const enemy = move.captured ? this.meshes.get(capturedSquare) : undefined;
    const enemyOrigin = enemy?.position.clone();
    const hand = this.hands[move.color];
    let struck = false;
    if (enemy) {
      this.scene.add(hand);
      hand.rotation.y = move.color === "w" ? 0 : Math.PI;
    }
    const direction = flip(move.color);
    const hop = move.piece === "n" ? 0.59 : 0.21;
    await this.animate(enemy ? 880 : 355, (p) => {
      const step = enemy
        ? smooth(T.MathUtils.clamp((p - 0.18) / 0.54, 0, 1))
        : smooth(p);
      object.position.lerpVectors(from, to, step);
      object.position.y += Math.sin(Math.PI * step) * (enemy ? 0.39 : hop);
      if (enemy && enemyOrigin) {
        hand.position.copy(object.position);
        hand.position.z +=
          direction * (Math.max(0, 0.2 - p) * 20 + Math.max(0, p - 0.78) * 20);
        hand.position.y += Math.max(0, 0.2 - p) * 3 + Math.max(0, p - 0.78) * 5;
        if (p >= 0.69) {
          if (!struck) {
            struck = true;
            impact();
          }
          const k = smooth(T.MathUtils.clamp((p - 0.69) / 0.29, 0, 1));
          enemy.position.copy(enemyOrigin);
          enemy.position.x += (to.x < 0 ? -1 : 1) * k * 2.2;
          enemy.position.z -= direction * k * 0.77;
          enemy.position.y += Math.sin(Math.PI * k) * 0.32 - k * 0.4;
          enemy.rotation.z = (to.x < 0 ? 1 : -1) * k * 1.46;
        }
      }
      if (!overhead) {
        this.follow(move.color, object.position);
        if (enemy) {
          this.destination.y += 0.78;
          this.destination.z += direction * 0.7;
        }
      }
    });
    if (enemy) this.scene.remove(hand);
    if (!struck) impact();
  }

  async shift(event: Shift) {
    const motions: {
      object: T.Group;
      from: T.Vector3;
      to: T.Vector3;
      curve: number;
    }[] = [];
    event.pairs.forEach(([a, b]) => {
      const first = this.meshes.get(a),
        second = this.meshes.get(b);
      if (event.effect === "slide" && Boolean(first) === Boolean(second))
        return;
      if (first)
        motions.push({ object: first, from: point(a), to: point(b), curve: 1 });
      if (second)
        motions.push({
          object: second,
          from: point(b),
          to: point(a),
          curve: 1,
        });
    });
    await this.animate(event.pairs.length > 1 ? 950 : 710, (p) => {
      const k = smooth(p);
      for (const { object, from, to, curve } of motions) {
        object.position.lerpVectors(from, to, k);
        object.position.y += Math.sin(Math.PI * k) * 1.12;
        const angle = Math.atan2(to.z - from.z, to.x - from.x);
        object.position.x -=
          Math.sin(angle) * Math.sin(Math.PI * k) * curve * 0.44;
        object.position.z +=
          Math.cos(angle) * Math.sin(Math.PI * k) * curve * 0.44;
        object.rotation.y = Math.sin(Math.PI * k) * 0.36;
      }
    });
  }

  private tick(ms: number) {
    if (this.tween) {
      const progress = T.MathUtils.clamp(
        (ms - this.tween.start) / this.tween.duration,
        0,
        1,
      );
      this.tween.render(progress);
      this.renderer.shadowMap.needsUpdate = true;
      this.needsRender = true;
      if (progress === 1) {
        const { end } = this.tween;
        this.tween = undefined;
        end();
      }
    }
    const dt = Math.min((ms - this.time) / 1000, 0.08);
    this.time = ms;
    const cameraMoving =
      this.camera.position.distanceToSquared(this.destination) > 0.000001 ||
      this.aim.distanceToSquared(this.target) > 0.000001;
    if (cameraMoving) {
      const damping = this.reduced ? 1 : 1 - Math.exp(-9 * dt);
      this.camera.position.lerp(this.destination, damping);
      this.aim.lerp(this.target, damping);
      this.camera.lookAt(this.aim);
    }
    const pulse =
      !this.reduced &&
      this.links.children.length > 0 &&
      ms - this.lastDraw >= 45;
    if (!this.needsRender && !cameraMoving && !pulse) return;
    this.shiftMarkers.forEach(
      (surface, i) =>
        (surface.opacity =
          0.51 + (this.reduced ? 0 : 0.13 * Math.sin(ms / 250 + i))),
    );
    this.renderer.render(this.scene, this.camera);
    this.lastDraw = ms;
    this.needsRender = false;
  }
}
