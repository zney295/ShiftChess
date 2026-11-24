import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Color, Move, Piece, PieceSymbol, Square } from "chess.js";
import { box, furniture, mesh, pieceModel, softContactTexture, tabletopSize, type Setting } from "./models";
import { movesShiftPair, type Shift } from "./rules";
import { StageCamera, type CameraShot } from "./stage-camera";
import { flatPieceMaterial, moveDotTexture, shiftPortalTexture, sparkGeometry } from "./stage-textures";
export type { CameraShot } from "./stage-camera";

const alphabet = "abcdefgh";
const boardHeight = 0.004;
const squareAt = (x: number, z: number) => (alphabet[x] + (8 - z)) as Square;
const point = (s: Square) =>
  new T.Vector3(alphabet.indexOf(s[0]) - 3.5, boardHeight, 4.5 - Number(s[1]));
const smooth = (x: number) => x * x * (3 - 2 * x);
const flip = (side: Color) => (side === "w" ? 1 : -1);
type Board = (({ square: Square } & Piece) | null)[][];
type PieceMesh = T.Group & { userData: Piece & { square: Square; restScale?: T.Vector3; symbol?: T.Sprite } };
type Drag = {
  id: number;
  x: number;
  y: number;
  piece: PieceMesh;
  active: boolean;
  wasSelected: boolean;
  movedAt: number;
  tilt: T.Vector2;
};
type Animation = {
  duration: number;
  start: number;
  render: (progress: number) => void;
};
type Tween = Animation & { end: (completed: boolean) => void };
type AppliedShift = { event: Shift; pairs: ReadonlySet<number> };

export class Stage {
  readonly canvas: HTMLCanvasElement;
  private readonly seats: Record<Color, HTMLElement>;
  private readonly seatPoint = new T.Vector3();
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly rig = new StageCamera();
  private readonly light = new T.DirectionalLight("#fff5e6", 2.45);
  private readonly sky = new T.HemisphereLight("#ffffff", "#d8cab5", 1.05);
  private readonly rim = new T.DirectionalLight("#d6ecff", 1.45);
  private readonly meshes = new Map<Square, PieceMesh>();
  private readonly pieceLayer = new T.Group();
  private readonly flatPieces = new T.Group();
  private readonly flatMaterials = new Map<string, T.SpriteMaterial>();
  private readonly contactShadows = new T.InstancedMesh(
    new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ map: softContactTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    32,
  );
  private readonly contactMatrix = new T.Matrix4();
  private readonly legalTargets = new Set<Square>();
  private inputEnabled = true;
  private activeSide: Color = "w";
  private readonly hoverMarker = new T.Mesh(
    new T.RingGeometry(0.32, 0.43, 40),
    new T.MeshBasicMaterial({
      color: "#f4f1ea",
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  private readonly dots = new T.Group();
  private readonly selectionRing = new T.Mesh(
    new T.RingGeometry(0.648, 0.678, 4, 1, Math.PI / 4),
    new T.MeshBasicMaterial({ color: "#eb4d35", transparent: true, opacity: 0.96,
      depthWrite: false, side: T.DoubleSide, toneMapped: false }),
  );
  private readonly legalDots = new Map<Square, T.Mesh>();
  private readonly dotGeometry = new T.PlaneGeometry(0.41, 0.41);
  private readonly captureGeometry = new T.RingGeometry(0.39, 0.46, 32);
  private readonly dotMaterial = new T.MeshBasicMaterial({
    map: moveDotTexture(),
    transparent: true,
    opacity: 0.98,
    toneMapped: false,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly captureMaterial = new T.MeshBasicMaterial({
    color: "#ff5a43", transparent: true, opacity: 0.98, toneMapped: false, depthWrite: false,
  });
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
  private drag?: Drag;
  private dropped?: { from: Square; to: Square };
  private selected?: Square;
  private checked?: Square;
  private checkStarted = 0;
  private hovered?: Square;
  private room?: T.Group;
  private scenery?: T.Group;
  private setting?: Setting;
  private overhead = false;
  private presentation = false;
  private speed: "normal" | "fast" = "normal";
  private cameraShake = true;
  private showHints = true;
  private hudTop = 0;
  private viewportHeight = 720;
  private readonly tiles: T.InstancedMesh[] = [];
  private readonly tileMatrix = new T.Matrix4();
  private readonly effects = new T.Group();
  private readonly shiftTrails = new T.Group();
  private readonly particleGeometry = new T.IcosahedronGeometry(0.055, 0);
  private readonly sparkGeometry = sparkGeometry();
  private readonly chipGeometry = new T.TetrahedronGeometry(0.088);
  private readonly effectMaterials = ["#eb4d35", "#109b7e", "#f5a623", "#ffffff"].map(color =>
    new T.MeshBasicMaterial({ color, side: T.DoubleSide, depthWrite: false, toneMapped: false }));
  private particles: { object: T.Mesh; velocity: T.Vector3; born: number; life: number }[] = [];
  private shakeUntil = 0;
  private lastTick = 0;
  private readonly motes = new T.Points(
    new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(
      Array.from({ length: 36 }, (_, index) => [
        Math.sin(index * 2.399) * (4.1 + index % 4 * 0.85),
        0.5 + index % 7 * 0.42,
        Math.cos(index * 2.399) * (4.1 + index % 4 * 0.85),
      ]).flat(), 3)),
    new T.PointsMaterial({ color: "#fff8db", size: 0.055, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  private readonly markGeometry = new T.PlaneGeometry(1, 1);
  private readonly moveMarker = new T.MeshBasicMaterial({
    color: "#f2ad2e",
    transparent: true,
    opacity: 0.40,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly shiftMarkers = [
    new T.MeshBasicMaterial({
      color: "#eb4d35",
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    new T.MeshBasicMaterial({
      color: "#109b7e",
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  ];
  private readonly zoneMarker = new T.MeshBasicMaterial({
    color: "#f2ad2e",
    transparent: true,
    opacity: 0.22,
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
  private readonly checkRipple = new T.Mesh(this.captureGeometry, new T.MeshBasicMaterial({
    color: "#ff695d", transparent: true, depthWrite: false, toneMapped: false,
  }));
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
  private readonly portalMap = shiftPortalTexture();
  private readonly shiftEffects = this.shiftMarkers.map(({ color }) => {
    const geometry = new T.PlaneGeometry(1.3, 1.3);
    const material = new T.MeshBasicMaterial({
      color,
      map: this.portalMap,
      transparent: true,
      blending: T.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      side: T.DoubleSide,
      toneMapped: false,
    });
    const rings = [new T.Mesh(geometry, material), new T.Mesh(geometry, material.clone())];
    rings.forEach((ring) => {
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 3;
      ring.visible = false;
    });
    return rings;
  });
  private readonly tileMaterials = [
    new T.MeshStandardMaterial({ roughness: 0.6 }),
    new T.MeshStandardMaterial({ roughness: 0.6 }),
  ];
  private readonly badgeGeometry = new T.PlaneGeometry(1, 1);
  private readonly pairBadges = [this.pairBadge("A", "#eb4d35"), this.pairBadge("B", "#109b7e")];
  private arrival?: Animation;
  private tween?: Tween;
  private side: Color = "w";
  private facingAngle?: number;
  private needsRender = true;
  private readonly motion = matchMedia("(prefers-reduced-motion: reduce)");
  onSquare?: (square: Square, keepSelected?: boolean) => void;

  constructor(host: HTMLElement) {
    this.seats = {
      w: document.getElementById("white-player")!,
      b: document.getElementById("black-player")!,
    };
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    const studio = new RoomEnvironment();
    const reflections = new T.PMREMGenerator(this.renderer);
    this.scene.environment = reflections.fromScene(studio, 0.06).texture;
    this.scene.environmentIntensity = 0.44;
    reflections.dispose();
    studio.dispose();
    this.canvas = this.renderer.domElement;
    this.effects.add(this.shiftTrails);
    host.append(this.canvas);
    this.contactShadows.count = 0;
    this.contactShadows.frustumCulled = false;
    this.contactShadows.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.scene.add(this.sky, this.light, this.rim, this.links, this.contactShadows, this.pieceLayer, this.flatPieces);
    this.flatPieces.visible = false;
    this.scene.add(this.labels.w, this.labels.b, this.effects, this.motes);
    this.scene.add(...this.shiftEffects.flat());
    this.hoverMarker.rotation.x = -Math.PI / 2;
    this.hoverMarker.visible = false;
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.visible = false;
    this.checkRipple.rotation.x = -Math.PI / 2;
    this.checkRipple.visible = false;
    this.scene.add(this.hoverMarker, this.selectionRing, this.checkRipple, this.dots);
    this.light.position.set(-4.5, 11.8, 5.4);
    this.rim.position.set(4.5, 5, -5.4);
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
    this.light.shadow.radius = 1.6;
    this.light.shadow.normalBias = 0.014;
    this.light.shadow.bias = -0.00017;
    const base = box(8.02, 0.08, 8.02, new T.MeshStandardMaterial({
      color: "#332e28", roughness: 0.64,
    }), 0, -0.052, 0);
    base.castShadow = false;
    this.scene.add(base);
    const tileGeometry = new T.BoxGeometry(0.983, 0.08, 0.983);
    const tiles = this.tileMaterials.map((surface) => {
      const tile = new T.InstancedMesh(tileGeometry, surface, 32);
      tile.receiveShadow = true;
      this.scene.add(tile);
      return tile;
    });
    this.tiles.push(...tiles);
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
    const renderSize = new T.Vector2();
    const layout = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.getSize(renderSize);
      if (renderSize.x !== w || renderSize.y !== h) this.renderer.setSize(w, h, false);
      if (this.rig.camera.aspect !== w / h) {
        this.rig.camera.aspect = w / h;
        this.rig.camera.updateProjectionMatrix();
      }
      this.viewportHeight = h;
      // Use a stable viewport-derived top inset so dynamic HUD notifications
      // or 2-row SHIFT lock badges never cause the 3D camera to zoom in/out.
      this.hudTop = h <= 540 && w >= 560 ? 48 : w <= 860 ? 92 : 76;
      this.needsRender = true;
    };
    const observer = new ResizeObserver(layout);
    observer.observe(host);
    this.motion.addEventListener("change", () => { this.needsRender = true; });
    layout();
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
    this.raycaster.setFromCamera(this.pointer, this.viewCamera);
  }

  private press(event: PointerEvent) {
    if (!this.inputEnabled || this.drag || event.button !== 0) return;
    this.dropped = undefined;
    this.finishArrival();
    this.scene.updateMatrixWorld(true);
    this.aimPointer(event);
    const square = this.pickSquare();
    const piece = square ? this.meshes.get(square) : undefined;
    if (!piece || piece.userData.color !== this.activeSide) {
      if (square) this.onSquare?.(square);
      return;
    }
    const wasSelected = square === this.selected;
    this.onSquare?.(square!, true);
    this.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      piece,
      active: false,
      wasSelected,
      movedAt: performance.now(),
      tilt: new T.Vector2(),
    };
    this.canvas.setPointerCapture(event.pointerId);
  }

  private pointAt(event: PointerEvent) {
    if (!this.inputEnabled) return;
    const drag = this.drag;
    if (drag && drag.id !== event.pointerId) return;
    this.aimPointer(event);
    if (drag && !drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 7) {
      drag.active = true;
      this.clearHover();
      this.onSquare?.(drag.piece.userData.square, true);
      this.canvas.style.cursor = "grabbing";
    }
    if (drag?.active) {
      const target = this.floorSquare();
      const legal = target && this.legalTargets.has(target) ? target : undefined;
      this.showHover(legal);
      const { position, rotation } = drag.piece;
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.hitPoint) && !position.equals(this.hitPoint)) {
        const now = performance.now();
        const seconds = T.MathUtils.clamp((now - drag.movedAt) / 1000, 0.008, 0.05);
        const vx = (this.hitPoint.x - position.x) / seconds;
        const vz = (this.hitPoint.z - position.z) / seconds;
        drag.tilt.set(T.MathUtils.clamp(vz * 0.015, -0.24, 0.24), T.MathUtils.clamp(-vx * 0.015, -0.24, 0.24));
        drag.movedAt = now;
        position.copy(this.hitPoint);
        if (!this.motion.matches) {
          rotation.set(T.MathUtils.lerp(rotation.x, drag.tilt.x, 0.45), 0,
            T.MathUtils.lerp(rotation.z, drag.tilt.y, 0.45));
        }
        this.invalidateShadows();
      }
      return;
    }
    if (event.pointerType === "touch") return;
    const square = this.pickSquare();
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
    if (drag.active) {
      const from = drag.piece.userData.square;
      this.cancelDrag();
      if (tile && this.legalTargets.has(tile)) {
        this.dropped = { from, to: tile };
        this.onSquare?.(tile);
      }
      return;
    }
    this.cancelDrag();
    if (drag.wasSelected) this.onSquare?.(drag.piece.userData.square);
  }

  private cancelDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    if (drag.active) {
      this.place(drag.piece.userData.square, drag.piece);
      this.clearHover();
      this.invalidateShadows();
    }
    if (this.canvas.hasPointerCapture(drag.id)) this.canvas.releasePointerCapture(drag.id);
  }

  private pickSquare() {
    const floor = this.floorSquare();
    return this.overhead || floor && this.selected && this.legalTargets.has(floor)
      ? floor : this.hitPiece() ?? floor;
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
    this.hovered = square;
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
    c.font = "700 43px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#eee2cb";
    c.fillText(value, 32, 33);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const item = new T.Mesh(
      new T.PlaneGeometry(0.28, 0.28),
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
    // Carved antique brass/verdigris corner-inlay frame on the square surface
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 118, 118);
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(13, 13, 102, 102);
    ctx.globalAlpha = 1;
    // Corner diamond studs
    ctx.fillStyle = color;
    for (const [cx, cy] of [[14, 14], [14, 114], [114, 114]] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crisp monogram corner tab
    ctx.beginPath();
    ctx.roundRect(84, 0, 44, 44, [0, 0, 0, 10]);
    ctx.fill();
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "700 30px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 106, 23);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({
      map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
  }

  setSetting(setting: Setting) {
    if (this.setting === setting) return;
    this.setting = setting;
    if (this.room) {
      this.scene.remove(this.room);
      const geometries = new Set<T.BufferGeometry>();
      const materials = new Set<T.Material>();
      this.room.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => {
        (material as T.MeshStandardMaterial).map?.dispose();
        material.dispose();
      });
    }
    const { group, scenery } = furniture(setting);
    this.room = group;
    this.scenery = scenery;
    this.updateScenery();
    this.scene.add(this.room);
    const [light, dark] = setting === "park"
      ? ["#f0ebe0", "#5f81a0"]
      : ["#f3eadc", "#74665c"];
    this.tileMaterials[0].color.set(light);
    this.tileMaterials[1].color.set(dark);
    this.invalidateShadows();
  }

  setPresentation(enabled: boolean) {
    this.presentation = enabled;
    if (!enabled) this.rig.setShot();
    this.updateScenery();
    if (!enabled && this.rig.camera.view?.enabled) this.rig.camera.clearViewOffset();
    this.setInteraction(!enabled, this.activeSide);
    this.needsRender = true;
  }

  private updateScenery() {
    if (this.scenery) this.scenery.visible = !this.presentation;
    this.scene.background = this.presentation ? null
      : new T.Color(this.setting === "park" ? "#b9d2e4" : "#d5cab8");
  }

  suspend() {
    this.cancelAnimations();
    this.setInteraction(false);
    this.renderer.setAnimationLoop(null);
    this.canvas.hidden = true;
  }

  setShot(shot?: CameraShot) {
    this.rig.setShot(shot);
    this.sky.intensity = shot ? 0.82 : 1.05;
    this.invalidateShadows();
  }

  preferences(options: { speed?: "normal" | "fast"; cameraShake?: boolean; showHints?: boolean }) {
    this.speed = options.speed ?? this.speed;
    this.cameraShake = options.cameraShake ?? this.cameraShake;
    this.showHints = options.showHints ?? this.showHints;
    this.dots.visible = this.showHints;
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
        object.userData.restScale ??= object.scale.clone();
        this.pieceLayer.add(object);
        this.place(square, object);
        if (this.overhead) this.addFlatPiece(object);
        changed = true;
      }
    }
    if (changed) this.invalidateShadows();
  }

  private place(square: Square, object: PieceMesh) {
    object.position.copy(point(square));
    object.rotation.set(0, 0, 0);
    if (object.userData.restScale) object.scale.copy(object.userData.restScale);
    object.userData.square = square;
    this.meshes.set(square, object);
  }

  private release(square: Square, object: PieceMesh) {
    this.meshes.delete(square);
    this.pieceLayer.remove(object);
    if (object.userData.symbol) this.flatPieces.remove(object.userData.symbol);
    this.models.get(object.userData.color + object.userData.type)!.pool.push(object);
  }

  private addFlatPiece(piece: PieceMesh) {
    const data = piece.userData;
    if (!data.symbol) {
      const key = data.color + data.type;
      let surface = this.flatMaterials.get(key);
      if (!surface) {
        surface = flatPieceMaterial(data);
        this.flatMaterials.set(key, surface);
      }
      data.symbol = new T.Sprite(surface);
    }
    this.flatPieces.add(data.symbol);
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
    this.invalidateShadows();
  }

  indicate(
    shift: Shift | null,
    chosen?: Square,
    legal: Square[] = [],
    checked?: Square,
    lastMove?: Move,
    showRecent = false,
    zoneSquares: Square[] = [],
  ) {
    if (this.shifting) return;
    this.selected = chosen;
    if (checked && checked !== this.checked) this.checkStarted = performance.now();
    this.checked = checked;
    this.checkRipple.visible = Boolean(checked);
    if (checked) this.checkRipple.position.copy(point(checked)).setY(0.031);
    this.selectionRing.visible = Boolean(chosen);
    if (chosen) this.selectionRing.position.copy(point(chosen)).setY(0.025);
    const recent = showRecent ? this.recentShift : undefined;
    const displayed = shift ?? recent?.event;
    const pairs = shift ? undefined : recent?.pairs;
    if (!showRecent) this.recentShift = undefined;
    const zoneSet = new Set(displayed ? [] : zoneSquares);
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
      dot.position.y = capture ? 0.045 : 0.022;
      dot.material = capture ? this.captureMaterial : this.dotMaterial;
    }
    for (const [square, marker] of this.markers) {
      const index =
        displayed?.pairs.findIndex(
          (pair, index) => (!pairs || pairs.has(index)) && pair.includes(square),
        ) ?? -1;
      const inZone = zoneSet.has(square);
      marker.visible =
        index >= 0 ||
        inZone ||
        (square !== chosen && (square === lastMove?.from || square === lastMove?.to)) ||
        square === checked;
      marker.material =
        square === checked
          ? this.checkMarker
          : index >= 0
            ? this.shiftMarkers[index]
            : inZone
              ? this.zoneMarker
              : this.moveMarker;
      // Signature ShiftChess surface detail: affected pending SHIFT tiles physically rise slightly
      this.elevateTile(square, index >= 0 && Boolean(shift) ? 0.018 : 0);
    }
    this.needsRender = true;
    this.showShift(displayed, Boolean(shift), pairs);
  }

  private showShift(shift: Shift | undefined, arrows: boolean, pairs?: ReadonlySet<number>) {
    const linkKey = shift
      ? [this.side, this.overhead, shift.effect, arrows, ...shift.pairs.map((pair, index) =>
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
      if (first) this.addShiftArrow(a, b, index, Boolean(second));
      if (second) this.addShiftArrow(b, a, index, Boolean(first));
    });
  }

  private addShiftArrow(a: Square, b: Square, pair: number, twoWay: boolean) {
    const from = point(a).setY(0.09);
    const to = point(b).setY(0.09);
    const direction = to.clone().sub(from).normalize();
    const bend = twoWay ? 0.60 : 0.20;
    from.addScaledVector(direction, 0.17);
    to.addScaledVector(direction, -0.21);
    const middle = from.clone().lerp(to, 0.5);
    middle.add(new T.Vector3(-direction.z * bend, this.overhead ? 0 : 0.40, direction.x * bend));
    const curve = new T.QuadraticBezierCurve3(from, middle, to);
    const material = this.linkMaterials[pair];
    const path = new T.Mesh(new T.TubeGeometry(curve, 24, 0.027, 5, false), material);
    const head = new T.Mesh(new T.ConeGeometry(0.125, 0.29, 4), material);
    head.position.copy(curve.getPoint(0.79));
    head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), curve.getTangent(0.79));
    path.renderOrder = head.renderOrder = 4;
    this.links.add(path, head);
  }

  frame(side: Color, overhead = false, pitch = 45) {
    this.facingAngle = undefined;
    this.side = side;
    this.rig.playPitch = pitch;
    this.overhead = overhead;
    this.pieceLayer.visible = this.contactShadows.visible = !overhead;
    this.flatPieces.visible = overhead;
    if (overhead) for (const piece of this.meshes.values()) this.addFlatPiece(piece);
    this.labels.w.visible = side === "w";
    this.labels.b.visible = side === "b";
    this.linkKey = "";
    this.invalidateShadows();
  }

  async rotateTo(side: Color) {
    if (this.side === side && this.facingAngle === undefined) return;
    const fromAngle = this.facingAngle ?? (this.side === "w" ? 0 : Math.PI);
    const toAngle = side === "w" ? 0 : Math.PI;
    const overhead = this.overhead;
    this.labels.w.visible = false;
    this.labels.b.visible = false;
    await this.animate(460, (progress) => {
      const t = smooth(progress);
      this.facingAngle = fromAngle + (toAngle - fromAngle) * t;
      this.needsRender = true;
    });
    this.facingAngle = undefined;
    this.frame(side, overhead, this.rig.playPitch);
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
    const ratio = high ? Math.min(Math.max(devicePixelRatio, 1.35), 2) : 1;
    if (this.renderer.getPixelRatio() === ratio && this.renderer.shadowMap.enabled === high) return;
    this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled = high;
    this.invalidateShadows();
  }

  private invalidateShadows() {
    if (this.renderer.shadowMap.enabled) this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  private animate(duration: number, render: Tween["render"]) {
    return new Promise<boolean>((resolve) => {
      this.tween = {
        duration: this.motion.matches ? 1 : duration * (this.speed === "fast" ? 0.58 : 1),
        start: performance.now(),
        render,
        end: resolve,
      };
    });
  }

  cancelAnimations() {
    this.facingAngle = undefined;
    this.finishArrival();
    this.cancelDrag();
    this.dropped = undefined;
    this.shifting = false;
    this.shiftEffects.flat().forEach(ring => { ring.visible = false; });
    this.clearShiftTrails();
    this.particles.forEach(({ object }) => this.effects.remove(object));
    this.particles = [];
    this.shakeUntil = 0;
    this.resetTiles();
    if (!this.tween) return;
    const { end } = this.tween;
    this.tween = undefined;
    for (const [square, object] of this.meshes) this.place(square, object);
    this.invalidateShadows();
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
    if (!this.motion.matches && !document.hidden) {
      const rookFrom = castle && point(castle.from);
      const rookTo = castle && point(castle.to);
      const direction = to.clone().sub(from).normalize();
      const contact = enemy ? 0.43 : dragged ? 0.12 : 0.64;
      const impactPoint = enemy ? point(capturedSquare).lerp(to, 0.35) : to;
      let hit = false;
      const completed = await this.animate(enemy ? 640 : dragged ? 160 : 360, (progress) => {
        const travel = T.MathUtils.smoothstep(progress, 0.09, contact);
        object.position.lerpVectors(from, to, dragged ? 1 : travel);
        const arc = Math.sin(Math.PI * travel);
        if (!dragged) object.position.y += arc * (move.piece === "n" ? 0.9 : 0.23);
        object.rotation.y = !dragged && move.piece === "n" ? arc * 0.3 : 0;
        const restStart = enemy ? 0.485 : contact;
        const settle = T.MathUtils.clamp((progress - restStart) / (dragged ? 0.76 : 0.36), 0, 1);
        const squash = progress < 0.09 ? -Math.sin(progress / 0.09 * Math.PI) * 0.12
          : -Math.sin(settle * 2 * Math.PI) * (1 - settle) * 0.23;
        const rest = object.userData.restScale!;
        object.scale.set(rest.x * (1 - squash * 0.5), rest.y * (1 + squash), rest.z * (1 - squash * 0.5));
        if (castle && rookFrom && rookTo) castle.rook.position.lerpVectors(rookFrom, rookTo, travel);
        if (!hit && progress >= contact) {
          hit = true;
          impact();
          this.burst(impactPoint, enemy ? 20 : 6, enemy ? direction : undefined);
          if (enemy) this.shake();
        }
        if (enemy && progress >= contact) {
          // A short stationary impact interval precedes the victim's tumble.
          const flight = T.MathUtils.clamp((progress - 0.485) / 0.515, 0, 1);
          enemy.position.copy(point(capturedSquare)).addScaledVector(direction, flight * 5.7);
          enemy.position.y += Math.sin(Math.PI * flight) * 2.5 - flight * flight * 2.5;
          enemy.rotation.set(flight * Math.PI * 3, flight * 4, flight * Math.PI * 2);
        }
      });
      if (!completed) return;
      if (!hit) impact();
    } else impact();
    if (enemy) this.release(capturedSquare, enemy);
    if (castle) {
      this.meshes.delete(castle.from);
      this.place(castle.to, castle.rook);
    }
    this.meshes.delete(move.from);
    this.place(move.to, object);
    this.invalidateShadows();
  }

  async promote(square: Square) {
    const piece = this.meshes.get(square);
    if (!piece || this.motion.matches || document.hidden) return;
    const rest = piece.userData.restScale!;
    this.burst(point(square), 16);
    const completed = await this.animate(280, (progress) => {
      const lift = Math.sin(progress * Math.PI);
      piece.position.y = boardHeight + lift * 0.32;
      piece.scale.copy(rest).multiplyScalar(0.78 + progress * 0.22 + lift * 0.19);
      this.invalidateShadows();
    });
    if (completed) this.place(square, piece);
  }

  async morphAt(squares: Square[]) {
    if (!squares.length || this.motion.matches || document.hidden) return;
    const pieces = squares
      .map((square) => ({ square, piece: this.meshes.get(square) }))
      .filter((entry): entry is { square: Square; piece: PieceMesh } => Boolean(entry.piece));
    if (!pieces.length) return;
    for (const { square } of pieces) this.burst(point(square), 18);
    const completed = await this.animate(360, (progress) => {
      const lift = Math.sin(progress * Math.PI);
      for (const { piece } of pieces) {
        const rest = piece.userData.restScale!;
        piece.position.y = boardHeight + lift * 0.38;
        piece.rotation.y = lift * Math.PI;
        piece.scale.copy(rest).multiplyScalar(0.72 + progress * 0.28 + lift * 0.24);
      }
      this.invalidateShadows();
    });
    if (completed) {
      for (const { square, piece } of pieces) this.place(square, piece);
    }
  }

  async moveSimultaneous(
    whiteMove: Move,
    blackMove: Move,
    clash: boolean,
    clashSquare: Square | undefined,
    clashMidpoint: [Square, Square] | undefined,
    onImpact: () => void,
  ) {
    this.finishArrival();
    const wObj = this.meshes.get(whiteMove.from);
    const bObj = this.meshes.get(blackMove.from);
    const wFrom = point(whiteMove.from);
    const wTo = point(whiteMove.to);
    const bFrom = point(blackMove.from);
    const bTo = point(blackMove.to);
    const impactPoint = clash
      ? clashSquare
        ? point(clashSquare)
        : clashMidpoint
          ? point(clashMidpoint[0]).lerp(point(clashMidpoint[1]), 0.5)
          : wTo.clone().lerp(bTo, 0.5)
      : wTo.clone();

    if (!this.motion.matches && !document.hidden && (wObj || bObj)) {
      const wDir = impactPoint.clone().sub(wFrom).normalize();
      const bDir = impactPoint.clone().sub(bFrom).normalize();
      if (wDir.lengthSq() < 0.001) wDir.set(1, 0, 0);
      if (bDir.lengthSq() < 0.001) bDir.set(-1, 0, 0);
      const wEject = wDir.clone().negate().add(new T.Vector3(0.4, 0, -0.35)).normalize();
      const bEject = bDir.clone().negate().add(new T.Vector3(-0.4, 0, 0.35)).normalize();
      const contact = clash ? 0.44 : 0.72;
      let hit = false;
      const completed = await this.animate(clash ? 760 : 420, (progress) => {
        if (clash) {
          const rush = T.MathUtils.smoothstep(progress, 0.06, contact);
          if (progress < contact) {
            if (wObj) {
              wObj.position.lerpVectors(wFrom, impactPoint, rush);
              wObj.position.y += Math.sin(Math.PI * rush) * (whiteMove.piece === "n" ? 0.75 : 0.22);
            }
            if (bObj) {
              bObj.position.lerpVectors(bFrom, impactPoint, rush);
              bObj.position.y += Math.sin(Math.PI * rush) * (blackMove.piece === "n" ? 0.75 : 0.22);
            }
          } else {
            if (!hit) {
              hit = true;
              onImpact();
              this.shake();
              this.burst(impactPoint, 24, wEject);
              this.burst(impactPoint, 20, bEject);
            }
            const flight = T.MathUtils.clamp((progress - 0.5) / 0.5, 0, 1);
            if (wObj) {
              wObj.position.copy(impactPoint).addScaledVector(wEject, flight * 6.2);
              wObj.position.y += Math.sin(Math.PI * flight) * 2.8 - flight * flight * 2.6;
              wObj.rotation.set(flight * Math.PI * 3.2, flight * 4.5, flight * Math.PI * 2.2);
            }
            if (bObj) {
              bObj.position.copy(impactPoint).addScaledVector(bEject, flight * 6.2);
              bObj.position.y += Math.sin(Math.PI * flight) * 2.8 - flight * flight * 2.6;
              bObj.rotation.set(-flight * Math.PI * 3.2, -flight * 4.5, -flight * Math.PI * 2.2);
            }
          }
        } else {
          const travel = T.MathUtils.smoothstep(progress, 0.08, contact);
          const arc = Math.sin(Math.PI * travel);
          if (wObj) {
            wObj.position.lerpVectors(wFrom, wTo, travel);
            wObj.position.y += arc * (whiteMove.piece === "n" ? 0.85 : 0.24);
          }
          if (bObj) {
            bObj.position.lerpVectors(bFrom, bTo, travel);
            bObj.position.y += arc * (blackMove.piece === "n" ? 0.85 : 0.24);
          }
          if (!hit && progress >= contact) {
            hit = true;
            onImpact();
            this.burst(wTo, 8);
            this.burst(bTo, 8);
          }
        }
      });
      if (!completed) return;
      if (!hit) onImpact();
    } else {
      onImpact();
    }
    this.invalidateShadows();
  }

  async shift(event: Shift, onLand?: (pair: number) => void) {
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
    this.showShift(event, false, applied.pairs);
    if (!reduced) {
      const paired = activePairs.length > 1;
      const localTime = (p: number, pair: number) =>
        paired ? (p - pair * 0.20) / 0.80 : p;
      const trailSegments = 24;
      const trailSides = 5;
      const indicesPerSegment = trailSides * 6;
      const trails = motions.map(({ from, to, sideX, sideZ, height, pair }) => {
        const points = Array.from({ length: trailSegments + 1 }, (_, index) => {
          const t = index / trailSegments;
          const arc = Math.sin(Math.PI * t);
          return from.clone().lerp(to, t).add(new T.Vector3(sideX * arc, 0.38 + height * arc, sideZ * arc));
        });
        const geometry = new T.TubeGeometry(new T.CatmullRomCurve3(points), trailSegments, 0.046, trailSides, false);
        geometry.setDrawRange(0, 0);
        const trail = new T.Mesh(geometry, this.linkMaterials[pair]);
        trail.renderOrder = 7;
        this.shiftTrails.add(trail);
        return trail;
      });
      const landed = new Set<number>();
      const completed = await this.animate(paired ? 1280 : 1060, (p) => {
        for (const [index, pair] of event.pairs.entries()) {
          if (!applied.pairs.has(index)) continue;
          const t = T.MathUtils.clamp(localTime(p, index), 0, 1);
          for (const square of pair) this.elevateTile(square, Math.sin(t * Math.PI) * 0.10);
          if (t >= 0.78 && !landed.has(index)) {
            landed.add(index);
            this.shake();
            onLand?.(index);
            for (const { pair: motionPair, from, to } of motions) {
              if (motionPair === index) this.burst(to, 18, to.clone().sub(from).normalize());
            }
          }
        }
        for (const [index, { object, from, to, sideX, sideZ, height, pair }] of motions.entries()) {
          const t = localTime(p, pair);
          const k = T.MathUtils.smoothstep(t, 0.22, 0.78);
          const arc = Math.sin(Math.PI * k);
          object.position.lerpVectors(from, to, k);
          object.position.x += sideX * arc;
          object.position.y += height * arc;
          object.position.z += sideZ * arc;
          object.rotation.y = arc * Math.PI * 0.65;
          object.rotation.z = arc * 0.18;
          object.scale.copy(object.userData.restScale!).multiplyScalar(1 + arc * 0.045);
          const end = Math.floor(k * trailSegments);
          const start = Math.max(0, end - 12 + Math.floor(T.MathUtils.smoothstep(t, 0.78, 0.97) * 12));
          trails[index].geometry.setDrawRange(start * indicesPerSegment, (end - start) * indicesPerSegment);
        }
        for (const pair of activePairs) {
          const t = localTime(p, pair);
          const grow = T.MathUtils.smoothstep(t, 0, 0.22);
          const land = T.MathUtils.smoothstep(t, 0.78, 1);
          const [first, second] = this.shiftEffects[pair];
          first.visible = second.visible = t > 0 && t < 1;
          first.scale.setScalar(0.58 + 0.42 * grow + 0.12 * land);
          second.scale.setScalar(0.62 + 0.38 * grow + 0.53 * land);
          first.rotation.z = t * 2.6;
          second.rotation.z = -t * 2.6;
          first.material.opacity = grow * (1 - T.MathUtils.smoothstep(t, 0.38, 0.89));
          second.material.opacity = (0.48 * grow + 0.47 * Math.sin(Math.PI * land)) * (1 - land);
        }
      });
      if (!completed) return;
      this.clearShiftTrails();
      for (const pair of activePairs) {
        const [first, second] = this.shiftEffects[pair];
        first.visible = second.visible = false;
      }
    } else {
      applied.pairs.forEach(pair => onLand?.(pair));
    }
    this.shifting = false;
    this.resetTiles();
    for (const { origin } of motions) this.meshes.delete(origin);
    for (const { object, destination } of motions) this.place(destination, object);
    this.recentShift = applied;
    this.invalidateShadows();
  }

  private clearShiftTrails() {
    for (const trail of this.shiftTrails.children) (trail as T.Mesh).geometry.dispose();
    this.shiftTrails.clear();
  }

  private elevateTile(square: Square, elevation: number) {
    const x = alphabet.indexOf(square[0]);
    const z = 8 - Number(square[1]);
    this.tiles[(x + z) % 2].setMatrixAt(z * 4 + Math.floor(x / 2),
      this.tileMatrix.makeTranslation(x - 3.5, -0.04 + elevation, z - 3.5));
    this.tiles[(x + z) % 2].instanceMatrix.needsUpdate = true;
  }

  private resetTiles() {
    for (const square of this.markers.keys()) this.elevateTile(square, 0);
  }

  private shake() {
    if (this.cameraShake && !this.motion.matches) this.shakeUntil = performance.now() + 160;
  }

  celebrate() {
    if (this.motion.matches || document.hidden) return;
    const spots: [number, number][] = [[0, 0], [-2.1, -1.7], [2.1, 1.7], [-2.1, 1.7], [2.1, -1.7]];
    spots.forEach(([x, z], index) => {
      const origin = new T.Vector3(x, boardHeight + 0.12, z);
      this.burst(origin, index === 0 ? 22 : 14);
    });
    this.needsRender = true;
  }

  private burst(position: T.Vector3, count: number, direction?: T.Vector3) {
    if (this.motion.matches) return;
    const born = performance.now();
    const ring = new T.Mesh(this.captureGeometry, this.effectMaterials[0]);
    ring.position.copy(position).setY(0.035);
    ring.rotation.x = -Math.PI / 2;
    ring.userData.shockwave = true;
    this.effects.add(ring);
    this.particles.push({ object: ring, velocity: new T.Vector3(), born, life: 360 });
    if (count >= 12) {
      const echo = new T.Mesh(this.captureGeometry, this.effectMaterials[1]);
      echo.position.copy(position).setY(0.042);
      echo.rotation.x = -Math.PI / 2;
      echo.userData.shockwave = true;
      this.effects.add(echo);
      this.particles.push({ object: echo, velocity: new T.Vector3(), born: born + 65, life: 420 });
    }
    const total = Math.round(count * 1.35);
    for (let i = 0; i < total; i++) {
      const angle = i * 2.399;
      const geometry = direction ? (i % 3 === 0 ? this.sparkGeometry : this.chipGeometry) : (i % 4 === 0 ? this.sparkGeometry : this.particleGeometry);
      const object = new T.Mesh(geometry, this.effectMaterials[i % this.effectMaterials.length]);
      object.position.copy(position).y += direction ? 0.37 : 0.16;
      object.rotation.set(angle * 0.13, angle * 0.7, angle);
      const speed = (direction ? 1.55 : 0.85) * (1 + i % 3);
      const velocity = new T.Vector3(Math.cos(angle) * speed, 1.75 + i % 4 * 0.45, Math.sin(angle) * speed);
      if (direction) velocity.addScaledVector(direction, 1.15);
      this.effects.add(object);
      this.particles.push({ object, born, life: 420 + i % 4 * 80, velocity });
    }
  }

  private get viewCamera() { return this.overhead ? this.rig.flatCamera : this.rig.camera; }

  private placeSeats() {
    const camera = this.viewCamera;
    const width = this.viewportHeight * this.rig.camera.aspect;
    const tableTop = tabletopSize.y + tabletopSize.height / 2;
    for (const side of ["w", "b"] as const) {
      const seat = this.seats[side];
      const near = side === this.side;
      const worldX = near ? 0 : 4.3 * flip(side);
      const z = flip(side) * (near ? 4.7 : 4.8);
      const projected = this.seatPoint.set(worldX, tableTop, z).project(camera);
      const center = projected.x;
      const x = (1 + center) * 50;
      const y = (1 - projected.y) * 50;
      const radius = this.seatPoint.set(worldX + 0.42, tableTop, z).project(camera).x;
      const size = Math.max(26, Math.min(76, Math.abs(radius - center) * width));
      seat.style.setProperty("--seat-size", Math.round(size) + "px");
      seat.style.left = x.toFixed(2) + "%";
      seat.style.top = y.toFixed(2) + "%";
    }
  }

  private updateContactShadows() {
    let index = 0;
    for (const piece of this.meshes.values()) {
      const { x, y, z } = piece.position;
      if (Math.abs(x) >= 4 || Math.abs(z) >= 4 || y < -0.07) continue;
      const size = 0.96 * piece.scale.x + Math.max(0, y - boardHeight) * 0.1;
      this.contactMatrix.makeScale(size, 1, size).setPosition(x, 0.009, z);
      this.contactShadows.setMatrixAt(index++, this.contactMatrix);
    }
    this.contactShadows.count = index;
    this.contactShadows.instanceMatrix.needsUpdate = true;
  }

  private tick(ms: number) {
    if (document.hidden) return;
    if (this.rig.shot && !this.needsRender && ms - this.lastTick < 32) return;
    const dt = Math.min(0.05, (ms - (this.lastTick || ms)) / 1000);
    this.lastTick = ms;
    const reduced = this.motion.matches;
    if (reduced && !this.needsRender && !this.arrival && !this.tween && !this.particles.length) return;
    this.rig.place(ms, reduced, {
      height: this.viewportHeight, hudTop: this.hudTop, side: this.side,
      overhead: this.overhead, presentation: this.presentation, shakeUntil: this.shakeUntil,
      facingAngle: this.facingAngle,
    });
    if (!this.presentation) this.placeSeats();
    this.motes.visible = !reduced;
    this.motes.rotation.y = ms * 0.000045;
    this.motes.position.y = Math.sin(ms * 0.0006) * 0.16;
    this.canvas.dataset.cameraPosition = JSON.stringify(this.viewCamera.position.toArray());
    this.canvas.dataset.presenting = String(this.presentation);
    this.canvas.toggleAttribute("data-cinematic", Boolean(this.rig.shot));
    this.canvas.dataset.cameraTarget = JSON.stringify(this.rig.cameraTarget.toArray());
    this.canvas.dataset.cameraFov = String(this.rig.camera.fov);
    if (this.overhead) {
      this.canvas.dataset.flatHeight = String(this.rig.flatCamera.top);
      this.canvas.dataset.flatSide = this.side;
    } else {
      delete this.canvas.dataset.flatHeight;
    }
    const checkPhase = reduced ? 0.3 : Math.max(0, ms - this.checkStarted) % 1150 / 1150;
    if (this.arrival) {
      const progress = T.MathUtils.clamp((ms - this.arrival.start) / this.arrival.duration, 0, 1);
      this.arrival.render(progress);
      this.invalidateShadows();
      if (progress === 1) this.arrival = undefined;
    }
    if (this.tween) {
      const progress = T.MathUtils.clamp((ms - this.tween.start) / this.tween.duration, 0, 1);
      this.tween.render(progress);
      this.invalidateShadows();
      if (progress === 1) {
        const { end } = this.tween;
        this.tween = undefined;
        end(true);
      }
    } else if (!this.arrival) {
      const drag = this.drag?.active ? this.drag : undefined;
      if (drag) {
        const { rotation } = drag.piece;
        const steering = !reduced && ms - drag.movedAt < 70 ? 1 : 0;
        const x = drag.tilt.x * steering;
        const z = drag.tilt.y * steering;
        if (Math.abs(rotation.x - x) > 0.001 || Math.abs(rotation.z - z) > 0.001) {
          const blend = reduced ? 1 : 1 - Math.exp(-dt * 26);
          rotation.set(T.MathUtils.lerp(rotation.x, x, blend), 0, T.MathUtils.lerp(rotation.z, z, blend));
          this.invalidateShadows();
        }
      }
      const shakeTime = Math.min(1, checkPhase * 3.6);
      const kingTilt = reduced ? 0 : 0.07 * Math.sin(shakeTime * 4 * Math.PI) * (1 - shakeTime);
      for (const [square, object] of this.meshes) {
        if (drag?.piece === object) continue;
        const lifted = square === this.selected || (square === this.hovered && object.userData.color === this.activeSide);
        const y = boardHeight + (lifted ? 0.11 + (reduced ? 0 : Math.sin(ms * 0.004) * 0.025) : 0);
        if (Math.abs(object.position.y - y) > 0.001) {
          object.position.y = reduced ? y : T.MathUtils.lerp(object.position.y, y, 1 - Math.exp(-dt * 15));
        }
        // Keep contact shadows cached while idle poses and the check warning animate.
        const tilt = square === this.checked ? kingTilt : 0;
        if (object.rotation.z !== tilt) object.rotation.z = tilt;
      }
    }
    const pulse = reduced ? 0.5 : 0.5 + Math.sin(ms * 0.004) * 0.5;
    this.shiftMarkers.forEach(material => { material.opacity = 0.22 + pulse * 0.16; });
    this.zoneMarker.opacity = 0.11 + pulse * 0.10;
    if (this.checked) {
      this.checkMarker.opacity = 0.36 + Math.sin(Math.PI * checkPhase) * 0.28;
      this.checkRipple.scale.setScalar(0.78 + checkPhase * 0.5);
      this.checkRipple.material.opacity = 0.92 * (1 - checkPhase);
    }
    this.linkMaterials.forEach(material => { material.opacity = 0.65 + pulse * 0.35; });
    this.hoverMarker.scale.setScalar(1 + pulse * 0.06);
    this.selectionRing.material.opacity = 0.62 + pulse * 0.26;
    this.particles = this.particles.filter(particle => {
      if (ms < particle.born) {
        particle.object.visible = false;
        return true;
      }
      const age = ms - particle.born;
      if (age >= particle.life) {
        this.effects.remove(particle.object);
        return false;
      }
      particle.object.visible = true;
      if (particle.object.userData.shockwave) {
        const growth = age / particle.life;
        particle.object.scale.set(0.5 + growth * 2.75, 0.5 + growth * 2.75, 1);
        particle.object.visible = growth < 0.85;
      } else {
        particle.velocity.y -= dt * 5;
        particle.object.position.addScaledVector(particle.velocity, dt);
        particle.object.rotation.x += dt * 6;
        particle.object.rotation.z += dt * 4;
        particle.object.scale.setScalar(1 - age / particle.life);
      }
      return true;
    });
    if (this.overhead) {
      for (const piece of this.meshes.values()) {
        const symbol = piece.userData.symbol!;
        const { x, y, z } = piece.position;
        symbol.position.set(x, 2 + Math.max(0, y), z);
        symbol.scale.setScalar(0.94 * piece.scale.x);
        symbol.visible = Math.abs(x) < 4.6 && Math.abs(z) < 4.7;
      }
    } else if (this.needsRender) {
      this.updateContactShadows();
    }
    this.renderer.render(this.scene, this.viewCamera);
    this.needsRender = false;
  }
}
