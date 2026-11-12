import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Color, Move, Piece, Square } from 'chess.js';
import { boardMaterials, box, furniture, handModel, mesh, pieceModel, type Setting } from './models';
import type { Shift } from './rules';

const alphabet = 'abcdefgh';
const squareAt = (x: number, z: number) => (alphabet[x] + (8-z)) as Square;
const point = (s: Square) => new T.Vector3(alphabet.indexOf(s[0])-3.5, .004, 4.5-Number(s[1]));
const smooth = (x: number) => x*x*(3-2*x);
const flip = (side: Color) => side === 'w' ? 1 : -1;
type Board = ({square: Square} & Piece | null)[][];
type Tween = { duration: number; start: number; render: (progress: number)=>void; end: ()=>void };

export class Stage {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(47, 1, .1, 80);
  private readonly aim = new T.Vector3();
  private readonly destination = new T.Vector3();
  private readonly target = new T.Vector3();
  private readonly light = new T.DirectionalLight('#fff0d8', 3.15);
  private readonly sky = new T.HemisphereLight('#d6e8f5','#5a493d',.79);
  private readonly rim = new T.DirectionalLight('#c7dcff',.73);
  private readonly meshes = new Map<Square, T.Group>();
  private legalTargets = new Set<Square>();
  private readonly markers = new Map<Square, T.Mesh>();
  private readonly models = new Map<string, T.Group>();
  private readonly links = new T.Group();
  private readonly props = new Map<Setting, T.Group>();
  private readonly hands = { w: handModel('w'), b: handModel('b') };
  private readonly raycaster = new T.Raycaster();
  private readonly pointer = new T.Vector2();
  private readonly groundPlane = new T.Plane(new T.Vector3(0,1,0), -.012);
  private readonly markGeometry = new T.PlaneGeometry(.89,.89);
  private readonly moveMarker = new T.MeshBasicMaterial({color:'#d8d28d',transparent:true,opacity:.47,depthWrite:false,side:T.DoubleSide});
  private readonly shiftMarkers = [new T.MeshBasicMaterial({color:'#65f1d8',transparent:true,opacity:.58,depthWrite:false,side:T.DoubleSide}),
    new T.MeshBasicMaterial({color:'#e5a3ff',transparent:true,opacity:.54,depthWrite:false,side:T.DoubleSide})];
  private readonly selectMarker = new T.MeshBasicMaterial({color:'#ffcf7e',transparent:true,opacity:.69,depthWrite:false,side:T.DoubleSide});
  private readonly checkMarker = new T.MeshBasicMaterial({color:'#ff5d52',transparent:true,opacity:.59,depthWrite:false,side:T.DoubleSide});
  private readonly linkMaterials = this.shiftMarkers.map(surface => new T.LineBasicMaterial({color:surface.color,transparent:true,opacity:.69}));
  private readonly tileMaterials = {
    park: boardMaterials('park'),
    library: boardMaterials('library'),
  };
  private readonly tiles: T.Mesh[] = [];
  private tween?: Tween;
  private setting?: Setting;
  private cameraFrame: { side: Color; chosen?: Square; overhead: boolean } = {side:'w',overhead:true};
  private time = 0;
  private lastDraw = 0;
  private needsRender = true;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  onSquare?: (square: Square) => void;

  constructor(host: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    const studio = new RoomEnvironment();
    const probe = new T.PMREMGenerator(this.renderer);
    this.scene.environment = probe.fromScene(studio,.06,.1,100,{size:128}).texture;
    studio.dispose();
    probe.dispose();
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('aria-label','Bàn cờ 3D');
    host.append(this.canvas);
    this.scene.add(this.sky,this.light,this.rim,this.links);
    this.light.position.set(-4.5,10.5,5);
    this.rim.position.set(4,5,-6);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048,2048);
    Object.assign(this.light.shadow.camera,{left:-6.4,right:6.4,top:6.4,bottom:-6.4,near:.8,far:23});
    this.light.shadow.radius = 2;
    this.light.shadow.normalBias = .018;
    this.light.shadow.bias = -.00017;
    for (let z=0;z<8;z++) for (let x=0;x<8;x++) {
      const tile = box(.997,.08,.997,this.tileMaterials.park[(x+z)%2],x-3.5,-.04,z-3.5);
      const uv=tile.geometry.getAttribute('uv');
      for (let i=0;i<uv.count;i++) {
        uv.setXY(i,uv.getX(i)+x*.69+z*.29,uv.getY(i)+z*.55+x*.22);
      }
      tile.castShadow = false;
      this.tiles.push(tile);
      this.scene.add(tile);
      const marker = mesh(this.markGeometry,this.moveMarker,x-3.5,.004,z-3.5);
      marker.rotation.x = -Math.PI/2;
      marker.castShadow = marker.receiveShadow = marker.visible = false;
      this.markers.set(squareAt(x,z),marker);
      this.scene.add(marker);
    }
    for (let i=0;i<8;i++) {
      this.label(alphabet[i],i-3.5,4.13,0);
      this.label(alphabet[i],i-3.5,-4.13,Math.PI);
      this.label(String(8-i),-4.12,i-3.5,0);
      this.label(String(8-i),4.12,i-3.5,Math.PI);
    }
    this.canvas.addEventListener('click', event => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set((event.clientX-rect.left)/rect.width*2-1, 1-(event.clientY-rect.top)/rect.height*2);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const onBoard = this.raycaster.ray.intersectPlane(this.groundPlane,new T.Vector3());
      const tile = onBoard && Math.abs(onBoard.x)<4 && Math.abs(onBoard.z)<4
        ? squareAt(Math.floor(onBoard.x+4),Math.floor(onBoard.z+4)) : undefined;
      const piece = this.raycaster.intersectObjects([...this.meshes.values()], true)[0];
      let pieceSquare: Square | undefined;
      if (piece) {
        let root = piece.object;
        while (root.parent && root.parent !== this.scene) root = root.parent;
        pieceSquare = [...this.meshes].find(([,model]) => root === model)?.[0];
      }
      // An available capture or lit floor square takes precedence over unrelated geometry.
      const picked = pieceSquare && this.legalTargets.has(pieceSquare) ? pieceSquare
        : tile && this.legalTargets.has(tile) ? tile : pieceSquare ?? tile;
      if (picked) this.onSquare?.(picked);
    });
    const resize = () => {
      const w=host.clientWidth,h=host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w,h,false);
      this.camera.aspect=w/h;
      this.camera.fov=w/h<1.1 ? 55 : 47;
      this.camera.updateProjectionMatrix();
      if (!this.tween) {
        const {side,chosen,overhead}=this.cameraFrame;
        this.frame(side,chosen,overhead,true);
      }
      this.needsRender=true;
    };
    new ResizeObserver(resize).observe(host);
    resize();
    this.setSetting('park');
    this.frame('w',undefined,true,true);
    this.renderer.setAnimationLoop(ms => this.tick(ms));
  }

  private label(value: string,x: number,z: number,angle: number) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d')!;
    c.font='bold 44px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='#f5d4a7';
    c.fillText(value,32,33);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const item = new T.Mesh(new T.PlaneGeometry(.23,.23), new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    item.position.set(x,.013,z);
    item.rotation.set(-Math.PI/2,0,angle);
    this.scene.add(item);
  }

  setSetting(setting: Setting) {
    if (setting === this.setting) return;
    if (this.setting) this.scene.remove(this.props.get(this.setting)!);
    if (!this.props.has(setting)) this.props.set(setting,furniture(setting));
    this.setting=setting;
    this.scene.add(this.props.get(setting)!);
    const park = setting==='park';
    const color = park ? '#a2b9ad' : '#5a483c';
    this.scene.background=new T.Color(color);
    this.scene.fog=new T.FogExp2(color,park ? .022 : .015);
    this.light.color.set(park ? '#fff1da' : '#ffdfb4');
    this.light.intensity=park ? 2.75 : 2.52;
    this.sky.intensity=park ? .74 : .56;
    this.rim.intensity=park ? .64 : .85;
    this.scene.environmentIntensity=park ? .43 : .39;
    this.renderer.toneMappingExposure=park ? .95 : 1;
    this.tiles.forEach((tile,i)=> tile.material=this.tileMaterials[setting][(i+Math.floor(i/8))%2]);
    this.renderer.shadowMap.needsUpdate=true;
    this.needsRender=true;
  }

  sync(board: Board) {
    for (const object of this.meshes.values()) this.scene.remove(object);
    this.meshes.clear();
    for (const cell of board.flat()) {
      if (!cell) continue;
      const key=cell.color+cell.type;
      if (!this.models.has(key)) this.models.set(key,pieceModel(cell.type,cell.color));
      const model = this.models.get(key)!.clone();
      model.position.copy(point(cell.square));
      this.scene.add(model);
      this.meshes.set(cell.square,model);
    }
    this.renderer.shadowMap.needsUpdate=true;
    this.needsRender=true;
  }

  indicate(shift: Shift | null, chosen?: Square, legal: Square[] = [], checked?: Square) {
    this.legalTargets = new Set(legal);
    while (this.links.children.length) {
      const line = this.links.children[0] as T.Line;
      this.links.remove(line);
      line.geometry.dispose();
    }
    for (const [square, marker] of this.markers) {
      const index = shift?.pairs.findIndex(pair=>pair.includes(square)) ?? -1;
      marker.visible = index>=0 || square===chosen || legal.includes(square) || square===checked;
      marker.material = square===checked ? this.checkMarker : square===chosen ? this.selectMarker
        : index>=0 ? this.shiftMarkers[index] : this.moveMarker;
    }
    shift?.pairs.forEach(([a,b],index)=>{
      const from=point(a),to=point(b);
      const mid=from.clone().lerp(to,.5);
      from.y=to.y=.11; mid.y=.69;
      const curve=new T.QuadraticBezierCurve3(from,mid,to);
      this.links.add(new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(26)),this.linkMaterials[index]));
    });
    this.needsRender=true;
  }

  frame(side: Color, chosen?: Square, overhead=false, immediate=false) {
    this.cameraFrame={side,chosen,overhead};
    const dir = flip(side);
    const narrow = this.camera.aspect < 1.1;
    if (overhead) {
      const distance=Math.max(1,.98/this.camera.aspect);
      this.destination.set(0,10.1*distance,dir*8.55*distance);
      this.target.set(0,.04,0);
    } else if (chosen) {
      this.follow(side,point(chosen));
    } else {
      const distance=Math.max(1,.85/this.camera.aspect);
      // Show the heads of the pawns above the taller back rank before a piece is picked.
      this.destination.set(0,(narrow ? 7.4 : 5.9)*distance,dir*(narrow ? 10.8 : 8.65)*distance);
      this.target.set(0,.26,0);
    }
    if (immediate) {
      this.camera.position.copy(this.destination);
      this.aim.copy(this.target);
      this.camera.lookAt(this.aim);
    }
    this.needsRender=true;
  }

  private follow(side: Color, location: T.Vector3) {
    const dir=flip(side);
    this.destination.set(location.x*.93,location.y+2.05,location.z+dir*2.8);
    this.target.set(location.x*.73,location.y+.25,location.z-dir*2.05);
  }

  private animate(duration: number,render: Tween['render']) {
    return new Promise<void>(resolve=>{
      this.tween={duration:this.reduced ? duration*.32 : duration,start:performance.now(),render,end:resolve};
    });
  }

  async move(move: Move, overhead: boolean, impact: ()=>void) {
    const object=this.meshes.get(move.from);
    if (!object) return;
    const from=point(move.from),to=point(move.to);
    const capturedSquare = move.isEnPassant() ? (move.to[0]+move.from[1]) as Square : move.to;
    const enemy=move.captured ? this.meshes.get(capturedSquare) : undefined;
    const enemyOrigin=enemy?.position.clone();
    const hand = this.hands[move.color];
    let struck=false;
    if (enemy) {
      this.scene.add(hand);
      hand.rotation.y=move.color==='w' ? 0 : Math.PI;
    }
    const direction=flip(move.color);
    const hop=move.piece==='n' ? .59 : .21;
    await this.animate(enemy ? 880 : 355,p=>{
      const step=enemy ? smooth(T.MathUtils.clamp((p-.18)/.54,0,1)) : smooth(p);
      object.position.lerpVectors(from,to,step);
      object.position.y += Math.sin(Math.PI*step)*(enemy ? .39 : hop);
      if (enemy && enemyOrigin) {
        hand.position.copy(object.position);
        hand.position.z += direction*(Math.max(0,.20-p)*20+Math.max(0,p-.78)*20);
        hand.position.y += Math.max(0,.20-p)*3+Math.max(0,p-.78)*5;
        if (p>=.69) {
          if (!struck) { struck=true; impact(); }
          const k=smooth(T.MathUtils.clamp((p-.69)/.29,0,1));
          enemy.position.copy(enemyOrigin);
          enemy.position.x += (to.x<0 ? -1 : 1)*k*2.2;
          enemy.position.z -= direction*k*.77;
          enemy.position.y += Math.sin(Math.PI*k)*.32-k*.4;
          enemy.rotation.z=(to.x<0 ? 1 : -1)*k*1.46;
        }
      }
      if (!overhead) {
        this.follow(move.color,object.position);
        if (enemy) { this.destination.y+=.78; this.destination.z+=direction*.7; }
      }
    });
    if (enemy) this.scene.remove(hand);
    if (!struck) impact();
  }

  async shift(event: Shift) {
    const motions: { object: T.Group; from: T.Vector3; to: T.Vector3; curve: number }[] = [];
    event.pairs.forEach(([a,b])=>{
      const first=this.meshes.get(a),second=this.meshes.get(b);
      if (event.effect==='slide' && Boolean(first)===Boolean(second)) return;
      if (first) motions.push({object:first,from:point(a),to:point(b),curve:1});
      if (second) motions.push({object:second,from:point(b),to:point(a),curve:1});
    });
    await this.animate(event.pairs.length>1 ? 950 : 710,p=>{
      const k=smooth(p);
      for (const {object,from,to,curve} of motions) {
        object.position.lerpVectors(from,to,k);
        object.position.y+=Math.sin(Math.PI*k)*1.12;
        const angle=Math.atan2(to.z-from.z,to.x-from.x);
        object.position.x-=Math.sin(angle)*Math.sin(Math.PI*k)*curve*.44;
        object.position.z+=Math.cos(angle)*Math.sin(Math.PI*k)*curve*.44;
        object.rotation.y=Math.sin(Math.PI*k)*.36;
      }
    });
  }

  private tick(ms: number) {
    if (this.tween) {
      const progress=T.MathUtils.clamp((ms-this.tween.start)/this.tween.duration,0,1);
      this.tween.render(progress);
      this.renderer.shadowMap.needsUpdate=true;
      this.needsRender=true;
      if (progress===1) {
        const {end}=this.tween;
        this.tween=undefined;
        end();
      }
    }
    const dt=Math.min((ms-this.time)/1000,.08);
    this.time=ms;
    const cameraMoving=this.camera.position.distanceToSquared(this.destination) > .000001 ||
      this.aim.distanceToSquared(this.target) > .000001;
    if (cameraMoving) {
      const damping=this.reduced ? 1 : 1-Math.exp(-9*dt);
      this.camera.position.lerp(this.destination,damping);
      this.aim.lerp(this.target,damping);
      this.camera.lookAt(this.aim);
    }
    const pulse=!this.reduced && this.links.children.length>0 && ms-this.lastDraw>=45;
    if (!this.needsRender && !cameraMoving && !pulse) return;
    this.shiftMarkers.forEach((surface,i)=>surface.opacity=.51+(this.reduced ? 0 : .13*Math.sin(ms/250+i)));
    this.renderer.render(this.scene,this.camera);
    this.lastDraw=ms;
    this.needsRender=false;
  }
}
