import * as T from "three";
import type { Color, Move, Piece, Square } from "chess.js";
import { box, mesh, pieceModel, type Setting } from "./models";
import { movesShiftPair, type Shift } from "./rules";

const alphabet = "abcdefgh";
const boardHeight = 0.004;
const squareAt = (x: number, z: number) => (alphabet[x] + (8 - z)) as Square;
const point = (s: Square) =>
  new T.Vector3(alphabet.indexOf(s[0]) - 3.5, boardHeight, 4.5 - Number(s[1]));
const smooth = (x: number) => x * x * (3 - 2 * x);
const flip = (side: Color) => (side === "w" ? 1 : -1);
type Board = (({ square: Square } & Piece) | null)[][];
type PieceMesh = T.Group & { userData: Piece & { square: Square } };
type Animation = {
  duration: number;
  start: number;
  render: (progress: number) => void;
};
type Tween = Animation & { end: (completed: boolean) => void };
type AppliedShift = { event: Shift; pairs: ReadonlySet<number> };

export class Stage {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.OrthographicCamera(-5, 5, 5, -5, 0.1, 40);
  private readonly light = new T.DirectionalLight("#fff5e4", 1.7);
  private readonly sky = new T.HemisphereLight("#f3f7ff", "#b3aaa2", 1.6);
  private readonly rim = new T.DirectionalLight("#d9e6ff", 1.18);
  private readonly meshes = new Map<Square, PieceMesh>();
  private readonly pieceLayer = new T.Group();
  private readonly legalTargets = new Set<Square>();
  private inputEnabled = true;
  private activeSide: Color = "w";
  private readonly hoverMarker = new T.Mesh(
    new T.RingGeometry(0.33, 0.39, 40),
    new T.MeshBasicMaterial({
      color: "#17241e",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  private readonly dots = new T.Group();
  private readonly legalDots = new Map<Square, T.Mesh>();
  private readonly dotGeometry = new T.CircleGeometry(0.12, 24);
  private readonly captureGeometry = new T.RingGeometry(0.39, 0.46, 32);
  private readonly dotMaterial = new T.MeshBasicMaterial({
    color: "#203930",
    transparent: true,
    opacity: 0.64,
    toneMapped: false,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly captureMaterial = this.dotMaterial.clone();
  private readonly markers = new Map<Square, T.Mesh>();
  private readonly models = new Map<
    string,
    { template: T.Group; pool: PieceMesh[] }
  >();
  private readonly links = new T.Group();
  private readonly labels = { w: new T.Group(), b: new T.Group() };
  private linkKey = "";
  private recentShift?: AppliedShift;
  private shifting = false;
  private readonly raycaster = new T.Raycaster();
  private readonly pointer = new T.Vector2();
  private readonly hitPoint = new T.Vector3();
  private readonly groundPlane = new T.Plane(new T.Vector3(0, 1, 0), -boardHeight);
  private readonly dragPlane = new T.Plane(new T.Vector3(0, 1, 0), -0.34);
  private drag?: { id: number; x: number; y: number; piece?: PieceMesh; active: boolean };
  private dropped?: { from: Square; to: Square };
  private readonly markGeometry = new T.PlaneGeometry(1, 1);
  private readonly moveMarker = new T.MeshBasicMaterial({
    color: "#e9c251",
    transparent: true,
    opacity: 0.47,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly shiftMarkers = [
    new T.MeshBasicMaterial({
      color: "#139de0",
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    new T.MeshBasicMaterial({
      color: "#925beb",
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  ];
  private readonly selectMarker = new T.MeshBasicMaterial({
    color: "#f2cb62",
    transparent: true,
    opacity: 0.69,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly checkMarker = new T.MeshBasicMaterial({
    color: "#e44444",
    transparent: true,
    opacity: 0.59,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly linkMaterials = this.shiftMarkers.map(
    (surface) =>
      new T.MeshBasicMaterial({
        color: surface.color,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
        side: T.DoubleSide,
        toneMapped: false,
      }),
  );
  private readonly shiftEffects = this.shiftMarkers.map(({ color }) => {
    const geometry = new T.RingGeometry(0.41, 0.48, 48);
    const material = new T.MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      toneMapped: false,
    });
    const rings = [new T.Mesh(geometry, material), new T.Mesh(geometry, material)];
    rings.forEach((ring) => {
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
    });
    return rings;
  });
  private readonly tileMaterials = [
    new T.MeshStandardMaterial({ roughness: 0.92 }),
    new T.MeshStandardMaterial({ roughness: 0.92 }),
  ];
  private readonly badgeGeometry = new T.PlaneGeometry(1, 1);
  private readonly pairBadges = [this.pairBadge("A", "#167ab0"), this.pairBadge("B", "#7441bc")];
  private arrival?: Animation;
  private tween?: Tween;
  private side: Color = "w";
  private needsRender = true;
  private readonly motion = matchMedia("(prefers-reduced-motion: reduce)");
  onSquare?: (square: Square, keepSelected?: boolean) => void;

  constructor(host: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = T.NeutralToneMapping;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-label", "Bàn cờ 3D");
    host.append(this.canvas);
    this.scene.add(this.sky, this.light, this.rim, this.links, this.pieceLayer);
    this.scene.add(this.labels.w, this.labels.b);
    this.scene.add(...this.shiftEffects.flat());
    this.captureMaterial.color.set("#9c2e28");
    this.hoverMarker.rotation.x = -Math.PI / 2;
    this.hoverMarker.visible = false;
    this.scene.add(this.hoverMarker, this.dots);
    this.light.position.set(-2.8, 13, 3.5);
    this.rim.position.set(5, 6, -4);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
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
    const base = box(8.64, 0.27, 8.64, new T.MeshStandardMaterial({
      color: "#273734", roughness: 0.78,
    }), 0, -0.22, 0);
    base.castShadow = false;
    this.scene.add(base);
    const tileGeometry = new T.BoxGeometry(1, 0.08, 1);
    const tiles = this.tileMaterials.map((surface) => {
      const tile = new T.InstancedMesh(tileGeometry, surface, 32);
      tile.receiveShadow = true;
      this.scene.add(tile);
      return tile;
    });
    const matrix = new T.Matrix4();
    for (let z = 0; z < 8; z++)
      for (let x = 0; x < 8; x++) {
        tiles[(x + z) % 2].setMatrixAt(
          z * 4 + Math.floor(x / 2),
          matrix.makeTranslation(x - 3.5, -0.04, z - 3.5),
        );
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
      this.labels.w.add(
        this.label(alphabet[i], i - 3.5, 4.13, 0),
        this.label(String(8 - i), -4.12, i - 3.5, 0),
      );
      this.labels.b.add(
        this.label(alphabet[i], i - 3.5, -4.13, Math.PI),
        this.label(String(8 - i), 4.12, i - 3.5, Math.PI),
      );
    }
    this.canvas.addEventListener("pointerdown", (event) => this.press(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointAt(event));
    this.canvas.addEventListener("pointerup", (event) => this.drop(event));
    const cancelPointer = (event: PointerEvent) => {
      if (event.pointerId === this.drag?.id) this.cancelDrag();
    };
    this.canvas.addEventListener("pointercancel", cancelPointer);
    this.canvas.addEventListener("lostpointercapture", cancelPointer);
    this.canvas.addEventListener("pointerleave", () => this.clearHover());
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      const aspect = w / h;
      const height = Math.max(9.05, 9.15 / aspect);
      this.camera.top = height / 2;
      this.camera.bottom = -height / 2;
      this.camera.right = (height * aspect) / 2;
      this.camera.left = -this.camera.right;
      this.camera.updateProjectionMatrix();
      this.needsRender = true;
    };
    new ResizeObserver(resize).observe(host);
    resize();
    this.setSetting("park");
    this.frame("w");
    this.renderer.setAnimationLoop((ms) => this.tick(ms));
  }

  private aimPointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private press(event: PointerEvent) {
    if (!this.inputEnabled || this.drag || event.button !== 0) return;
    this.dropped = undefined;
    this.finishArrival();
    this.scene.updateMatrixWorld(true);
    this.aimPointer(event);
    const square = this.hitPiece() ?? this.floorSquare();
    const piece = square ? this.meshes.get(square) : undefined;
    this.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      piece: piece?.userData.color === this.activeSide ? piece : undefined,
      active: false,
    };
    this.canvas.setPointerCapture(event.pointerId);
  }

  private pointAt(event: PointerEvent) {
    if (!this.inputEnabled) return;
    const drag = this.drag;
    if (drag && drag.id !== event.pointerId) return;
    this.aimPointer(event);
    if (drag?.piece && !drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 7) {
      drag.active = true;
      this.clearHover();
      this.onSquare?.(drag.piece.userData.square, true);
      this.canvas.style.cursor = "grabbing";
    }
    if (drag?.active && drag.piece) {
      const target = this.floorSquare();
      const legal = target && this.legalTargets.has(target) ? target : undefined;
      this.showHover(legal);
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.hitPoint)) {
        drag.piece.position.copy(this.hitPoint);
        this.renderer.shadowMap.needsUpdate = true;
        this.needsRender = true;
      }
      return;
    }
    if (event.pointerType === "touch") return;
    const square = this.hitPiece() ?? this.floorSquare();
    const piece = square && this.meshes.get(square);
    const movable = piece && piece.userData.color === this.activeSide;
    const hover = square && (movable || this.legalTargets.has(square)) ? square : undefined;
    this.showHover(hover);
    this.canvas.style.cursor = movable ? "grab" : hover ? "pointer" : "default";
  }

  private drop(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    this.aimPointer(event);
    const tile = this.floorSquare();
    if (drag.active && drag.piece) {
      const from = drag.piece.userData.square;
      this.cancelDrag();
      if (tile && this.legalTargets.has(tile)) {
        this.dropped = { from, to: tile };
        this.onSquare?.(tile);
      }
      return;
    }
    this.cancelDrag();
    const square = this.hitPiece() ?? tile;
    if (square) this.onSquare?.(square);
  }

  private cancelDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    if (drag.active && drag.piece) {
      this.place(drag.piece.userData.square, drag.piece);
      this.renderer.shadowMap.needsUpdate = true;
      this.clearHover();
      this.needsRender = true;
    }
    if (this.canvas.hasPointerCapture(drag.id)) this.canvas.releasePointerCapture(drag.id);
  }

  private floorSquare() {
    const p = this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint);
    if (p && Math.abs(p.x) < 4 && Math.abs(p.z) < 4)
      return squareAt(Math.floor(p.x + 4), Math.floor(p.z + 4));
  }

  private hitPiece(): Square | undefined {
    const hit = this.raycaster.intersectObjects(this.pieceLayer.children, true)[0];
    if (!hit) return;
    let root = hit.object;
    while (root.parent && root.parent !== this.pieceLayer) root = root.parent;
    return root.userData.square;
  }

  private showHover(square?: Square) {
    if (square === this.hoverMarker.userData.square) return;
    this.hoverMarker.userData.square = square;
    this.hoverMarker.visible = Boolean(square);
    if (square) this.hoverMarker.position.copy(point(square)).setY(0.019);
    this.needsRender = true;
  }

  private clearHover() {
    this.showHover();
    this.canvas.style.cursor = "default";
  }

  private label(value: string, x: number, z: number, angle: number) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const c = canvas.getContext("2d")!;
    c.font = "bold 44px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#eee2cb";
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
    return item;
  }

  private pairBadge(letter: string, color: string) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, 118, 118);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(89, 0, 39, 39, [0, 0, 0, 8]);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 27px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 108, 20);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({
      map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
  }

  setSetting(setting: Setting) {
    const [light, dark] = setting === "park"
      ? ["#eee5d3", "#60766b"]
      : ["#efe4d2", "#667383"];
    this.tileMaterials[0].color.set(light);
    this.tileMaterials[1].color.set(dark);
    this.needsRender = true;
  }

  sync(board: Board) {
    let changed = false;
    for (const [square, object] of this.meshes) {
      const cell = board[8 - Number(square[1])][alphabet.indexOf(square[0])];
      if (cell?.color === object.userData.color && cell.type === object.userData.type)
        continue;
      this.finishArrival();
      this.release(square, object);
      changed = true;
    }
    for (const row of board) {
      for (const cell of row) {
        if (!cell || this.meshes.has(cell.square)) continue;
        this.finishArrival();
        const { color, type, square } = cell;
        const key = color + type;
        let models = this.models.get(key);
        if (!models) {
          models = { template: pieceModel(type, color), pool: [] };
          this.models.set(key, models);
        }
        const object = models.pool.pop() ?? Object.assign(models.template.clone(), {
          userData: { color, type, square },
        });
        this.pieceLayer.add(object);
        this.place(square, object);
        changed = true;
      }
    }
    if (changed) {
      this.renderer.shadowMap.needsUpdate = true;
      this.needsRender = true;
    }
  }

  private place(square: Square, object: PieceMesh) {
    object.position.copy(point(square));
    object.rotation.set(0, 0, 0);
    object.userData.square = square;
    this.meshes.set(square, object);
  }

  private release(square: Square, object: PieceMesh) {
    this.meshes.delete(square);
    this.pieceLayer.remove(object);
    this.models.get(object.userData.color + object.userData.type)!.pool.push(object);
  }

  revealPieces() {
    if (this.motion.matches || this.arrival || this.tween || !this.meshes.size)
      return;
    const arrivals = Array.from(this.meshes.values(), (object) => ({
      object,
      scale: object.scale.clone(),
      delay:
        (Math.abs(object.position.x) - 0.5) * 38 +
        (3.5 - Math.abs(object.position.z)) * 30,
    }));
    const duration = 540;
    const render = (progress: number) => {
      for (const { object, scale, delay } of arrivals) {
        const t = T.MathUtils.clamp((progress * duration - delay) / 350, 0, 1);
        const pop = T.MathUtils.smoothstep(t, 0, 0.72);
        const settle = T.MathUtils.smoothstep(t, 0.72, 1);
        const size = 1 - 0.42 * (1 - pop) + 0.05 * (pop - settle);
        object.scale.copy(scale).multiplyScalar(size);
        object.position.y = boardHeight + 0.38 * (1 - smooth(t));
      }
    };
    this.arrival = { duration, start: performance.now(), render };
    render(0);
  }

  private finishArrival() {
    if (!this.arrival) return;
    this.arrival.render(1);
    this.arrival = undefined;
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  indicate(
    shift: Shift | null,
    chosen?: Square,
    legal: Square[] = [],
    checked?: Square,
    lastMove?: Move,
    showRecent = false,
  ) {
    if (this.shifting) return;
    const recent = showRecent ? this.recentShift : undefined;
    const displayed = shift ?? recent?.event;
    const pairs = shift ? undefined : recent?.pairs;
    if (!showRecent) this.recentShift = undefined;
    this.legalTargets.clear();
    for (const dot of this.legalDots.values()) dot.visible = false;
    for (const square of legal) {
      this.legalTargets.add(square);
      const capture = this.meshes.has(square);
      let dot = this.legalDots.get(square);
      if (!dot) {
        dot = new T.Mesh(this.dotGeometry, this.dotMaterial);
        dot.rotation.x = -Math.PI / 2;
        dot.position.copy(point(square)).setY(0.045);
        this.legalDots.set(square, dot);
        this.dots.add(dot);
      }
      dot.visible = true;
      dot.geometry = capture ? this.captureGeometry : this.dotGeometry;
      dot.material = capture ? this.captureMaterial : this.dotMaterial;
    }
    for (const [square, marker] of this.markers) {
      const index =
        displayed?.pairs.findIndex(
          (pair, index) => (!pairs || pairs.has(index)) && pair.includes(square),
        ) ?? -1;
      marker.visible =
        index >= 0 ||
        square === chosen ||
        square === lastMove?.from ||
        square === lastMove?.to ||
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
    this.needsRender = true;
    this.showShift(displayed, Boolean(shift), pairs);
  }

  private showShift(shift: Shift | undefined, arrows: boolean, pairs?: ReadonlySet<number>) {
    const linkKey = shift
      ? [this.side, shift.effect, arrows, ...shift.pairs.map((pair, index) =>
          (!pairs || pairs.has(index)) && [pair, ...pair.map((square) => this.meshes.has(square))].join(":"),
        )].join("|")
      : "";
    if (this.linkKey === linkKey) return;
    this.linkKey = linkKey;
    while (this.links.children.length) {
      const marker = this.links.children[0] as T.Mesh;
      this.links.remove(marker);
      if (marker.geometry !== this.badgeGeometry) marker.geometry.dispose();
    }
    shift?.pairs.forEach(([a, b], index) => {
      if (pairs && !pairs.has(index)) return;
      for (const square of [a, b]) {
        const badge = new T.Mesh(this.badgeGeometry, this.pairBadges[index]);
        badge.position.copy(point(square)).setY(0.026);
        badge.rotation.set(-Math.PI / 2, 0, this.side === "w" ? 0 : Math.PI);
        badge.renderOrder = 5;
        this.links.add(badge);
      }
      if (!arrows) return;
      const first = this.meshes.get(a);
      const second = this.meshes.get(b);
      if (!movesShiftPair(shift.effect, first?.userData, second?.userData)) return;
      const from = point(a).setY(0.042);
      const to = point(b).setY(0.042);
      const direction = to.clone().sub(from).normalize();
      const side = new T.Vector3(-direction.z, 0, direction.x);
      from.addScaledVector(direction, 0.23).addScaledVector(side, 0.25);
      to.addScaledVector(direction, -0.23).addScaledVector(side, 0.25);
      const points: number[] = [];
      const stroke = (start: T.Vector3, end: T.Vector3) => {
        const offset = new T.Vector3(start.z - end.z, 0, end.x - start.x)
          .normalize().multiplyScalar(0.023);
        const a = start.clone().add(offset);
        const b = start.clone().sub(offset);
        const c = end.clone().add(offset);
        const d = end.clone().sub(offset);
        for (const point of [a, b, c, c, b, d]) points.push(point.x, point.y, point.z);
      };
      stroke(from, to);
      const arrow = (end: T.Vector3, sign: number) => {
        for (const wing of [-1, 1]) {
          const tail = end.clone().addScaledVector(direction, -0.19 * sign)
            .addScaledVector(side, 0.11 * wing);
          stroke(end, tail);
        }
      };
      if (first) arrow(to, 1);
      if (second) arrow(from, -1);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(points, 3));
      const connector = new T.Mesh(geometry, this.linkMaterials[index]);
      connector.renderOrder = 4;
      this.links.add(connector);
    });
  }

  frame(side: Color, overhead = false) {
    this.side = side;
    this.labels.w.visible = side === "w";
    this.labels.b.visible = side === "b";
    this.camera.position.set(0, 14, flip(side) * (overhead ? 0.001 : 6.8));
    this.camera.lookAt(0, 0.08, 0);
    this.camera.updateMatrixWorld();
    this.needsRender = true;
  }

  setInteraction(enabled: boolean, side: Color = "w") {
    this.inputEnabled = enabled;
    this.activeSide = side;
    if (!enabled) {
      this.cancelDrag();
      this.clearHover();
    }
  }

  quality(high: boolean) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1));
    this.renderer.shadowMap.enabled = high;
    const size = this.canvas.getBoundingClientRect();
    this.renderer.setSize(size.width, size.height, false);
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  private animate(duration: number, render: Tween["render"]) {
    return new Promise<boolean>((resolve) => {
      this.tween = {
        duration: this.motion.matches ? duration * 0.32 : duration,
        start: performance.now(),
        render,
        end: resolve,
      };
    });
  }

  cancelAnimations() {
    this.finishArrival();
    this.cancelDrag();
    this.dropped = undefined;
    this.shifting = false;
    if (!this.tween) return;
    const { end } = this.tween;
    this.tween = undefined;
    for (const [square, object] of this.meshes) this.place(square, object);
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
    end(false);
  }

  async move(move: Move, impact: () => void) {
    this.finishArrival();
    const object = this.meshes.get(move.from);
    const dragged = this.dropped?.from === move.from && this.dropped.to === move.to;
    this.dropped = undefined;
    if (!object) return;
    const from = point(move.from);
    const to = point(move.to);
    const capturedSquare = move.isEnPassant()
      ? ((move.to[0] + move.from[1]) as Square)
      : move.to;
    const enemy = move.captured ? this.meshes.get(capturedSquare) : undefined;
    let castle: { rook: PieceMesh; from: Square; to: Square } | undefined;
    const kingSide = move.isKingsideCastle();
    if (kingSide || move.isQueensideCastle()) {
      const rank = move.from[1];
      const corner = ((kingSide ? "h" : "a") + rank) as Square;
      const rook = this.meshes.get(corner);
      if (rook) castle = { rook, from: corner, to: ((kingSide ? "f" : "d") + rank) as Square };
    }
    if ((!dragged || castle) && !this.motion.matches && !document.hidden) {
      const rookFrom = castle && point(castle.from);
      const rookTo = castle && point(castle.to);
      const completed = await this.animate(move.captured ? 145 : 115, (progress) => {
        const eased = 1 - (1 - progress) ** 2;
        object.position.lerpVectors(from, to, dragged ? 1 : eased);
        if (move.piece === "n") object.position.y += Math.sin(Math.PI * eased) * 0.23;
        if (castle && rookFrom && rookTo) castle.rook.position.lerpVectors(rookFrom, rookTo, eased);
      });
      if (!completed) return;
    }
    if (enemy) this.release(capturedSquare, enemy);
    if (castle) {
      this.meshes.delete(castle.from);
      this.place(castle.to, castle.rook);
    }
    this.meshes.delete(move.from);
    this.place(move.to, object);
    impact();
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  async shift(event: Shift) {
    const motions: {
      object: PieceMesh;
      origin: Square;
      destination: Square;
      from: T.Vector3;
      to: T.Vector3;
      sideX: number;
      sideZ: number;
      height: number;
      pair: number;
    }[] = [];
    const activePairs: number[] = [];
    const reduced = this.motion.matches || document.hidden;
    event.pairs.forEach(([a, b], pair) => {
      const first = this.meshes.get(a),
        second = this.meshes.get(b);
      if (!movesShiftPair(event.effect, first?.userData, second?.userData))
        return;
      const from = point(a);
      const to = point(b);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const distance = Math.hypot(dx, dz);
      const bend = first && second ? 0.58 : 0.12;
      const height = Math.min(0.98, 0.46 + distance * 0.13);
      const sideX = (-dz / distance) * bend;
      const sideZ = (dx / distance) * bend;
      if (first) {
        motions.push({
          object: first, origin: a, destination: b, from, to, sideX, sideZ, height, pair,
        });
      }
      if (second) {
        motions.push({
          object: second, origin: b, destination: a, from: to, to: from,
          sideX: -sideX, sideZ: -sideZ, height, pair,
        });
      }
      if (reduced) return;
      const [startRing, endRing] = this.shiftEffects[pair];
      startRing.position.copy(from).setY(0.022);
      endRing.position.copy(to).setY(0.022);
      activePairs.push(pair);
    });
    if (!motions.length) return;
    this.indicate(null);
    const applied = { event, pairs: new Set(motions.map(({ pair }) => pair)) };
    this.shifting = true;
    this.showShift(event, true, applied.pairs);
    if (!reduced) {
      const paired = activePairs.length > 1;
      const localTime = (p: number, pair: number) =>
        paired ? (p - pair * 0.11) / 0.89 : p;
      const completed = await this.animate(paired ? 525 : 435, (p) => {
        for (const { object, from, to, sideX, sideZ, height, pair } of motions) {
          const t = localTime(p, pair);
          const k = T.MathUtils.smoothstep(t, 0.16, 0.83);
          const arc = Math.sin(Math.PI * k);
          object.position.lerpVectors(from, to, k);
          object.position.x += sideX * arc;
          object.position.y += height * arc;
          object.position.z += sideZ * arc;
          object.rotation.y = arc * 0.27;
        }
        for (const pair of activePairs) {
          const t = localTime(p, pair);
          const grow = T.MathUtils.smoothstep(t, 0, 0.24);
          const land = T.MathUtils.smoothstep(t, 0.69, 1);
          const [first, second] = this.shiftEffects[pair];
          first.visible = second.visible = t > 0 && t < 1;
          first.scale.setScalar(0.74 + 0.26 * grow + 0.12 * land);
          second.scale.setScalar(0.74 + 0.26 * grow + 0.30 * land);
          first.material.opacity = (0.67 + 0.25 * grow) * (1 - land);
        }
      });
      for (const pair of activePairs) {
        const [first, second] = this.shiftEffects[pair];
        first.visible = second.visible = false;
      }
      if (!completed) return;
    }
    this.shifting = false;
    for (const { origin } of motions) this.meshes.delete(origin);
    for (const { object, destination } of motions) this.place(destination, object);
    this.recentShift = applied;
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  private tick(ms: number) {
    if (this.arrival) {
      const progress = T.MathUtils.clamp(
        (ms - this.arrival.start) / this.arrival.duration,
        0,
        1,
      );
      this.arrival.render(progress);
      this.renderer.shadowMap.needsUpdate = true;
      this.needsRender = true;
      if (progress === 1) this.arrival = undefined;
    }
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
        end(true);
      }
    }
    if (!this.needsRender) return;
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
  }
}
