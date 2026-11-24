import * as T from "three";
import type { Piece, PieceSymbol } from "chess.js";

const flatGlyphs: Record<PieceSymbol, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
export function flatPieceMaterial({ type, color }: Piece) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.font = '136px "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols 2", serif';
  const glyph = flatGlyphs[type];
  const bounds = ctx.measureText(glyph);
  const x = (160 + bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2;
  const y = (160 + bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2;
  ctx.lineJoin = "round";
  ctx.lineWidth = color === "w" ? 8 : 6;
  ctx.strokeStyle = color === "w" ? "#443c32" : "#f9efd7";
  ctx.fillStyle = color === "w" ? "#fff6df" : "#242a32";
  ctx.strokeText(glyph, x, y);
  ctx.fillText(glyph, x, y);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return new T.SpriteMaterial({ map, toneMapped: false, depthWrite: false });
}

export function moveDotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const shadow = ctx.createRadialGradient(32, 34, 10, 32, 34, 30);
  shadow.addColorStop(0, "#193e38a0");
  shadow.addColorStop(1, "#193e3800");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, 64, 64);
  const face = ctx.createLinearGradient(0, 12, 0, 51);
  face.addColorStop(0, "#a8f1d6");
  face.addColorStop(1, "#318a74");
  ctx.beginPath();
  ctx.arc(32, 30, 17, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.strokeStyle = "#fffdf2";
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

export function shiftPortalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  const halo = ctx.createRadialGradient(96, 96, 0, 96, 96, 96);
  halo.addColorStop(0.21, "#fff0");
  halo.addColorStop(0.64, "#fff4");
  halo.addColorStop(0.83, "#fffa");
  halo.addColorStop(1, "#fff0");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 192, 192);
  ctx.strokeStyle = "#fff";
  for (const [radius, width, dash] of [[79, 4, 0], [64, 3, 12], [50, 2, 4]]) {
    ctx.setLineDash(dash ? [dash, dash] : []);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(96, 96, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  return new T.CanvasTexture(canvas);
}

export function sparkGeometry() {
  const star = new T.Shape();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const radius = i % 2 ? 0.036 : 0.125;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  return new T.ShapeGeometry(star);
}
