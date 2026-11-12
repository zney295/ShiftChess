export function drawStartArt(canvas: HTMLCanvasElement, screen: HTMLElement) {
  const ctx=canvas.getContext('2d');
  if (!ctx) return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0;
  const shape=(color: string, points: number[][])=>{
    ctx.fillStyle=color;
    ctx.beginPath();
    points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
    ctx.fill();
  };
  const oval=(color: string,x: number,y: number,rx: number,ry: number)=>{
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,0,0,2*Math.PI);
    ctx.fill();
  };
  const paint=(time=0)=>{
    frame=0;
    const {width,height}=canvas.getBoundingClientRect();
    if (screen.hidden || !width || !height) return;
    const pixels=Math.min(devicePixelRatio,2);
    const w=Math.round(width*pixels),h=Math.round(height*pixels);
    if (canvas.width!==w || canvas.height!==h) { canvas.width=w; canvas.height=h; }
    const scale=Math.max(w/480,h/520);
    ctx.setTransform(scale,0,0,scale,(w-480*scale)/2,(h-520*scale)*.61);
    ctx.fillStyle='#ead7a4';
    ctx.fillRect(0,0,480,520);
    oval('#f5bd66',350,149,65,65);
    oval('#acc18a',130,340,269,151);
    oval('#8bab76',401,347,240,136);
    shape('#688e6b',[[0,355],[117,315],[255,351],[380,291],[480,318],[480,520],[0,520]]);
    shape('#d3aa75',[[341,328],[397,326],[338,390],[430,520],[255,520],[251,416]]);
    shape('#344e48',[[30,0],[75,0],[73,259],[55,360],[22,367],[38,248],[43,126],[0,86],[0,67],[45,94]]);
    for (let i=0;i<12;i++) {
      oval(['#355d55','#477569','#638976'][i%3],i*37-18,21+(i*41)%88,61,32+(i%4)*6);
    }
    for (let i=0;i<34;i++) {
      const x=(i*79)%480,y=342+(i*37)%176;
      shape(i%4===0 ? '#edbe73' : '#4c765e',[[x,y],[x+3,y-6],[x+7,y],[x+3,y+3]]);
    }
    shape('#29483e',[[104,393],[364,393],[385,447],[89,447],[95,435],[370,435]]);
    shape('#59483b',[[117,396],[142,396],[129,520],[104,520]]);
    shape('#59483b',[[344,396],[369,396],[379,520],[354,520]]);
    const tile=(x: number,y: number)=>[111+27*x-3*y+x*y*.8,326+y*12];
    shape('#644d3b',[tile(0,0),tile(8,0),tile(8,8),tile(0,8),[87,437],[354,437]]);
    for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
      shape((x+y)%2 ? '#527e71' : '#f4e2ad',[tile(x,y),tile(x+1,y),tile(x+1,y+1),tile(x,y+1)]);
    }
    oval('#395c53',218,385,43,10);
    shape('#263e41',[[177,384],[181,371],[195,366],[197,345],[187,321],[190,292],[212,258],
      [210,235],[228,251],[245,255],[254,270],[272,283],[272,297],[259,304],[238,293],
      [224,307],[222,330],[238,362],[253,371],[256,384]]);
    shape('#47706a',[[190,321],[195,292],[213,260],[229,252],[243,258],[229,266],[210,283],[201,310],[205,346]]);
    shape('#ddad64',[[183,374],[250,374],[253,380],[180,380]]);
    oval('#ead49c',237,275,4,3);
    oval('#be915d',301,369,21,6);
    shape('#f0d28b',[[282,367],[285,358],[294,353],[297,338],[290,329],[308,329],[301,338],[305,353],[315,358],[319,367]]);
    oval('#f7dfa1',299,321,11,11);
    for (let i=0;i<9;i++) {
      const x=((i*83+time*.014)%510)-15;
      const y=125+(i*43)%176+Math.sin(time*.0012+i)*14;
      shape(i%2 ? '#e5a761' : '#78966d',[[x,y],[x+9,y-5],[x+13,y-2],[x+6,y+4]]);
    }
    if (!motion.matches) frame=requestAnimationFrame(paint);
  };
  const refresh=()=>{
    cancelAnimationFrame(frame);
    paint();
  };
  new ResizeObserver(refresh).observe(canvas);
  motion.addEventListener('change',refresh);
  refresh();
}
