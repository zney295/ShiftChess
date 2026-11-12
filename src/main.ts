import type { Square } from 'chess.js';
import { GameAudio } from './audio';
import { copy, type CopyKey, type Locale } from './copy';
import type { Setting } from './models';
import { effects, Match } from './rules';
import { Stage } from './stage';
import './style.css';

const host = document.querySelector<HTMLElement>('#app')!;
host.innerHTML = `
  <header class="masthead">
    <div class="wordmark"><span class="crest" aria-hidden="true">♞</span><span>ShiftChess</span></div>
    <div class="header-controls">
      <div class="actions" id="play-actions" hidden>
        <button id="view" type="button"></button>
        <button id="sound" type="button" aria-pressed="true"></button>
        <button id="settings" type="button" data-copy="restart"></button>
      </div>
      <button id="locale" class="locale" type="button"></button>
    </div>
  </header>
  <section id="start-screen" class="menu-screen" aria-labelledby="start-title">
    <div class="start-shell">
    <div class="start-art" aria-hidden="true"></div>
    <div class="start-panel">
      <header>
        <h1 id="start-title">ShiftChess</h1>
        <p class="muted" data-copy="subtitle"></p>
      </header>
      <button class="primary" id="start" type="button" data-copy="start"></button>
    </div>
    </div>
  </section>
  <section id="random-screen" class="menu-screen" aria-labelledby="random-title" hidden>
    <div class="menu-card random-card">
      <div class="random-info">
        <header>
          <h1 id="random-title" data-copy="roulette"></h1>
          <p class="muted" data-copy="mapHint"></p>
        </header>
        <output id="roll" aria-live="polite"></output>
        <p id="roll-detail" class="muted"></p>
        <div class="menu-actions">
          <button id="back" type="button" data-copy="back"></button>
          <button id="spin" class="primary" type="button" data-copy="spin"></button>
          <button id="enter" class="primary" type="button" data-copy="enter" hidden></button>
        </div>
      </div>
      <div class="wheel-wrap" aria-hidden="true">
        <div id="wheel" class="wheel"><b>♧</b><b>▤</b></div>
        <span class="wheel-needle"></span>
        <span class="wheel-hub" data-copy="map"></span>
      </div>
    </div>
  </section>
  <section id="play-screen" class="play-screen" data-label="play" hidden>
  <div class="layout">
    <section id="viewport" class="viewport playing">
      <div class="scene-tag" id="location"></div>
      <div class="flash" id="flash" aria-hidden="true"></div>
    </section>
    <aside class="sidebar">
      <div id="game">
        <div class="match-status">
          <div class="turn" id="turn" aria-live="polite"></div>
          <p class="muted" id="rule"></p>
        </div>
        <section class="event" data-label="event">
          <p class="eyebrow" id="shift-heading"></p>
          <p id="event" aria-live="polite"></p>
        </section>
        <section class="selection" data-label="coordinates">
          <div class="piece-control">
            <label for="piece" data-copy="piece"></label>
            <select id="piece"><option value="" data-copy="pickPiece"></option></select>
          </div>
          <div class="targets" id="targets"></div>
          <form class="target-control" id="compact-move">
            <label for="target" data-copy="target"></label>
            <div>
              <select id="target"><option value="" data-copy="pickTarget"></option></select>
              <button id="confirm-move" type="submit" data-copy="move" disabled></button>
            </div>
          </form>
        </section>
        <ol id="log" data-label="recent"></ol>
        <p class="muted" id="tip" data-copy="tip"></p>
      </div>
    </aside>
  </div>
  </section>
  <dialog id="promotion" aria-labelledby="promotion-title"><form method="dialog">
    <h2 id="promotion-title" data-copy="promotion"></h2>
    <div><button value="q" data-copy="q"></button><button value="r" data-copy="r"></button>
      <button value="b" data-copy="b"></button><button value="n" data-copy="n"></button></div>
  </form></dialog>
`;

const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const viewport=get('viewport');
const audio=new GameAudio();
let stage: Stage;
const screens={start:get('start-screen'),random:get('random-screen'),play:get('play-screen')};
const view=get<HTMLButtonElement>('view');
const sound=get<HTMLButtonElement>('sound'), settings=get<HTMLButtonElement>('settings');
const spin=get<HTMLButtonElement>('spin'), enter=get<HTMLButtonElement>('enter'), back=get<HTMLButtonElement>('back');
const wheel=get('wheel'), roll=get('roll'), detail=get('roll-detail');
const picker=get<HTMLSelectElement>('piece'), targets=get('targets');
const targetPicker=get<HTMLSelectElement>('target');
const confirmMove=get<HTMLButtonElement>('confirm-move');
const localeButton=get<HTMLButtonElement>('locale');
let locale: Locale='vi';
try {
  if (localStorage.getItem('shiftchess-language')==='en') locale='en';
} catch { /* Some embedded players disable storage. */ }
const t=(key: CopyKey)=>copy[locale][key];

let match: Match | undefined;
let selected: Square | undefined;
let overhead=false;
let busy=false;
const maps: Setting[]=['park','library'];
let setting: Setting | undefined;
let message: CopyKey | undefined;
let rollState: 'waiting' | 'spinning' | 'ready' | 'error' = 'waiting';

function drawRoulette() {
  roll.textContent=rollState==='spinning' ? t('spinning')
    : setting && (rollState==='ready' || rollState==='error') ? t(setting) : '';
  detail.textContent=rollState==='error' ? t('webgl')
    : rollState==='ready' ? t('mapReady') : '';
}

function draw(keepTarget=false) {
  if (!match || !setting) return;
  const {chess,pending,plies,effect}=match;
  const side=chess.turn();
  const mate=chess.isCheckmate(), ended=match.isEnded();
  const king=chess.isCheck() ? chess.board().flat().find(cell=>cell?.type==='k' && cell.color===side) : undefined;
  const legal=selected && !ended ? chess.moves({square:selected,verbose:true}) : [];
  const squares=[...new Set(legal.map(move=>move.to))];
  get('turn').textContent=mate ? t(side==='w' ? 'blackWins' : 'whiteWins') :
    ended ? t('draw') : t(side==='w' ? 'whiteTurn' : 'blackTurn')+(king ? ' · '+t('check') : '');
  get('rule').textContent=t(match.mode)+' · '+t(effect);
  get('shift-heading').textContent=plies===0 ? t('randomRule') : 'SHIFT';
  get('location').textContent=t(setting);
  stage.canvas.setAttribute('aria-label',t('board'));
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
    const remaining=pending.at-plies;
    countdown.textContent=t(remaining===1 ? 'oneMove' : 'manyMoves').replace('{n}',String(remaining));
    event.append(countdown);
  } else {
    event.textContent=t(message ?? (ended ? 'finished' :
      match.mode==='late' && plies>=24 ? 'lateDone' : `${effect}Text`));
  }
  const possible = new Set(chess.moves({verbose:true}).map(move=>move.from));
  picker.replaceChildren(new Option(t('pickPiece'),''));
  for (const cell of chess.board().flat()) {
    if (cell && cell.color===side && possible.has(cell.square)) {
      picker.add(new Option(t(cell.type)+' '+cell.square,cell.square));
    }
  }
  picker.value=selected ?? '';
  picker.disabled=busy || ended;
  const previousTarget=keepTarget ? targetPicker.value : '';
  targetPicker.replaceChildren(new Option(t('pickTarget'),''), ...squares.map(square=>new Option(square,square)));
  targetPicker.value=previousTarget;
  targetPicker.disabled=busy || ended || !squares.length;
  confirmMove.disabled=targetPicker.disabled || !targetPicker.value;
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
    li.textContent=entry==='shift-skipped' ? t('shiftSkippedLog') : entry;
    return li;
  }));
  view.textContent=t(overhead ? 'rider' : 'overview');
  view.disabled=settings.disabled=busy;
  stage.indicate(ended ? null : pending,selected,squares,king?.square);
}

function translate() {
  document.documentElement.lang=locale;
  for (const node of host.querySelectorAll<HTMLElement>('[data-copy]')) {
    node.textContent=t(node.dataset.copy as CopyKey);
  }
  for (const node of host.querySelectorAll<HTMLElement>('[data-label]')) {
    node.setAttribute('aria-label',t(node.dataset.label as CopyKey));
  }
  localeButton.textContent=locale==='vi' ? 'EN' : 'VI';
  localeButton.setAttribute('aria-label',t('switchLanguage'));
  sound.textContent=t(audio.muted ? 'soundOff' : 'soundOn');
  drawRoulette();
  draw(true);
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
    message=undefined;
    selected=undefined;
    await stage.move(move,overhead,()=>audio.move(Boolean(move.captured)));
    stage.sync(chess.board());
    const {due,applied,announced}=current.settle();
    if (due && applied) {
      message='shiftApplied';
      stage.frame(side,undefined,true);
      audio.cue(true);
      get('flash').classList.add('active');
      await stage.shift(due);
      get('flash').classList.remove('active');
      stage.sync(chess.board());
    } else if (due) message='shiftSkipped';
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
  sound.textContent=t(audio.muted ? 'soundOff' : 'soundOn');
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
  host.dataset.screen=active;
  get('play-actions').hidden=active!=='play';
  focus?.focus({preventScroll:true});
}

get('start').addEventListener('click',()=>{
  setting=undefined;
  wheel.style.transform='';
  rollState='waiting';
  drawRoulette();
  spin.hidden=spin.disabled=back.disabled=false;
  enter.hidden=true;
  showScreen('random',spin);
});
back.addEventListener('click',()=>showScreen('start',get('start')));
spin.addEventListener('click',async ()=>{
  if (spin.disabled) return;
  spin.disabled=back.disabled=true;
  const index=Math.floor(Math.random()*maps.length);
  const end='rotate('+(1080-index*180)+'deg)';
  rollState='spinning';
  drawRoulette();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await wheel.animate([{transform:'rotate(0deg)'},{transform:end}],
      {duration:1050,easing:'cubic-bezier(.15,.62,.18,1)'}).finished;
  }
  wheel.style.transform=end;
  setting=maps[index];
  rollState='ready';
  drawRoulette();
  spin.hidden=true;
  enter.hidden=back.disabled=false;
  enter.focus({preventScroll:true});
});
enter.addEventListener('click',()=>{
  if (!setting || match) return;
  showScreen('play');
  if (!stage) {
    try {
      stage=new Stage(viewport);
      stage.onSquare=square=>void choose(square);
    } catch {
      showScreen('random',back);
      rollState='error';
      drawRoulette();
      return;
    }
  }
  const effect=effects[Math.floor(Math.random()*effects.length)];
  match=new Match('random',effect);
  void audio.enable(setting).catch(()=>{});
  message=undefined;
  selected=undefined;
  overhead=false;
  stage.setSetting(setting);
  stage.sync(match.chess.board());
  stage.frame('w',undefined,false,true);
  draw();
  picker.focus({preventScroll:true});
});
localeButton.addEventListener('click',()=>{
  locale=locale==='vi' ? 'en' : 'vi';
  try { localStorage.setItem('shiftchess-language',locale); } catch { /* Keep the in-memory preference. */ }
  translate();
});
showScreen('start');
translate();
