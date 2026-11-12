import { Chess, type Color, type Square } from 'chess.js';
import { GameAudio } from './audio';
import type { Setting } from './models';
import { effects, effectNames, Match, type Effect, type Mode } from './rules';
import { Stage } from './stage';
import './style.css';

const host = document.querySelector<HTMLElement>('#app')!;
host.innerHTML = `
  <header class="masthead">
    <div class="wordmark"><span class="crest" aria-hidden="true">♞</span> ShiftChess</div>
    <div class="actions">
      <button id="view" type="button" hidden>Toàn bàn</button>
      <button id="sound" type="button" aria-pressed="true">Âm thanh</button>
      <button id="settings" type="button" hidden>Ván mới</button>
    </div>
  </header>
  <div class="layout">
    <section id="viewport" class="viewport">
      <div class="scene-tag" id="location">Công viên</div>
      <div class="flash" id="flash" aria-hidden="true"></div>
    </section>
    <aside class="sidebar">
      <form id="setup" class="setup">
        <h1>Thiết lập ván</h1>
        <fieldset><legend>Bối cảnh</legend>
          <label><input type="radio" name="setting" value="park" checked> Công viên</label>
          <label><input type="radio" name="setting" value="library"> Thư viện</label>
        </fieldset>
        <label class="select-label" for="mode">Thời điểm SHIFT</label>
        <select id="mode" name="mode">
          <option value="periodic">Định kỳ · mỗi 3 vòng</option>
          <option value="late">Cuối ván · vòng 12</option>
          <option value="random">Bốc ngẫu nhiên chế độ</option>
        </select>
        <button class="primary" id="start" type="submit">Quay sự kiện và bắt đầu</button>
        <output id="roll" aria-live="polite"></output>
        <p class="muted">Hai người chung máy. Mỗi bên tự vào góc nhìn nhập vai khi đến lượt.</p>
      </form>
      <div id="game" hidden>
        <div class="turn" id="turn" aria-live="polite"></div>
        <p class="muted" id="rule"></p>
        <section class="event" aria-label="Sự kiện SHIFT">
          <p class="eyebrow">SHIFT</p>
          <p id="event" aria-live="polite"></p>
        </section>
        <section class="selection" aria-label="Đi quân bằng tọa độ">
          <label for="piece">Quân đang chọn</label>
          <select id="piece"><option value="">Chọn quân</option></select>
          <div class="targets" id="targets"></div>
        </section>
        <ol id="log" aria-label="Nước đi gần nhất"></ol>
        <p class="muted" id="tip">Chọn quân rồi chọn ô sáng. Dùng Toàn bàn nếu quân che mất tầm nhìn.</p>
      </div>
    </aside>
  </div>
  <dialog id="promotion"><form method="dialog">
    <h2>Phong cấp</h2>
    <div><button value="q">Hậu</button><button value="r">Xe</button>
      <button value="b">Tượng</button><button value="n">Mã</button></div>
  </form></dialog>
`;

const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const viewport=get('viewport');
const audio=new GameAudio();
let stage: Stage;
try {
  stage=new Stage(viewport);
} catch (error) {
  get<HTMLButtonElement>('start').disabled=true;
  get('roll').textContent='Trình duyệt không khởi tạo được WebGL 2.';
  throw error;
}

const setup=get<HTMLFormElement>('setup'), game=get('game'), view=get<HTMLButtonElement>('view');
const sound=get<HTMLButtonElement>('sound'), settings=get<HTMLButtonElement>('settings');
const picker=get<HTMLSelectElement>('piece'), targets=get('targets');
const pieceNames={ p:'Tốt', n:'Mã', b:'Tượng', r:'Xe', q:'Hậu', k:'Vua' };
const effectText: Record<Effect,string> = {
  swap:'Hai ô hoán đổi quân hiện có.',
  slide:'Quân chuyển sang ô còn trống trong cặp.',
  double:'Hai cặp ô đổi chỗ cùng lúc.',
};

let match: Match | undefined;
let selected: Square | undefined;
let overhead=false;
let busy=false;
let setting: Setting='park';
let message='';

const sideName=(side: Color)=>side==='w' ? 'Trắng' : 'Đen';
const modeName=(mode: Match['mode'])=>mode==='periodic' ? 'Định kỳ' : 'Cuối ván';
const locationName=(value: Setting)=>value==='park' ? 'Công viên' : 'Thư viện';

function draw() {
  if (!match) return;
  const {chess,pending,plies,effect}=match;
  const side=chess.turn();
  const mate=chess.isCheckmate(), ended=match.isEnded();
  const king=chess.isCheck() ? chess.board().flat().find(cell=>cell?.type==='k' && cell.color===side) : undefined;
  const legal=selected && !ended ? chess.moves({square:selected,verbose:true}) : [];
  const squares=[...new Set(legal.map(move=>move.to))];
  get('turn').textContent=mate ? sideName(side==='w' ? 'b' : 'w')+' thắng' :
    ended ? 'Hòa' : 'Lượt '+sideName(side)+(king ? ' · Bị chiếu' : '');
  get('rule').textContent=modeName(match.mode)+' · '+effectNames[effect];
  const event=get('event');
  event.replaceChildren();
  if (pending && !ended) {
    pending.pairs.forEach(([a,b],i)=>{
      const mark=document.createElement('strong');
      mark.className=i===0 ? 'pair' : 'pair alternate';
      mark.textContent=a+' ↔ '+b;
      event.append(mark);
    });
    const countdown=document.createElement('span');
    countdown.textContent='Còn '+(pending.at-plies)+' nước';
    event.append(countdown);
  } else {
    event.textContent=message || (ended ? 'Ván đã kết thúc.' :
      match.mode==='late' && plies>=24 ? 'Sự kiện cuối ván đã qua.' : effectText[effect]);
  }
  const possible = new Set(chess.moves({verbose:true}).map(move=>move.from));
  picker.replaceChildren(new Option('Chọn quân',''));
  for (const cell of chess.board().flat()) {
    if (cell && cell.color===side && possible.has(cell.square)) {
      picker.add(new Option(pieceNames[cell.type]+' '+cell.square,cell.square));
    }
  }
  picker.value=selected ?? '';
  picker.disabled=busy || ended;
  targets.replaceChildren();
  for (const square of squares) {
    const button=document.createElement('button');
    button.type='button';
    button.textContent=square;
    button.disabled=busy;
    button.addEventListener('click',()=>void choose(square));
    targets.append(button);
  }
  get('log').replaceChildren(...match.log.slice(-8).map(entry=>{
    const li=document.createElement('li');
    li.textContent=entry;
    return li;
  }));
  view.textContent=overhead ? 'Nhập vai' : 'Toàn bàn';
  view.disabled=settings.disabled=busy;
  stage.indicate(ended ? null : pending,selected,squares,king?.square);
}

async function promotion() {
  const dialog=get<HTMLDialogElement>('promotion');
  const result=new Promise<string>(resolve=>{
    dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true});
  });
  dialog.returnValue='';
  dialog.showModal();
  return result;
}

async function choose(square: Square) {
  if (!match || busy || match.isEnded()) return;
  const current=match;
  const chess=current.chess, side=chess.turn();
  if (chess.get(square)?.color===side) {
    selected=square===selected ? undefined : square;
    stage.frame(side,selected,overhead);
    draw();
    return;
  }
  if (!selected) return;
  const from=selected;
  const candidates=chess.moves({square:from,verbose:true}).filter(move=>move.to===square);
  if (!candidates.length) return;
  busy=true;
  draw();
  try {
    const upgraded=candidates[0].promotion ? await promotion() : undefined;
    if (candidates[0].promotion && !upgraded) return;
    const move=current.play(from,square,upgraded);
    message='';
    selected=undefined;
    await stage.move(move,overhead,()=>audio.move(Boolean(move.captured)));
    stage.sync(chess.board());
    const {due,applied,announced}=current.settle();
    if (due && applied) {
      message='SHIFT đã đổi vị trí.';
      stage.frame(side,undefined,true);
      audio.cue(true);
      get('flash').classList.add('active');
      await stage.shift(due);
      get('flash').classList.remove('active');
      stage.sync(chess.board());
    } else if (due) message='Bỏ qua SHIFT vì thế cờ hoặc ô đích không hợp lệ.';
    if (announced) audio.cue();
    stage.frame(chess.turn(),undefined,overhead,!overhead);
  } finally {
    busy=false;
    draw();
  }
}

stage.onSquare=square=>void choose(square);
picker.addEventListener('change',()=>{
  if (!match || busy) return;
  selected=(picker.value || undefined) as Square | undefined;
  stage.frame(match.chess.turn(),selected,overhead);
  draw();
});
view.addEventListener('click',()=>{
  if (!match || busy) return;
  overhead=!overhead;
  stage.frame(match.chess.turn(),selected,overhead);
  draw();
});
sound.addEventListener('click',()=>{
  audio.toggle();
  sound.textContent=audio.muted ? 'Bật âm' : 'Âm thanh';
  sound.setAttribute('aria-pressed',String(!audio.muted));
});
settings.addEventListener('click',()=>{
  if (busy) return;
  match=undefined;
  selected=undefined;
  setup.hidden=false;
  game.hidden=view.hidden=settings.hidden=true;
  get('roll').textContent='';
  stage.indicate(null);
  stage.frame('w',undefined,true);
  stage.sync(new Chess().board());
});
setup.addEventListener('change',()=>{
  setting=new FormData(setup).get('setting') as Setting;
  get('location').textContent=locationName(setting);
  stage.setSetting(setting);
});
setup.addEventListener('submit',async event=>{
  event.preventDefault();
  const start=get<HTMLButtonElement>('start');
  if (start.disabled) return;
  start.disabled=true;
  const options=new FormData(setup);
  const resolved=effects[Math.floor(Math.random()*effects.length)];
  setting=options.get('setting') as Setting;
  const mode=options.get('mode') as Mode;
  void audio.enable(setting).catch(()=>{});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roll=get('roll');
  for (let i=0;i<(reduced ? 0 : 7);i++) {
    roll.textContent=effectNames[effects[i%effects.length]];
    await new Promise(resolve=>setTimeout(resolve,55+i*17));
  }
  roll.textContent=effectNames[resolved];
  audio.cue();
  if (!reduced) await new Promise(resolve=>setTimeout(resolve,380));
  match=new Match(mode,resolved);
  message='';
  selected=undefined;
  overhead=false;
  get('location').textContent=locationName(setting);
  stage.setSetting(setting);
  stage.sync(match.chess.board());
  stage.frame('w');
  setup.hidden=true;
  game.hidden=view.hidden=settings.hidden=false;
  start.disabled=false;
  draw();
});
stage.sync(new Chess().board());
