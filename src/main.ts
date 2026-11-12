import type { Color, Square } from 'chess.js';
import { GameAudio } from './audio';
import type { Setting } from './models';
import { effects, effectNames, Match, type Effect, type Mode } from './rules';
import { Stage } from './stage';
import './style.css';

const host = document.querySelector<HTMLElement>('#app')!;
host.innerHTML = `
  <section id="start-screen" class="menu-screen" aria-labelledby="start-title">
    <div class="menu-card">
      <header>
        <span class="menu-crest" aria-hidden="true">♞</span>
        <h1 id="start-title">ShiftChess</h1>
        <p class="muted">Cờ vua 3D cho hai người chơi chung máy.</p>
      </header>
      <form id="setup" class="setup">
        <fieldset><legend>Bối cảnh</legend>
          <label><input type="radio" name="setting" value="park" checked> Công viên</label>
          <label><input type="radio" name="setting" value="library"> Thư viện</label>
        </fieldset>
        <div class="mode-control">
          <label class="select-label" for="mode">Thời điểm SHIFT</label>
          <select id="mode" name="mode">
            <option value="periodic">Định kỳ · mỗi 3 vòng</option>
            <option value="late">Cuối ván · vòng 12</option>
            <option value="random">Bốc ngẫu nhiên chế độ</option>
          </select>
        </div>
        <button class="primary" id="start" type="submit">Bắt đầu</button>
      </form>
    </div>
  </section>
  <section id="random-screen" class="menu-screen" aria-labelledby="random-title" hidden>
    <div class="menu-card random-card">
      <header>
        <h1 id="random-title">Quay sự kiện</h1>
        <p class="muted" id="random-summary"></p>
      </header>
      <div class="wheel-wrap" aria-hidden="true">
        <div id="wheel" class="wheel"><b>↔</b><b>→</b><b>⇆</b></div>
        <span class="wheel-needle"></span>
        <span class="wheel-hub">SHIFT</span>
      </div>
      <output id="roll" aria-live="polite"></output>
      <p id="roll-detail" class="muted"></p>
      <div class="menu-actions">
        <button id="back" type="button">Quay lại</button>
        <button id="spin" class="primary" type="button">Quay</button>
        <button id="enter" class="primary" type="button" hidden>Vào ván</button>
      </div>
    </div>
  </section>
  <section id="play-screen" class="play-screen" aria-label="Chơi cờ" hidden>
  <header class="masthead">
    <div class="wordmark"><span class="crest" aria-hidden="true">♞</span> ShiftChess</div>
    <div class="actions">
      <button id="view" type="button">Toàn bàn</button>
      <button id="sound" type="button" aria-pressed="true">Âm thanh</button>
      <button id="settings" type="button">Ván mới</button>
    </div>
  </header>
  <div class="layout">
    <section id="viewport" class="viewport playing">
      <div class="scene-tag" id="location">Công viên</div>
      <div class="flash" id="flash" aria-hidden="true"></div>
    </section>
    <aside class="sidebar">
      <div id="game">
        <div class="match-status">
          <div class="turn" id="turn" aria-live="polite"></div>
          <p class="muted" id="rule"></p>
        </div>
        <section class="event" aria-label="Sự kiện SHIFT">
          <p class="eyebrow">SHIFT</p>
          <p id="event" aria-live="polite"></p>
        </section>
        <section class="selection" aria-label="Đi quân bằng tọa độ">
          <div class="piece-control">
            <label for="piece">Quân đang chọn</label>
            <select id="piece"><option value="">Chọn quân</option></select>
          </div>
          <div class="targets" id="targets"></div>
          <form class="target-control" id="compact-move">
            <label for="target">Ô đến</label>
            <div>
              <select id="target"><option value="">Chọn ô</option></select>
              <button id="confirm-move" type="submit" disabled>Đi</button>
            </div>
          </form>
        </section>
        <ol id="log" aria-label="Nước đi gần nhất"></ol>
        <p class="muted" id="tip">Bấm quân của bên đang đi, rồi bấm ô sáng. Chọn Toàn bàn để thấy đủ bàn cờ.</p>
      </div>
    </aside>
  </div>
  </section>
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
const screens={start:get('start-screen'),random:get('random-screen'),play:get('play-screen')};
const setup=get<HTMLFormElement>('setup'), view=get<HTMLButtonElement>('view');
const sound=get<HTMLButtonElement>('sound'), settings=get<HTMLButtonElement>('settings');
const spin=get<HTMLButtonElement>('spin'), enter=get<HTMLButtonElement>('enter'), back=get<HTMLButtonElement>('back');
const wheel=get('wheel'), roll=get('roll'), detail=get('roll-detail');
const picker=get<HTMLSelectElement>('piece'), targets=get('targets');
const targetPicker=get<HTMLSelectElement>('target');
const confirmMove=get<HTMLButtonElement>('confirm-move');
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
let mode: Mode='periodic';
let message='';
let rolledMatch: Match | undefined;

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
  targetPicker.replaceChildren(new Option('Chọn ô',''), ...squares.map(square=>new Option(square,square)));
  targetPicker.disabled=busy || ended || !squares.length;
  confirmMove.disabled=true;
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

targetPicker.addEventListener('change',()=>{
  confirmMove.disabled=busy || !targetPicker.value;
});
get<HTMLFormElement>('compact-move').addEventListener('submit',event=>{
  event.preventDefault();
  if (!confirmMove.disabled && targetPicker.value) void choose(targetPicker.value as Square);
});
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
  stage.indicate(null);
  audio.stopAmbience();
  showScreen('start',get('start'));
});

function showScreen(active: keyof typeof screens, focus?: HTMLElement) {
  for (const [name,screen] of Object.entries(screens)) screen.hidden=name!==active;
  focus?.focus({preventScroll:true});
}

setup.addEventListener('submit',event=>{
  event.preventDefault();
  const options=new FormData(setup);
  setting=options.get('setting') as Setting;
  mode=options.get('mode') as Mode;
  rolledMatch=undefined;
  wheel.style.transform='';
  roll.textContent='';
  detail.textContent='Đổi chỗ · Dịch quân · Đổi kép';
  get('random-summary').textContent=locationName(setting)+' · '+(mode==='random' ? 'Bốc thời điểm' : modeName(mode));
  spin.hidden=spin.disabled=back.disabled=false;
  enter.hidden=true;
  showScreen('random',spin);
});
back.addEventListener('click',()=>showScreen('start',get('start')));
spin.addEventListener('click',async ()=>{
  if (spin.disabled) return;
  spin.disabled=back.disabled=true;
  const index=Math.floor(Math.random()*effects.length);
  const effect=effects[index];
  rolledMatch=new Match(mode,effect);
  const end='rotate('+(1080-index*120)+'deg)';
  roll.textContent='Đang quay…';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await wheel.animate([{transform:'rotate(0deg)'},{transform:end}],
      {duration:1050,easing:'cubic-bezier(.15,.62,.18,1)'}).finished;
  }
  wheel.style.transform=end;
  roll.textContent=effectNames[effect];
  detail.textContent=effectText[effect];
  get('random-summary').textContent=locationName(setting)+' · '+modeName(rolledMatch.mode);
  spin.hidden=true;
  enter.hidden=back.disabled=false;
  enter.focus({preventScroll:true});
});
enter.addEventListener('click',()=>{
  if (!rolledMatch || match) return;
  showScreen('play');
  if (!stage) {
    try {
      stage=new Stage(viewport);
      stage.onSquare=square=>void choose(square);
    } catch {
      showScreen('random',back);
      detail.textContent='Trình duyệt không khởi tạo được WebGL 2.';
      return;
    }
  }
  void audio.enable(setting).catch(()=>{});
  match=rolledMatch;
  message='';
  selected=undefined;
  overhead=false;
  get('location').textContent=locationName(setting);
  stage.setSetting(setting);
  stage.sync(match.chess.board());
  stage.frame('w',undefined,false,true);
  draw();
  picker.focus({preventScroll:true});
});
