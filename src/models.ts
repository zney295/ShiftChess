import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Color, PieceSymbol } from 'chess.js';

export type Setting = 'park' | 'library';
export const tabletopSize = { width: 9.6, depth: 10.3, height: .32, y: -.31 };
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

type Profile = [radius: number, height: number][];
const pedestal: Profile = [
  [0,0],[.271,0],[.303,.008],[.325,.027],[.328,.053],[.319,.069],
  [.301,.077],[.300,.089],[.307,.100],[.307,.117],[.294,.128],
  [.262,.138],[.255,.152],[.270,.164],[.268,.18],[.244,.194],
];
const collar = (radius: number, y: number): Profile => [
  [radius-.028,y],[radius,y+.014],[radius+.01,y+.032],
  [radius+.005,y+.052],[radius-.017,y+.064],[radius-.038,y+.071],
];
const profiles: Record<PieceSymbol, Profile> = {
  p: [[.188,.234],[.143,.298],[.112,.389],[.105,.496],...collar(.163,.52),[.089,.61],[.077,.665]],
  r: [[.244,.234],[.225,.273],[.199,.343],[.181,.465],[.183,.606],[.198,.668],
    ...collar(.244,.675),[.254,.766],[.269,.786],[.272,.831],[.262,.855],[.202,.855],[.195,.838],[.195,.778]],
  n: [[.219,.231],[.193,.258],[.213,.28],[.21,.303],[.194,.321]],
  b: [[.191,.242],[.147,.312],[.117,.428],[.104,.623],...collar(.176,.65),
    [.106,.735],[.121,.761],[.166,.805],[.179,.856],[.174,.901],[.148,.953],[.103,1.018],[.043,1.071],[.017,1.091]],
  q: [[.209,.239],[.167,.311],[.131,.448],[.119,.648],...collar(.196,.694),
    [.111,.784],[.14,.839],[.184,.92],[.225,.981],[.246,1.024],[.239,1.051],[.204,1.055],[.182,1.018],[.172,.963]],
  k: [[.22,.246],[.177,.318],[.142,.465],[.128,.693],...collar(.211,.737),
    [.134,.826],[.161,.861],[.218,.896],[.229,.928],[.207,.968],[.175,1.006],[.151,1.054],[.125,1.074],[.085,1.091]],
};
const proportions: Record<PieceSymbol, [number, number]> = {
  p:[.92,.99], r:[1.03,1.02], n:[1,1.08], b:[.98,1.05], q:[1.02,1.11], k:[1.07,1.11],
};
const pieceSurfaces = {
  w: new T.MeshPhysicalMaterial({ color: '#e7dac2', roughness: .33, clearcoat: .72, clearcoatRoughness: .18 }),
  b: new T.MeshPhysicalMaterial({ color: '#252b36', roughness: .28, clearcoat: .82, clearcoatRoughness: .15 }),
};
const trim = { w: material('#b68c5f', .29, .26), b: material('#8398b0', .29, .23) };
const turned = (profile: Profile) => new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),72);
const geometries = Object.fromEntries(Object.entries(profiles).map(([type, profile]) => [type,
  turned([...pedestal,...profile,[0,profile.at(-1)![1]]]),
]));
const headBall = new T.SphereGeometry(1,40,26);
const bishopHead = geometries.b;
const bishopPoints = bishopHead.getAttribute('position');
for (let i=0;i<bishopPoints.count;i++) {
  const y=bishopPoints.getY(i);
  if (y<.81 || y>1.055) continue;
  const x=bishopPoints.getX(i),z=bishopPoints.getZ(i);
  const angle=Math.atan2(z,x) - .8 - (y-.92)*6;
  const distance=Math.abs(Math.sin(angle));
  const cut=T.MathUtils.smoothstep(1-distance/.21,0,1)*.42;
  bishopPoints.setXYZ(i,x*(1-cut),y,z*(1-cut));
}
bishopHead.computeVertexNormals();

function bead(r: number,surface: T.Material,x: number,y: number,z: number) {
  const object = mesh(headBall,surface,x,y,z);
  object.scale.setScalar(r);
  return object;
}

function ring(r: number, thickness: number, y: number, surface: T.Material) {
  const object = mesh(new T.TorusGeometry(r,thickness,10,72),surface,0,y);
  object.rotation.x=Math.PI/2;
  return object;
}

function horse(surface: T.Material, accent: T.Material) {
  const outline = new T.Shape();
  outline.moveTo(-.177,.296);
  outline.bezierCurveTo(-.22,.477,-.242,.69,-.149,.853);
  outline.bezierCurveTo(-.125,.898,-.084,.93,-.068,.956);
  outline.lineTo(-.082,1.05);
  outline.quadraticCurveTo(-.013,1.072,.018,.956);
  outline.bezierCurveTo(.085,.967,.13,.899,.181,.858);
  outline.bezierCurveTo(.224,.817,.296,.774,.302,.716);
  outline.bezierCurveTo(.305,.68,.267,.651,.222,.661);
  outline.quadraticCurveTo(.188,.674,.117,.721);
  outline.bezierCurveTo(.055,.701,.042,.638,.065,.569);
  outline.bezierCurveTo(.082,.504,.124,.426,.174,.372);
  outline.lineTo(.164,.296);
  outline.closePath();
  const neck = new T.ExtrudeGeometry(outline,{
    depth:.128,bevelEnabled:true,bevelSize:.060,bevelThickness:.066,bevelSegments:6,steps:1,curveSegments:21,
  });
  neck.translate(0,0,-.064);
  const vertices=neck.getAttribute('position');
  for (let i=0;i<vertices.count;i++) {
    const x=vertices.getX(i),y=vertices.getY(i);
    const taper=T.MathUtils.lerp(1,.63,T.MathUtils.smoothstep(y,.44,1.08)) *
      T.MathUtils.lerp(1,.76,T.MathUtils.smoothstep(x,.12,.31));
    vertices.setZ(i,vertices.getZ(i)*taper);
  }
  neck.computeVertexNormals();
  const result=new T.Group();
  const head=mesh(neck,surface);
  head.name='Knight head and neck';
  result.add(head);
  for (const side of [-1,1]) {
    const cheek=bead(.102,surface,.066,.791,side*.068);
    cheek.scale.set(.13,.098,.071);
    cheek.rotation.z=-.38;
    const eye=bead(.019,accent,.084,.858,side*.106);
    eye.scale.z=.011;
    const nostril=bead(.016,accent,.262,.731,side*.077);
    nostril.scale.set(.024,.013,.008);
    const ridge=new T.CatmullRomCurve3([
      new T.Vector3(-.163,.356,side*.089),new T.Vector3(-.203,.545,side*.105),
      new T.Vector3(-.197,.717,side*.089),new T.Vector3(-.106,.892,side*.089),
    ]);
    result.add(cheek,eye,nostril,mesh(new T.TubeGeometry(ridge,26,.013,8,false),accent));
  }
  return result;
}

export function pieceModel(type: PieceSymbol, color: Color) {
  const result=new T.Group();
  const surface=pieceSurfaces[color],accent=trim[color];
  const body=mesh(geometries[type],surface);
  body.name='Turned body';
  const foot=ring(.302,.021,.084,accent);
  foot.name='Pedestal inlay';
  result.add(body,foot,ring(.254,.008,.155,surface));
  if (type==='p') result.add(bead(.177,surface,0,.731,0));
  if (type==='b') result.add(bead(.045,surface,0,1.094,0));
  if (type==='r' || type==='q') {
    for (let i=0;i<6;i++) {
      const angle=i*Math.PI/3;
      const radius=type==='r' ? .234 : .213;
      const x=radius*Math.cos(angle),z=radius*Math.sin(angle);
      const crown=type==='r'
        ? mesh(new RoundedBoxGeometry(.105,.126,.133,3,.015),surface,x,.904,z)
        : mesh(new T.ConeGeometry(.057,.12,18),surface,x,1.076,z);
      crown.rotation.y=-angle;
      result.add(crown);
    }
    if (type==='q') result.add(ring(.221,.009,1.029,accent),bead(.075,surface,0,1.087,0));
    if (type==='r') result.add(ring(.248,.008,.783,accent));
  }
  if (type==='k') {
    const stem=mesh(new RoundedBoxGeometry(.083,.25,.079,3,.015),surface,0,1.196);
    const crossbar=mesh(new RoundedBoxGeometry(.265,.083,.079,3,.015),surface,0,1.227);
    result.add(stem,crossbar,ring(.141,.010,1.066,accent));
  }
  if (type==='n') {
    const head=horse(surface,accent);
    head.rotation.y=color==='w' ? Math.PI*.28 : -Math.PI*.72;
    head.name='Knight sculpture';
    result.add(head);
  }
  const [width,height]=proportions[type];
  const parts = new Map<T.Material, T.BufferGeometry[]>();
  result.updateMatrixWorld(true);
  result.traverse((child) => {
    if (!(child instanceof T.Mesh)) return;
    const surface = child.material as T.Material;
    const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
    if (!geometry.index) {
      const count = geometry.getAttribute('position').count;
      geometry.setIndex(Array.from({ length: count }, (_, index) => index));
    }
    const geometries = parts.get(surface) ?? [];
    geometries.push(geometry);
    parts.set(surface, geometries);
  });
  result.clear();
  for (const [surface, geometries] of parts) {
    result.add(mesh(mergeGeometries(geometries), surface));
    geometries.forEach((geometry) => geometry.dispose());
  }
  result.scale.set(width * 1.13, height * 1.07, width * 1.13);
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
  texture.wrapS = texture.wrapT = T.MirroredRepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export function boardMaterials(setting: Setting) {
  if (setting==='library') return [
    new T.MeshStandardMaterial({map:grain('#63433b','#312521'),roughness:.57}),
    new T.MeshStandardMaterial({map:grain('#e0bf96','#987554'),roughness:.61}),
  ];
  return [
    stone('#355552','#83a79d','#243d3a'),
    stone('#d9d5bc','#faf4e4','#9f9f87'),
  ];
}

function stone(base: string, light: string, dark: string) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=base;
  ctx.fillRect(0,0,256,256);
  for (let i=0;i<1350;i++) {
    const x=(i*73.619)%256,z=(i*29.351)%256;
    ctx.fillStyle=i%2===0 ? dark : light;
    ctx.globalAlpha=.055+i%9*.012;
    ctx.fillRect(x,z,.75+i%3,.6+i%4*.42);
  }
  for (let i=0;i<11;i++) {
    const y=18+i*25+Math.sin(i*7)*11;
    ctx.strokeStyle=i%3===0 ? light : dark;
    ctx.lineWidth=.45+(i%4)*.27;
    ctx.globalAlpha=.14+(i%3)*.055;
    ctx.beginPath();
    for (let x=0;x<=256;x+=5) {
      const wave=y+x*.29+Math.sin(x*.033+i)*10+Math.sin(x*.13+i*1.6)*2.2;
      if (x===0) ctx.moveTo(x,wave);
      else ctx.lineTo(x,wave);
    }
    ctx.stroke();
  }
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.MirroredRepeatWrapping;
  texture.anisotropy=8;
  return new T.MeshStandardMaterial({map:texture,roughness:.67});
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

export function softContactTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const falloff = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
  falloff.addColorStop(0, 'rgba(34,25,20,.82)');
  falloff.addColorStop(.6, 'rgba(34,25,20,.55)');
  falloff.addColorStop(1, 'rgba(34,25,20,0)');
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, 64, 64);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

function woodenFloor() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const tones = ['#3e342e','#473a31','#382f2a','#4e4035','#42362d'];
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    for (let col = -1; col < 3; col++) {
      const x = col * 256 + (row % 4) * 64;
      ctx.globalAlpha = 1;
      ctx.fillStyle = tones[(row * 3 + col + 1) % tones.length];
      ctx.fillRect(x, y, 256, 64);
      ctx.fillStyle = '#241c18';
      ctx.globalAlpha = .52;
      ctx.fillRect(x, y, 256, 2);
      ctx.fillRect(x, y, 2, 64);
      ctx.fillStyle = '#806550';
      ctx.globalAlpha = .43;
      ctx.fillRect(x + 2, y + 2, 254, 1);
      ctx.strokeStyle = '#68432c';
      for (let line = 0; line < 14; line++) {
        const grainY = y + 5 + line * 3.9;
        ctx.globalAlpha = .05 + (line % 4) * .025;
        ctx.beginPath();
        ctx.moveTo(x + 3, grainY);
        ctx.bezierCurveTo(x + 65, grainY - 3, x + 185, grainY + 4 * Math.sin(row + line), x + 253, grainY);
        ctx.stroke();
      }
    }
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(7, 12);
  map.anisotropy = 4;
  return new T.MeshStandardMaterial({ map, roughness: .78 });
}

function wovenRug() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#222d47';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#303c5b';
  ctx.fillRect(12, 12, 488, 488);
  ctx.strokeStyle = '#ebcc8f';
  ctx.lineWidth = 3;
  ctx.strokeRect(17, 17, 478, 478);
  ctx.strokeRect(25, 25, 462, 462);
  for (let y = 0; y < 512; y += 3) {
    for (let x = y % 2; x < 512; x += 4) {
      ctx.fillStyle = (x + y) % 7 < 3 ? '#ecd2a02c' : '#382b222e';
      ctx.fillRect(x, y, 3, 2);
    }
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  const rug = mesh(new T.PlaneGeometry(13.5, 12.4), new T.MeshStandardMaterial({ map, roughness: 1 }), 0, -2.149, 0);
  rug.rotation.x = -Math.PI / 2;
  rug.castShadow = false;
  return rug;
}

export function furniture(setting: Setting) {
  const group = new T.Group();
  const scenery = new T.Group();
  group.add(scenery);
  const park = setting === 'park';
  const tabletop = material(park ? '#5c687c' : '#735139');
  const tableSurface = park ? stone('#39465d','#5d6b82','#263047') :
    new T.MeshStandardMaterial({map:grain('#563d2e','#34251d'),roughness:.63});
  const ground = park ? material('#475c4d') : woodenFloor();
  group.add(mesh(new RoundedBoxGeometry(tabletopSize.width, tabletopSize.height, tabletopSize.depth, 4, .083),tableSurface,0,tabletopSize.y,0));
  scenery.add(box(100,.25,100,ground,0,-2.28,0));
  for (const edge of [-1, 1]) {
    scenery.add(box(9.12,.42,.24,tabletop,0,-.66,edge * 4.87));
    scenery.add(box(.24,.42,9.66,tabletop,edge * 4.5,-.66,0));
  }
  for (const x of [-4.32,4.32]) for (const z of [-4.69,4.69]) {
    scenery.add(box(.49,1.7,.53,tabletop,x,-1.31,z));
  }
  const border = new T.MeshStandardMaterial({
    map: park ? grain('#9e6234','#734623') : grain('#4a2c1d','#301e16'), roughness: .48,
  });
  const inlay = material(park ? '#dcb77e' : '#e6b34d',.4,.26);
  group.add(mesh(new RoundedBoxGeometry(8.62,.26,8.62,4,.067),border,0,-.162,0));
  for (const edge of [-4.23,4.23]) {
    group.add(box(8.47,.018,.014,inlay,0,-.032,edge));
    group.add(box(.014,.018,8.47,inlay,edge,-.032,0));
  }
  if (park) {
    const landscaping=new T.Group();
    const path=[material('#817e72'),material('#8a8678'),material('#79776e')];
    for (let row=0;row<3;row++) for (let col=-12;col<=12;col++) {
      const slab=box(1.54,.052,1.23,path[(col+12+row*2)%3],col*1.58+(row%2)*.75,-2.12,-10+row*1.27);
      landscaping.add(slab);
    }
    const bench = new T.MeshStandardMaterial({map:grain('#8f5e3a','#493123'),roughness:.7});
    const metal = material('#344840',.45,.42);
    for (const z of [-6.7,6.7]) {
      for (let i=0;i<4;i++) {
        landscaping.add(box(3.3,.13,.23,bench,0,-1.28,z+(i-1.5)*.26));
        landscaping.add(box(3.3,.14,.09,bench,0,-1.10+i*.17,z+Math.sign(z)*(.54+i*.035)));
      }
      for (const x of [-1.27,1.27]) {
        landscaping.add(box(.13,.83,.20,metal,x,-1.73,z-.32),
          box(.13,1.44,.19,metal,x,-1.40,z+Math.sign(z)*.49));
      }
    }
    const bark = new T.MeshStandardMaterial({map:grain('#5d4738','#382e26'),roughness:.95});
    const leaves=['#304f38','#4c6e42','#68854d','#819454'].map(c=>material(c));
    for (const [x,z,h] of [[-7,-5,5.2],[7,-8,5.6],[-10,-12,6],[2,-17,6],[11,-15,7],[-8,7,6],[8,9,6]]) {
      landscaping.add(mesh(new T.CylinderGeometry(.17,.40,h,13),bark,x,h/2-2.2,z));
      for (let i=0;i<13;i++) {
        const angle=i*2.399,spread=.55+(i%5)*.36;
        const canopy=mesh(new T.IcosahedronGeometry(1.05+i%4*.25,2),leaves[i%4],
          x+Math.cos(angle)*spread,h-1.5+(i%4)*.48,z+Math.sin(angle)*spread);
        canopy.scale.set(1.12,.69+i%3*.13,1);
        canopy.rotation.y=angle;
        landscaping.add(canopy);
      }
    }
    for (let i=0;i<19;i++) {
      const bush=mesh(new T.IcosahedronGeometry(.70+i%4*.16,2),leaves[i%4],(i-9)*1.73,-1.64,-13+Math.sin(i*2.3)*.75);
      bush.scale.set(1.48,.78,1);
      landscaping.add(bush);
    }
    batchRoom(landscaping);
    landscaping.traverse(object=>{ object.castShadow=false; });
    scenery.add(landscaping);
  } else {
    const contact = mesh(new T.PlaneGeometry(12.5, 11.8), new T.MeshBasicMaterial({
      map: softContactTexture(), transparent: true, opacity: .76, depthWrite: false,
    }), 0, -2.143, 0);
    contact.rotation.x = -Math.PI / 2;
    contact.castShadow = contact.receiveShadow = false;
    scenery.add(wovenRug(), contact);
    const room = new T.Group();
    const wall = material('#333951');
    const shelf = material('#5c3b2b');
    const molding = material('#51311f');
    const books = ['#995334','#576f55','#b28043','#584761','#a88760'].map(c=>material(c));
    room.add(box(32,13,.35,wall,0,4.3,-12.4),box(.4,13,28,wall,-13,4.3,0));
    room.add(box(26,.32,.18,molding,0,-2,-12.15),box(.18,.32,24.4,molding,-12.75,-2,0));
    for (const x of [-9.3,-5.4,6.4,10.4]) {
      room.add(box(3.73,.44,.96,molding,x,-1.94,-11.38),
        box(3.79,.095,1.02,shelf,x,-1.74,-11.38));
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
    const glass = new T.MeshStandardMaterial({ color:'#687faf', emissive:'#637fcb', emissiveIntensity:.45, roughness:.75 });
    room.add(box(4.6,5.9,.09,glass,.32,2.1,-12.14));
    for (const x of [-1.99,.32,2.63]) room.add(box(.13,6,.19,shelf,x,2.1,-12));
    for (const y of [-.9,2.07,5.12]) room.add(box(4.7,.13,.19,shelf,.32,y,-12));
    batchRoom(room);
    // The shadow camera covers the table. Ground the distant bookcases locally at their plinths.
    room.traverse(object => { object.castShadow = false; });
    const threshold = new T.PlaneGeometry(3.78, .48);
    threshold.rotateX(-Math.PI / 2);
    threshold.setAttribute('color', new T.Float32BufferAttribute([
      1,1,1,.42, 1,1,1,.42, 1,1,1,0, 1,1,1,0,
    ], 4));
    const shade = new T.MeshBasicMaterial({
      color: '#392319', vertexColors: true, transparent: true, depthWrite: false, toneMapped: false,
    });
    for (const x of [-9.3,-5.4,6.4,10.4]) {
      const shadow = new T.Mesh(threshold, shade);
      shadow.position.set(x,-2.15,-10.67);
      room.add(shadow);
    }
    const opposite = room.clone();
    opposite.rotation.y = Math.PI;
    scenery.add(room,opposite);
    const brass = material('#a18050',.36,.56);
    const lamp = new T.MeshPhysicalMaterial({ color: '#3a4d71', roughness: .33, clearcoat: .45 });
    const diffuser = new T.MeshStandardMaterial({ color: '#ffe7ac', emissive: '#ffb663', emissiveIntensity: 1.8 });
    scenery.add(mesh(new T.CylinderGeometry(.26,.36,.09,20),brass,4.64,-.12,-3.8),
      mesh(new T.CylinderGeometry(.044,.063,1.05,12),brass,4.64,.43,-3.8),
      mesh(new RoundedBoxGeometry(1.06,.34,.56,4,.13),lamp,4.64,1,-3.8),
      mesh(new RoundedBoxGeometry(.86,.08,.39,3,.035),diffuser,4.64,.835,-3.8));
    const glow = new T.PointLight('#ffc477',21,6.2,2);
    glow.position.set(4.5,.78,-3.65);
    scenery.add(glow);
  }
  return { group, scenery };
}
