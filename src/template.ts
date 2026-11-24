import { icons, modeBanners, pieceSvg } from "./icons";
import { renderShowcaseBoards } from "./showcase";

const turnRing = '<svg class="turn-ring" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27"/><circle class="turn-sweep" cx="30" cy="30" r="27" pathLength="100"/></svg>';
const shiftRules = `
  <li class="briefing-rule-item"><span class="rule-icon">${icons.shiftGrid}</span><span data-copy="shiftNotice"></span></li>
  <li class="briefing-rule-item"><span class="rule-icon">${icons.shield}</span><span data-copy="shiftSafety"></span></li>
`;

export const template = `
  <section id="viewport" class="viewport playing" data-label="board">
    <div id="board-grid" class="board-grid" role="grid" data-label="board" hidden inert></div>
  </section>
  <div id="board-toast" class="board-toast" role="status">
    <div><strong id="board-toast-title"></strong><p id="board-toast-text"></p></div>
  </div>
  <section id="start-screen" class="menu-screen" aria-labelledby="start-title">
    <div class="start-shell">
      <div class="start-panel">
        <div class="start-panel-inner">
          <header class="start-hero">
            <div class="start-title-row">
              ${icons.brandMark}
              <div class="start-title-copy">
                <h1 id="start-title"><span class="brand-shift">Shift</span><span class="brand-chess">Chess</span></h1>
                <div class="start-sub-row">
                  <p class="muted" data-copy="subtitle"></p>
                  <span class="brand-cycle-pill" data-copy="showcaseCycle"></span>
                </div>
              </div>
            </div>
          </header>

          <div id="shift-showcase" class="start-shift-showcase" data-showcase="swap">
            <div class="showcase-header">
              <span class="showcase-badge">
                <span id="showcase-index" class="showcase-index">01</span>
                <span data-copy="showcaseTitle"></span>
              </span>
              <span id="showcase-tag" class="showcase-tag" data-copy="showcaseTagSwap"></span>
              <div class="showcase-nav">
                <button id="showcase-prev" class="showcase-arrow" type="button" data-label="showcasePrev" aria-label="Previous">‹</button>
                <button id="showcase-next" class="showcase-arrow" type="button" data-label="showcaseNext" aria-label="Next">›</button>
              </div>
            </div>
            <div class="showcase-stage" aria-hidden="true">
              ${renderShowcaseBoards()}
            </div>
            <p id="showcase-caption" class="showcase-caption" data-copy="showcaseCaptionSwap"></p>
            <div class="showcase-tabs" role="tablist" aria-label="SHIFT">
              <button type="button" class="showcase-tab" data-showcase-tab="swap" aria-selected="true">${icons.swapArrows}<span data-copy="showcaseTabSwap"></span><i class="tab-progress" aria-hidden="true"></i></button>
              <button type="button" class="showcase-tab" data-showcase-tab="slide" aria-selected="false">${icons.slideArrow}<span data-copy="showcaseTabSlide"></span><i class="tab-progress" aria-hidden="true"></i></button>
              <button type="button" class="showcase-tab" data-showcase-tab="clash" aria-selected="false">${icons.clashBurst}<span data-copy="showcaseTabClash"></span><i class="tab-progress" aria-hidden="true"></i></button>
            </div>
          </div>

          <div class="start-bottom">
            <div class="start-actions">
              <button class="primary" id="start" type="button"><span data-copy="start"></span>${icons.playArrow}</button>
              <button id="start-guide" type="button" data-open="help-dialog">${icons.guide}<span data-copy="help"></span></button>
              <button id="start-settings" type="button" data-open="preferences-dialog">${icons.settings}<span data-copy="preferences"></span></button>
            </div>
            <div id="start-profile" class="profile-strip">
              <div class="profile-meta">
                <strong id="profile-name"></strong>
                <span class="profile-scope" data-copy="localProfileLabel"></span>
              </div>
              <div class="profile-rating">
                <span class="profile-elo"><span data-copy="eloLabel"></span> <strong id="profile-elo-value">1200</strong></span>
                <span id="profile-record" class="profile-record"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section id="mode-screen" class="menu-screen" aria-labelledby="mode-title" hidden>
    <div class="mode-shell">
      <div class="mode-header">
        <div class="mode-header-left">
          <button id="mode-back" class="mode-back-button" type="button">
            <span class="back-arrow" aria-hidden="true">←</span>
            <span data-copy="back"></span>
          </button>
          <h1 id="mode-title" data-copy="chooseMode"></h1>
        </div>
        <div class="mode-profile-pill">
          <span id="mode-profile-name"></span>
          <span class="mode-profile-sep" aria-hidden="true">·</span>
          <span class="mode-profile-elo"><span data-copy="eloLabel"></span> <strong id="mode-profile-elo">1200</strong></span>
          <span class="mode-profile-scope" data-copy="localProfileLabel"></span>
        </div>
      </div>
      <p id="mode-error" role="alert"></p>
      <div class="mode-list">
        <button id="local-mode" class="mode-option" type="button">
          <div class="mode-banner-wrap">
            ${modeBanners.local}
            <span class="mode-rating-tag" data-rated="false" data-copy="unratedBadge"></span>
          </div>
          <div class="mode-card-body">
            <div class="mode-info">
              <strong class="mode-name" data-copy="localMode"></strong>
              <span class="mode-desc" data-copy="localHint"></span>
            </div>
            <div class="mode-action-hint">
              <span data-copy="playLocal"></span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </div>
        </button>
        <div class="mode-option bot-option">
          <div class="mode-banner-wrap">
            ${modeBanners.bot}
            <span id="bot-rating-tag" class="mode-rating-tag" data-rated="true"></span>
          </div>
          <div class="mode-card-body">
            <div id="bot-mode" class="mode-info">
              <strong class="mode-name" data-copy="botMode"></strong>
              <span class="mode-desc" data-copy="botHint"></span>
            </div>
            <div class="bot-fields">
              <label class="bot-field">
                <span class="bot-field-label" data-copy="difficulty"></span>
                <select id="difficulty">
                  <option value="easy" data-copy="easy"></option>
                  <option value="normal" selected data-copy="normal"></option>
                  <option value="expert" data-copy="expert"></option>
                </select>
              </label>
              <label class="bot-field">
                <span class="bot-field-label" data-copy="sideChoice"></span>
                <select id="bot-color">
                  <option value="w" data-copy="whiteSide"></option>
                  <option value="b" data-copy="blackSide"></option>
                  <option value="random" data-copy="randomTheme"></option>
                </select>
              </label>
            </div>
            <button id="start-bot" class="primary mode-submit" type="button" data-copy="enter"></button>
          </div>
        </div>
        <button id="online-mode" class="mode-option" type="button">
          <div class="mode-banner-wrap">
            ${modeBanners.online}
            <span class="mode-rating-tag" data-rated="true" data-copy="ratedBadge"></span>
          </div>
          <div class="mode-card-body">
            <div class="mode-info">
              <strong class="mode-name" data-copy="onlineMode"></strong>
              <span class="mode-desc" data-copy="onlineHint"></span>
            </div>
            <div class="mode-action-hint">
              <span data-copy="findMatch"></span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </section>

  <section id="online-screen" class="menu-screen" aria-labelledby="online-title" hidden>
    <div class="setup-shell online-shell">
      <h1 id="online-title" data-copy="onlineMode"></h1>
      <p id="online-error" class="muted" role="alert"></p>

      <div class="online-group quick-group">
        <div class="online-field">
          <label for="player-name" class="online-label" data-copy="playerName"></label>
          <input id="player-name" maxlength="24" autocomplete="nickname" value="Player" class="online-input">
        </div>
        <button id="quick" class="primary mode-submit" type="button" data-copy="quick"></button>
      </div>

      <div class="online-divider" role="separator">
        <span class="online-divider-line" aria-hidden="true"></span>
        <span class="online-divider-text" data-copy="orPrivateRoom"></span>
        <span class="online-divider-line" aria-hidden="true"></span>
      </div>

      <div class="online-group private-group">
        <button id="create-room" class="secondary-button create-room-btn" type="button" data-copy="createRoom"></button>
        <form id="join-form" class="join-room-card">
          <div class="room-code-field">
            <label for="room-code" class="online-label" data-copy="roomCode"></label>
            <input id="room-code" maxlength="6" data-label="roomCode" placeholder="ABC234" autocomplete="off" autocapitalize="characters" required pattern="[A-Za-z2-9]{6}" class="online-input room-code-input">
          </div>
          <div class="join-actions">
            <button value="join" type="submit" class="secondary-button" data-copy="joinRoom"></button>
            <button value="watch" type="submit" class="ghost-button" data-copy="spectate"></button>
          </div>
        </form>
      </div>

      <details id="server-config" class="server-config">
        <summary><span data-copy="serverSettings"></span><span id="server-status" class="server-status"></span></summary>
        <div class="server-config-body">
          <label for="server-url" data-copy="serverUrl"></label>
          <input id="server-url" type="url" placeholder="wss://…/socket" class="online-input">
          <p class="muted server-hint" data-copy="serverHint"></p>
        </div>
      </details>

      <div class="online-footer">
        <button class="mode-back-button online-back-btn" type="button" data-back="mode">
          <span class="back-arrow" aria-hidden="true">←</span>
          <span data-copy="back"></span>
        </button>
      </div>
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
      <section id="white-player" class="player-card white-player" data-side="w">
        <div class="player-token">${turnRing}<span class="player-avatar" aria-hidden="true">${pieceSvg("k", "light", "avatar-piece-svg")}</span><span class="turn-seconds" role="timer" data-label="turnClock"></span></div>
        <div class="player-details"><span id="white-clock" class="chess-clock" role="timer" data-label="whiteClock" hidden></span><div id="captured-white" class="captured-pieces" data-captured-side="b" data-label="capturedWhite"></div><span id="advantage-white" class="material-score"></span></div>
      </section>
      <section id="black-player" class="player-card black-player" data-side="b">
        <div class="player-token">${turnRing}<span class="player-avatar" aria-hidden="true">${pieceSvg("k", "dark", "avatar-piece-svg")}</span><span class="turn-seconds" role="timer" data-label="turnClock"></span></div>
        <div class="player-details"><span id="black-clock" class="chess-clock" role="timer" data-label="blackClock" hidden></span><div id="captured-black" class="captured-pieces" data-captured-side="w" data-label="capturedBlack"></div><span id="advantage-black" class="material-score"></span></div>
      </section>
    <div class="player-hud">
      <div id="turn-hud" class="hud-panel turn-hud" data-side="w">
        <span class="turn-dot" aria-hidden="true"></span>
        <div id="turn" class="turn-label" role="status" aria-live="polite"></div>
      </div>
      <section class="hud-panel event shift-widget" data-label="event">
        <div class="shift-bar-main">
          <button id="shift-info" type="button" data-label="sharedShift" aria-haspopup="dialog" aria-controls="shift-rules-dialog"><span class="shift-symbol" aria-hidden="true">${icons.swapArrows}</span><span id="shift-heading"></span><span class="info-symbol" aria-hidden="true">?</span></button>
          <div id="shift-pips" class="shift-pips" role="progressbar" aria-label="SHIFT" aria-valuemin="0" aria-valuemax="10" aria-valuenow="0"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <span id="shift-countdown" class="shift-countdown"></span>
        </div>
        <p id="event" aria-live="polite"></p>
      </section>
      <nav class="hud-panel board-tools" data-label="tools">
        <button class="icon-button history-link" type="button" data-open="history-dialog" data-tooltip="recent" aria-keyshortcuts="h">${icons.history}</button>
        <button id="play-settings" class="icon-button" type="button" data-open="preferences-dialog" data-tooltip="preferences" aria-haspopup="dialog" aria-controls="preferences-dialog">${icons.settings}</button>
        <button id="menu" class="icon-button" type="button" data-open="menu-dialog" data-tooltip="menu" aria-haspopup="dialog" aria-controls="menu-dialog">${icons.menu}</button>
      </nav>
    </div>
    <div id="shift-splash" class="shift-splash" aria-hidden="true" hidden>
      <strong id="shift-splash-title"></strong>
      <span id="shift-splash-text"></span>
    </div>
    <div id="simultaneous-banner" class="simultaneous-banner" role="status" aria-live="polite" hidden>
      <div class="simultaneous-copy">
        <strong id="simultaneous-title"></strong>
        <span id="simultaneous-detail"></span>
      </div>
      <div class="simultaneous-locks">
        <span id="lock-w" class="lock-pill" data-locked="false">${pieceSvg("k", "light", "lock-piece-svg")}</span>
        <span id="lock-b" class="lock-pill" data-locked="false">${pieceSvg("k", "dark", "lock-piece-svg")}</span>
      </div>
      <button id="simultaneous-handoff" class="primary" type="button" hidden></button>
    </div>
    <button id="reopen-result" class="reopen-result-btn primary" type="button" data-copy="showResult" hidden></button>
  </section>
  <dialog id="briefing" class="game-dialog briefing-modal" aria-labelledby="briefing-title">
    <div class="briefing-header">
      <h2 id="briefing-title" class="briefing-title"></h2>
      <div class="briefing-badges">
        <span id="briefing-badge-map" class="briefing-badge badge-map"></span>
        <span id="briefing-badge-timing" class="briefing-badge badge-timing"></span>
      </div>
      <p id="briefing-map" class="sr-only" aria-hidden="true"></p>
    </div>
    <div class="briefing-callout">
      <p id="briefing-effect" class="briefing-effect-text"></p>
    </div>
    <ul class="briefing-rules">
      ${shiftRules}
      <li class="briefing-rule-item">
        <span class="rule-icon">${icons.history}</span>
        <span data-copy="turnRule"></span>
      </li>
    </ul>
    <p id="briefing-status" role="status" hidden></p>
    <div class="menu-actions briefing-actions">
      <button id="briefing-leave" class="secondary-button" data-copy="leave"></button>
      <button id="accept-shift" class="primary mode-submit" data-copy="understood" autofocus></button>
    </div>
  </dialog>
  <dialog id="moves-dialog" class="game-dialog" data-label="coordinates">
    <div class="dialog-head"><h2 data-copy="coordinates"></h2><button data-close data-label="close" class="close-button">×</button></div>
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
              <button id="confirm-move" class="primary" type="submit" data-copy="move" disabled></button>
            </div>
          </form>
        </section>
  </dialog>
  <dialog id="history-dialog" class="game-dialog" data-label="recent">
    <div class="dialog-head"><h2 data-copy="recent"></h2><button data-close data-label="close" class="close-button">×</button></div>
    <ol id="log" data-label="recent"></ol>
    <button id="undo" type="button" data-copy="undo"></button>
  </dialog>
  <dialog id="help-dialog" class="game-dialog help-modal" data-label="help">
    <div class="dialog-head"><h2 data-copy="help"></h2><button data-close data-label="close" class="close-button">×</button></div>
    <p class="muted help-lead" id="tip" data-copy="tip"></p>
    <div class="guide-cards">
      <div class="guide-card">
        <span class="guide-card-icon guide-icon-cycle">${icons.shiftGrid}</span>
        <div>
          <strong data-copy="guideCycleTitle"></strong>
          <p data-copy="guideCycleBody"></p>
        </div>
      </div>
      <div class="guide-card">
        <span class="guide-card-icon guide-icon-morph">${icons.swapArrows}</span>
        <div>
          <strong data-copy="guideMorphTitle"></strong>
          <p data-copy="guideMorphBody"></p>
        </div>
      </div>
      <div class="guide-card">
        <span class="guide-card-icon guide-icon-shield">${icons.shield}</span>
        <div>
          <strong data-copy="guideClashTitle"></strong>
          <p data-copy="guideClashBody"></p>
        </div>
      </div>
    </div>
    <h3 class="shortcuts-heading" data-copy="shortcutsTitle"></h3>
    <dl class="shortcuts"><dt><kbd>Esc</kbd></dt><dd data-copy="menu"></dd><dt><kbd>F</kbd></dt><dd data-copy="fullscreen"></dd><dt><kbd>M</kbd></dt><dd data-copy="soundOn"></dd><dt><kbd>G</kbd></dt><dd data-copy="coordinates"></dd><dt><kbd>H</kbd></dt><dd data-copy="recent"></dd></dl>
  </dialog>
  <dialog id="menu-dialog" class="game-dialog" data-label="menu">
    <div class="dialog-head"><h2 data-copy="menu"></h2><button data-close data-label="close" class="close-button">×</button></div>
    <p id="rule" class="muted"></p>
    <p class="muted"><span id="match-identity"></span> · <span id="location"></span></p>
    <button class="primary" data-close data-copy="resume"></button>
    <button id="new-game" data-copy="restart"></button>
    <button id="resign" type="button" data-copy="resign"></button>
    <button id="settings" type="button" data-copy="preferences"></button>
    <button id="home" type="button" data-copy="leave"></button>
    <div class="game-tools">
      <button data-open="help-dialog" data-copy="help" aria-keyshortcuts="?"></button>
    </div>
  </dialog>
  <dialog id="preferences-dialog" class="game-dialog preferences-dialog" aria-labelledby="preferences-title">
    <div class="dialog-head">
      <h2 id="preferences-title" data-copy="preferences"></h2>
      <button data-close data-label="close" type="button" class="close-button" autofocus>×</button>
    </div>
    <div class="quick-actions">
      <button id="sound" type="button" aria-keyshortcuts="m">${icons.sound}<span id="sound-action"></span></button>
      <button id="fullscreen" type="button" aria-keyshortcuts="f">${icons.fullscreen}<span id="fullscreen-action"></span></button>
    </div>
    <p id="settings-notice" role="status"></p>
    <div class="settings-categories" role="tablist" data-label="preferences">
      <button id="tab-audio" type="button" role="tab" data-settings="audio" aria-controls="settings-audio" aria-selected="false" tabindex="-1" data-copy="audioSettings"></button>
      <button id="tab-visual" type="button" role="tab" data-settings="visual" aria-controls="settings-visual" aria-selected="true" data-copy="visualSettings"></button>
      <button id="tab-play" type="button" role="tab" data-settings="play" aria-controls="settings-play" aria-selected="false" tabindex="-1" data-copy="playSettings"></button>
    </div>
    <div id="settings-content" class="settings-content">
      <div class="settings-group" id="settings-audio" role="tabpanel" aria-labelledby="tab-audio" hidden>
        <div class="slider-row">
          <div class="slider-header">
            <label for="master-volume" data-copy="masterVolume">Âm lượng tổng</label>
            <span class="slider-value" id="master-volume-value">80%</span>
          </div>
          <input id="master-volume" type="range" min="0" max="100" value="80">
        </div>
        <div class="slider-row">
          <div class="slider-header">
            <label for="effects-volume" data-copy="effectsVolume"></label>
            <span class="slider-value" id="effects-volume-value">75%</span>
          </div>
          <input id="effects-volume" type="range" min="0" max="100" value="75">
        </div>
        <div class="slider-row">
          <div class="slider-header">
            <label for="ambient-volume" data-copy="ambientVolume"></label>
            <span class="slider-value" id="ambient-volume-value">20%</span>
          </div>
          <input id="ambient-volume" type="range" min="0" max="100" value="20">
        </div>
        <label class="toggle-row"><span data-copy="lobbySound"></span><input id="lobby-sound" type="checkbox"></label>
      </div>
      <div class="settings-group" id="settings-visual" role="tabpanel" aria-labelledby="tab-visual">
        <div class="setting-row"><label for="view" data-copy="boardView"></label><select id="view"><option value="3d" data-copy="rider"></option><option value="3d-high" data-copy="highView"></option><option value="2d" data-copy="overview"></option></select></div>
        <div class="setting-row"><label for="quality" data-copy="quality"></label><select id="quality"><option value="low" data-copy="low"></option><option value="high" data-copy="high" selected></option></select></div>
        <div class="setting-row"><label for="animation-speed" data-copy="animationSpeed">Tốc độ hiệu ứng</label><select id="animation-speed"><option value="normal" data-copy="normalAnimation"></option><option value="fast" data-copy="fast">Nhanh</option></select></div>
        <label class="toggle-row"><span data-copy="cameraShake">Rung camera</span><input id="camera-shake" type="checkbox" checked></label>
      </div>
      <div class="settings-group" id="settings-play" role="tabpanel" aria-labelledby="tab-play" hidden>
        <label class="toggle-row"><span data-copy="moveHints">Gợi ý nước đi</span><input id="move-hints" type="checkbox" checked></label>
        <label class="toggle-row"><span data-copy="autoQueen">Tự động phong Hậu</span><input id="auto-queen" type="checkbox"></label>
        <label class="toggle-row"><span data-copy="localFlip">Xoay bàn cờ theo lượt (1 máy)</span><input id="local-flip" type="checkbox" checked></label>
        <div class="setting-row"><label for="board-theme" data-copy="map"></label><select id="board-theme"><option value="random" data-copy="randomTheme">Ngẫu nhiên</option><option value="park" data-copy="park"></option><option value="library" data-copy="library"></option></select></div>
        <div class="setting-row"><label for="language" data-copy="language">Ngôn ngữ</label><select id="language" data-label="language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></div>
      </div>
    </div>
  </dialog>
  <dialog id="shift-rules-dialog" class="game-dialog briefing-modal" aria-labelledby="shift-rules-title">
    <div class="dialog-head">
      <h2 id="shift-rules-title" class="briefing-title"></h2>
      <button data-close data-label="close" type="button" class="close-button">×</button>
    </div>
    <div class="briefing-badges">
      <span id="shift-rules-badge-map" class="briefing-badge badge-map"></span>
      <span id="shift-rules-badge-timing" class="briefing-badge badge-timing"></span>
    </div>
    <p id="shift-rules-map" class="sr-only" aria-hidden="true"></p>
    <div class="briefing-callout">
      <p id="shift-rules-effect" class="briefing-effect-text"></p>
    </div>
    <ul class="briefing-rules">${shiftRules}</ul>
  </dialog>
  <dialog id="restart-dialog" class="game-dialog" data-label="restart">
    <h2 data-copy="restart"></h2><p id="restart-hint" data-copy="restartHint"></p>
    <div class="menu-actions"><button data-close data-copy="resume"></button><button id="confirm-restart" class="primary" data-copy="restart"></button></div>
  </dialog>
  <dialog id="result-dialog" class="game-dialog" aria-labelledby="result-title">
    <h2 id="result-title"></h2>
    <p id="result-detail" class="muted"></p>
    <div id="result-rating" class="result-rating" hidden>
      <div class="result-rating-head">
        <span id="result-rating-label" data-copy="ratingChangeLabel"></span>
        <span id="result-rating-scope" class="result-rating-scope" data-copy="localProfileLabel"></span>
      </div>
      <div id="result-rating-numbers" class="result-rating-numbers">
        <span id="result-elo-before" class="elo-before"></span>
        <span class="elo-arrow" aria-hidden="true">→</span>
        <strong id="result-elo-after" class="elo-after"></strong>
        <span id="result-elo-delta" class="elo-delta"></span>
      </div>
      <p id="result-rating-opponent" class="result-rating-opponent muted"></p>
    </div>
    <p id="result-unrated" class="result-unrated muted" hidden></p>
    <div class="menu-actions result-actions">
      <button id="result-inspect" type="button" class="secondary-button">${icons.inspect}<span data-copy="inspectBoard"></span></button>
      <button id="result-undo" type="button" data-copy="undo"></button>
      <button id="result-leave" type="button" data-copy="leave"></button>
      <button id="rematch" class="primary" type="button" data-copy="rematch"></button>
    </div>
  </dialog>
  <div id="loading" class="loading" role="status" hidden><span class="loading-piece" aria-hidden="true">${pieceSvg("n", "vermilion", "loading-piece-svg")}</span><p id="loading-label" data-copy="loading"></p><progress id="loading-progress" aria-labelledby="loading-label" max="3" value="0"></progress></div>
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
