export const template = `
  <header class="masthead">
    <div class="wordmark"><span class="crest" aria-hidden="true">♞</span><span>ShiftChess</span></div>
    <div class="header-controls">
      <div class="actions" id="play-actions" hidden>
        <button id="view" type="button" aria-keyshortcuts="v"></button>
        <button id="menu" type="button" data-copy="menu" aria-keyshortcuts="Escape"></button>
      </div>
      <button id="locale" class="locale" type="button"></button>
      <button id="fullscreen" type="button" data-label="fullscreen" aria-keyshortcuts="f">⛶</button>
    </div>
  </header>
  <section id="start-screen" class="menu-screen" aria-labelledby="start-title">
    <div class="start-shell">
    <div class="start-illustration"><canvas class="start-art" aria-hidden="true"></canvas></div>
    <div class="start-panel">
      <header>
        <h1 id="start-title">ShiftChess</h1>
        <p class="muted" data-copy="subtitle"></p>
      </header>
      <button class="primary" id="start" type="button" data-copy="start"></button>
      <button class="text-button" data-open="help-dialog" data-copy="help"></button>
      <button class="text-button" data-open="preferences-dialog" data-copy="preferences"></button>
    </div>
    </div>
  </section>
  <section id="mode-screen" class="menu-screen" aria-labelledby="mode-title" hidden>
    <div class="mode-shell">
      <p class="step" data-copy="stepMode"></p>
      <h1 id="mode-title" data-copy="chooseMode"></h1>
      <p id="mode-error" role="alert"></p><div class="mode-list">
        <button id="local-mode" class="mode-option"><span class="mode-symbol" aria-hidden="true">♙♟</span><strong data-copy="localMode"></strong><span data-copy="localHint"></span></button>
        <button id="bot-mode" class="mode-option"><span class="mode-symbol" aria-hidden="true">♞</span><strong data-copy="botMode"></strong><span data-copy="botHint"></span></button>
        <button id="online-mode" class="mode-option"><span class="mode-symbol" aria-hidden="true">♜</span><strong data-copy="onlineMode"></strong><span data-copy="onlineHint"></span></button>
      </div>
      <button id="mode-back" class="text-button" data-copy="back"></button>
    </div>
  </section>
  <section id="bot-screen" class="menu-screen" aria-labelledby="bot-title" hidden>
    <div class="setup-shell"><h1 id="bot-title" data-copy="botMode"></h1><p class="muted" data-copy="botHint"></p>
      <label for="difficulty" data-copy="difficulty"></label><select id="difficulty"><option value="easy" data-copy="easy"></option><option value="normal" selected data-copy="normal"></option><option value="expert" data-copy="expert"></option></select>
      <div class="menu-actions"><button data-back="mode" data-copy="back"></button><button id="start-bot" class="primary" data-copy="enter"></button></div>
    </div>
  </section>
  <section id="online-screen" class="menu-screen" aria-labelledby="online-title" hidden>
    <div class="setup-shell"><h1 id="online-title" data-copy="onlineMode"></h1>
      <label for="player-name" data-copy="playerName"></label><input id="player-name" maxlength="24" autocomplete="nickname" value="Player">
      <button id="quick" class="primary wide" data-copy="quick"></button>
      <div class="room-entry"><button id="create-room" data-copy="createRoom"></button><form id="join-form"><input id="room-code" maxlength="6" data-label="roomCode" placeholder="ABC234" autocomplete="off" autocapitalize="characters" required pattern="[A-Za-z2-9]{6}"><button data-copy="joinRoom"></button></form></div>
      <p id="online-error" class="muted" role="alert"></p>
      <details class="server-config"><summary data-copy="serverSettings"></summary><label for="server-url" data-copy="serverUrl"></label><input id="server-url" type="url" placeholder="wss://…/socket"><p class="muted" data-copy="serverHint"></p></details>
      <button class="text-button" data-back="mode" data-copy="back"></button>
    </div>
  </section>
  <section id="lobby-screen" class="menu-screen" aria-labelledby="lobby-title" hidden>
    <div class="setup-shell"><h1 id="lobby-title" data-copy="lobby"></h1><p id="connection-state" role="status"></p>
      <div class="invite-code"><span data-copy="roomCode"></span><strong id="invite-code"></strong><button id="copy-code" data-copy="copyCode"></button></div>
      <ul id="players" class="players"></ul><p id="lobby-hint" class="muted"></p>
      <div class="menu-actions"><button id="cancel-online" data-copy="cancelSearch"></button><button id="ready" class="primary" data-copy="ready"></button></div>
    </div>
  </section>
  <section id="play-screen" class="play-screen" data-label="play" hidden>
  <div class="layout">
    <section id="viewport" class="viewport playing">
      <p id="board-toast" class="board-toast" role="status" hidden></p>
    </section>
    <aside class="sidebar">
      <div class="match-status">
        <div class="turn" id="turn" aria-live="polite"></div>
        <button class="history-link" data-open="history-dialog" data-copy="recent" aria-keyshortcuts="h"></button>
      </div>
      <section class="event" data-label="event">
        <button id="shift-info" type="button" data-label="sharedShift"><span id="shift-heading"></span></button>
        <p id="event" aria-live="polite"></p>
      </section>
    </aside>
  </div>
  </section>
  <dialog id="moves-dialog" class="game-dialog" data-label="coordinates">
    <div class="dialog-head"><h2 data-copy="coordinates"></h2><button data-close data-label="close">×</button></div>
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
  </dialog>
  <dialog id="history-dialog" class="game-dialog" data-label="recent">
    <div class="dialog-head"><h2 data-copy="recent"></h2><button data-close data-label="close">×</button></div>
    <ol id="log" data-label="recent"></ol>
  </dialog>
  <dialog id="help-dialog" class="game-dialog" data-label="help">
    <div class="dialog-head"><h2 data-copy="help"></h2><button data-close data-label="close">×</button></div>
        <p class="muted" id="tip" data-copy="tip"></p>
    <dl class="shortcuts"><dt><kbd>Esc</kbd></dt><dd data-copy="menu"></dd><dt><kbd>F</kbd></dt><dd data-copy="fullscreen"></dd><dt><kbd>V</kbd></dt><dd data-copy="overview"></dd><dt><kbd>M</kbd></dt><dd data-copy="soundOn"></dd><dt><kbd>G</kbd></dt><dd data-copy="coordinates"></dd><dt><kbd>H</kbd></dt><dd data-copy="recent"></dd></dl>
  </dialog>
  <dialog id="menu-dialog" class="game-dialog" data-label="menu">
    <div class="dialog-head"><h2 data-copy="menu"></h2><button data-close data-label="close">×</button></div>
    <p id="rule" class="muted"></p>
    <p class="muted"><span id="match-identity"></span> · <span id="location"></span></p>
    <button class="primary" data-close data-copy="resume"></button>
    <button id="open-preferences" data-copy="preferences"></button>
    <button id="resign" type="button" data-copy="resign"></button>
    <button id="settings" type="button" data-copy="restart"></button>
    <div class="game-tools">
      <button data-open="moves-dialog" data-copy="coordinates" aria-keyshortcuts="g"></button>
      <button data-open="help-dialog" data-copy="help" aria-keyshortcuts="?"></button>
    </div>
  </dialog>
  <dialog id="preferences-dialog" class="game-dialog" data-label="preferences">
    <div class="dialog-head"><h2 data-copy="preferences"></h2><button data-close data-label="close">×</button></div>
    <button id="sound" type="button" aria-pressed="true"></button>
    <label for="effects-volume" data-copy="effectsVolume"></label><input id="effects-volume" type="range" min="0" max="100" value="75">
    <label for="ambient-volume" data-copy="ambientVolume"></label><input id="ambient-volume" type="range" min="0" max="100" value="50">
    <label for="quality" data-copy="quality"></label><select id="quality"><option value="low" data-copy="low"></option><option value="high" data-copy="high" selected></option></select>
  </dialog>
  <dialog id="briefing" class="game-dialog" aria-labelledby="briefing-title">
    <p class="step" data-copy="sharedShift"></p><h2 id="briefing-title"></h2><p id="briefing-map" class="muted"></p>
    <p id="briefing-effect"></p><p class="muted" data-copy="shiftRules"></p>
    <button id="accept-shift" class="primary wide" data-copy="understood"></button>
  </dialog>
  <dialog id="result-dialog" class="game-dialog" aria-labelledby="result-title">
    <h2 id="result-title"></h2><p id="result-detail" class="muted"></p>
    <div class="menu-actions"><button id="result-leave" data-copy="leave"></button><button id="rematch" class="primary" data-copy="rematch"></button></div>
  </dialog>
  <div id="loading" class="loading" role="status" hidden><span class="loading-piece" aria-hidden="true">♞</span><p data-copy="loading"></p></div>
  <dialog id="leave-dialog" class="game-dialog" data-label="leaveTitle">
    <h2 data-copy="leaveTitle"></h2><p data-copy="leaveHint"></p>
    <div class="menu-actions"><button data-close data-copy="resume"></button><button id="leave" data-copy="leave"></button></div>
  </dialog>
  <dialog id="promotion" aria-labelledby="promotion-title"><form method="dialog">
    <h2 id="promotion-title" data-copy="promotion"></h2>
    <div><button value="q" data-copy="q"></button><button value="r" data-copy="r"></button>
      <button value="b" data-copy="b"></button><button value="n" data-copy="n"></button></div>
  </form></dialog>
`;
