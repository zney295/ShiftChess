import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Color, PieceSymbol } from 'chess.js';

export type Setting = 'park' | 'library';
export const material = (color: T.ColorRepresentation, roughness = 0.72, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });

export function mesh(geometry: T.BufferGeometry, surface: T.Material, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, surface);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

export function box(w: number, h: number, d: number, surface: T.Material, x = 0, y = 0, z = 0) {
  return mesh(new T.BoxGeometry(w, h, d), surface, x, y, z);
}

function sphere(radius: number, surface: T.Material, x: number, y: number, z: number) {
  return mesh(new T.SphereGeometry(radius, 16, 10), surface, x, y, z);
}

const profiles: Record<PieceSymbol, [number, number][]> = {
  p: [[.22,.12],[.18,.19],[.115,.28],[.09,.42],[.14,.48],[.14,.53],[.06,.55]],
  r: [[.24,.13],[.19,.23],[.16,.56],[.22,.65],[.23,.75],[.18,.76],[.18,.70],[.01,.70]],
  n: [[.23,.14],[.19,.24],[.14,.42],[.06,.48]],
  b: [[.23,.13],[.19,.23],[.10,.54],[.16,.62],[.13,.68],[.17,.77],[.12,.87],[.035,.98]],
  q: [[.25,.14],[.20,.23],[.11,.58],[.20,.68],[.16,.74],[.23,.89],[.19,.94],[.09,.87],[.01,.87]],
  k: [[.26,.14],[.20,.23],[.12,.65],[.21,.74],[.20,.80],[.14,.86],[.15,.92],[.08,.96]],
};
const pieceSurfaces = { w: material('#e7c58e', .3, .18), b: material('#303b42', .33, .22) };
const trim = { w: material('#b98d53', .36, .35), b: material('#65707a', .4, .35) };
const geometries = Object.fromEntries(Object.entries(profiles).map(([type, profile]) => [type,
  new T.LatheGeometry([[.001,0],[.225,0],[.252,.035],[.25,.08],...profile,[.001,profile.at(-1)![1]]]
    .map(([r, y]) => new T.Vector2(r, y)), 36),
]));

export function pieceModel(type: PieceSymbol, color: Color) {
  const result = new T.Group();
  const surface = pieceSurfaces[color];
  const ring = mesh(new T.TorusGeometry(.23, .017, 8, 36), trim[color], 0, .105);
  ring.rotation.x = Math.PI / 2;
  result.add(mesh(geometries[type], surface), ring);
  if (type === 'p') result.add(sphere(.146, surface, 0, .655, 0));
  if (type === 'b') {
    result.add(sphere(.045, trim[color], 0, 1, 0));
    const slit = box(.027, .15, .023, trim[color], .054, .875, -.111);
    slit.rotation.z = -.58;
    result.add(slit);
  }
  if (type === 'r' || type === 'q') {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const x = .19 * Math.cos(angle), z = .19 * Math.sin(angle);
      const crown = type === 'q' ? sphere(.045, trim[color], x, .96, z)
        : box(.093, .092, .09, surface, x, .80, z);
      crown.rotation.y = -angle;
      result.add(crown);
    }
  }
  if (type === 'k') result.add(box(.07,.25,.07,trim[color],0,1.07), box(.23,.065,.07,trim[color],0,1.09));
  if (type === 'n') {
    const shape = new T.Shape();
    shape.moveTo(-.14,.32);
    shape.bezierCurveTo(-.25,.54,-.26,.79,-.13,.99);
    shape.lineTo(-.075,.89);
    shape.bezierCurveTo(.02,.9,.1,.83,.21,.72);
    shape.lineTo(.20,.63);
    shape.lineTo(.13,.60);
    shape.lineTo(-.01,.67);
    shape.bezierCurveTo(-.07,.55,.13,.48,.15,.32);
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth:.135, bevelEnabled:true, bevelSize:.035, bevelThickness:.032, bevelSegments:3, steps:1, curveSegments:12 });
    geometry.translate(0,0,-.0675);
    const head = new T.Group();
    head.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
    head.add(mesh(geometry,surface), sphere(.023,trim[color],.035,.778,.105), sphere(.023,trim[color],.035,.778,-.105));
    result.add(head);
  }
  return result;
}

export function handModel(color: Color) {
  const hand = new T.Group();
  const skin = material(color === 'w' ? '#be8661' : '#935f49');
  const sleeve = material(color === 'w' ? '#506458' : '#5a4356');
  const cuff = mesh(new T.CylinderGeometry(.195,.16,.62,20), sleeve, 0,.77,.55);
  cuff.rotation.x = Math.PI / 2 - .35;
  const palm = sphere(.23,skin,0,.65,.23);
  palm.scale.set(1.05,.55,1.43);
  hand.add(cuff, palm);
  function digit(points: T.Vector3[], width: number) {
    hand.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 12, width, 8, false), skin));
    const tip = points.at(-1)!;
    hand.add(sphere(width, skin, tip.x, tip.y, tip.z));
  }
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * .105;
    digit([new T.Vector3(x,.66,.14), new T.Vector3(x,.62,-.05),
      new T.Vector3(x * .82,.52,-.17), new T.Vector3(x * .72,.42 + Math.abs(i-1.5)*.035,-.14)], .049);
  }
  digit([new T.Vector3(-.16,.64,.32),new T.Vector3(-.27,.59,.18),
    new T.Vector3(-.23,.48,.07),new T.Vector3(-.16,.44,.075)], .067);
  return hand;
}

function grain(base: string, stroke: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0,0,256,256);
  ctx.strokeStyle = stroke;
  for (let row = 0; row < 256; row += 2) {
    ctx.globalAlpha = .12 + .25 * Math.abs(Math.sin(row * 1.87));
    ctx.beginPath();
    ctx.moveTo(0,row);
    ctx.bezierCurveTo(80,row + 7 * Math.sin(row),175,row - 6 * Math.sin(row * .07),256,row);
    ctx.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function batchRoom(room: T.Group) {
  const parts = new Map<T.Material,T.BufferGeometry[]>();
  for (const child of room.children) {
    if (!(child instanceof T.Mesh)) continue;
    child.updateMatrix();
    const surface = child.material as T.Material;
    if (!parts.has(surface)) parts.set(surface,[]);
    parts.get(surface)!.push(child.geometry.applyMatrix4(child.matrix));
  }
  room.clear();
  for (const [surface,geometries] of parts) {
    const merged = mergeGeometries(geometries);
    if (merged) room.add(mesh(merged,surface));
    geometries.forEach(geometry=>geometry.dispose());
  }
  return room;
}

export function furniture(setting: Setting) {
  const group = new T.Group();
  const park = setting === 'park';
  const tabletop = material(park ? '#67736b' : '#735139');
  const wood = material('#ffffff');
  wood.map = grain(park ? '#55665a' : '#966547', park ? '#acb5a6' : '#523723');
  const ground = material(park ? '#3b5947' : '#453629');
  group.add(box(11,.34,10.2,wood,0,-.32,0), box(100,.25,100,ground,0,-2.28,0));
  for (const x of [-4.2,4.2]) for (const z of [-3.8,3.8]) {
    group.add(box(.42,1.72,.45,tabletop,x,-1.3,z));
  }
  const border = material(park ? '#303f39' : '#38271e', .49);
  group.add(box(8.48,.19,8.48,border,0,-.14));
  if (park) {
    const path = material('#9b9981');
    group.add(box(42,.055,3.8,path,0,-2.12,-9));
    const bench = material('#825a3b');
    for (const z of [-6.7,6.7]) {
      group.add(box(3.3,.19,1.13,bench,0,-1.28,z),box(3.3,.67,.14,bench,0,-.89,z + Math.sign(z)*.52));
      for (const x of [-1.22,1.22]) group.add(box(.15,.83,.72,border,x,-1.72,z));
    }
    const bark = material('#594532');
    const leaves = ['#274838','#3c6448','#547755'].map(c=>material(c));
    for (const [x,z,h] of [[-8,-4,5],[7,-8,6],[-12,-10,6],[2,-17,6],[11,-15,7],[-7,7,6]]) {
      group.add(mesh(new T.CylinderGeometry(.19,.38,h,10),bark,x,h/2-2.2,z));
      for (let i=0;i<6;i++) {
        const angle = i * 2.4;
        const canopy = mesh(new T.IcosahedronGeometry(1.7 + (i%3)*.3,1),leaves[i%3],
          x+Math.cos(angle)*1.7,h-1.3+(i%3)*.47,z+Math.sin(angle)*1.7);
        group.add(canopy);
      }
    }
  } else {
    const room = new T.Group();
    const wall = material('#655449');
    const shelf = material('#5c3b2b');
    const books = ['#9b593e','#6f8068','#b38c59','#615b78','#ad9c7c'].map(c=>material(c));
    room.add(box(32,13,.35,wall,0,4.3,-12.4),box(.4,13,28,wall,-13,4.3,0));
    for (const x of [-9.3,-5.4,6.4,10.4]) {
      room.add(box(3.5,6.7,.27,shelf,x,1.24,-11.8));
      for (let row=0;row<5;row++) {
        const y = -1.65+row*1.24;
        room.add(box(3.66,.14,1.03,shelf,x,y,-11.37));
        for (let i=0;i<10;i++) {
          const h=.43+((i*13+row*7)%17)*.036;
          room.add(box(.23+(i%3)*.02,h,.55,books[(i+row)%books.length],x-1.41+i*.31,y+h/2+.075,-11.19));
        }
      }
      for (const side of [-1,1]) room.add(box(.15,6.55,1.03,shelf,x+side*1.8,1.36,-11.38));
    }
    const glass = new T.MeshStandardMaterial({ color:'#c3d0b8', emissive:'#dfb47a', emissiveIntensity:.7, roughness:.75 });
    room.add(box(4.6,5.9,.09,glass,.32,2.1,-12.14));
    for (const x of [-1.99,.32,2.63]) room.add(box(.13,6,.19,shelf,x,2.1,-12));
    for (const y of [-.9,2.07,5.12]) room.add(box(4.7,.13,.19,shelf,.32,y,-12));
    batchRoom(room);
    const opposite = room.clone();
    opposite.rotation.y = Math.PI;
    group.add(room,opposite);
    const brass = material('#a18050',.36,.56);
    const lamp = new T.MeshStandardMaterial({ color:'#3f7256', emissive:'#30573e', emissiveIntensity:.35 });
    group.add(mesh(new T.CylinderGeometry(.26,.36,.09,20),brass,4.64,-.12,-3.8),
      mesh(new T.CylinderGeometry(.044,.063,1.05,12),brass,4.64,.43,-3.8),
      box(.93,.25,.48,lamp,4.64,1,-3.8));
    const glow = new T.PointLight('#f8ca85',10,7,2);
    glow.position.set(4.64,.85,-3.72);
    group.add(glow);
  }
  return group;
}
