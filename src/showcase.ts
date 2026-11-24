import { pieceGroup } from "./icons";

/**
 * Wide Cinematic 6x3 Tactical Diorama Showcase for SHIFT Mechanics.
 * Designed like a real strategy game ability preview: full-width sunlit board,
 * choreographed 3-phase animations, floating impact badges, and instant clarity.
 */

const CELL = 44;
const X0 = 38;
const Y0 = 6;
const FILES = ["b", "c", "d", "e", "f", "g"];
const RANKS = [5, 4, 3];

const cellX = (col: number) => X0 + col * CELL;
const cellY = (row: number) => Y0 + row * CELL;
const centerX = (col: number) => cellX(col) + CELL / 2;
const centerY = (row: number) => cellY(row) + CELL / 2;

function gridSquares() {
  let out = "";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const light = (row + col) % 2 === 0;
      out += `<rect x="${cellX(col)}" y="${cellY(row)}" width="${CELL}" height="${CELL}" fill="${light ? "#faf7f0" : "#c6d5e4"}"/>`;
    }
  }
  for (let col = 0; col < 6; col++) {
    out += `<text x="${centerX(col)}" y="151" text-anchor="middle" fill="#708096" font-family="ui-monospace,monospace" font-size="9.5" font-weight="700">${FILES[col]}</text>`;
  }
  for (let row = 0; row < 3; row++) {
    out += `<text x="24" y="${centerY(row) + 3}" text-anchor="middle" fill="#708096" font-family="ui-monospace,monospace" font-size="9.5" font-weight="700">${RANKS[row]}</text>`;
  }
  return out;
}

const baseBoard = `
  <rect x="${X0 - 3}" y="${Y0 - 3}" width="${6 * CELL + 6}" height="${3 * CELL + 6}" rx="9" fill="#ffffff" stroke="rgba(21,30,44,0.16)" stroke-width="1.4"/>
  <g clip-path="url(#sc-wide-clip)">${gridSquares()}</g>
`;

function defs(idSuffix: string) {
  return `
    <defs>
      <clipPath id="sc-wide-clip"><rect x="${X0}" y="${Y0}" width="${6 * CELL}" height="${3 * CELL}" rx="6"/></clipPath>
      <marker id="sc-arrow-v-${idSuffix}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M1 1.5 8.5 5 1 8.5Z" fill="#eb4d35"/>
      </marker>
      <marker id="sc-arrow-o-${idSuffix}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M1 1.5 8.5 5 1 8.5Z" fill="#e89c1c"/>
      </marker>
      <marker id="sc-arrow-j-${idSuffix}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M1 1.5 8.5 5 1 8.5Z" fill="#109b7e"/>
      </marker>
    </defs>
  `;
}

export function renderShowcaseBoards(): string {
  // Scene 1 (Swap + Square Morph):
  // c4 = (col 1, row 1) LIGHT square  <->  f4 = (col 4, row 1) DARK square (dx = +/- 132px)
  const swapScene = `
    <div class="showcase-scene scene-swap">
      <svg class="showcase-svg" viewBox="0 0 340 156" fill="none">
        ${defs("swap")}
        ${baseBoard}
        <!-- Context pawns framing a real middlegame -->
        <g opacity=".42" transform="translate(${cellX(0) + 8} ${cellY(2) + 7}) scale(0.86)">${pieceGroup("p", "light")}</g>
        <g opacity=".42" transform="translate(${cellX(5) + 8} ${cellY(0) + 7}) scale(0.86)">${pieceGroup("p", "dark")}</g>

        <!-- Target pair A frames on c4 (light) and f4 (dark) -->
        <g class="sc-swap-frames">
          <rect x="${cellX(1) + 2.5}" y="${cellY(1) + 2.5}" width="39" height="39" rx="5" fill="rgba(235,77,53,0.16)" stroke="#eb4d35" stroke-width="1.8"/>
          <rect x="${cellX(4) + 2.5}" y="${cellY(1) + 2.5}" width="39" height="39" rx="5" fill="rgba(235,77,53,0.22)" stroke="#eb4d35" stroke-width="1.8"/>
          <rect x="${cellX(1) + 27.5}" y="${cellY(1) + 2.5}" width="14" height="14" rx="3" fill="#eb4d35"/>
          <text x="${cellX(1) + 34.5}" y="${cellY(1) + 12.5}" text-anchor="middle" fill="#fff" font-family="Inter,sans-serif" font-size="8.5" font-weight="800">A</text>
          <rect x="${cellX(4) + 27.5}" y="${cellY(1) + 2.5}" width="14" height="14" rx="3" fill="#eb4d35"/>
          <text x="${cellX(4) + 34.5}" y="${cellY(1) + 12.5}" text-anchor="middle" fill="#fff" font-family="Inter,sans-serif" font-size="8.5" font-weight="800">A</text>
        </g>

        <!-- Wide sweeping opposing swap arcs -->
        <path class="sc-arc-top" d="M${centerX(1)} ${cellY(1) + 6} Q${(centerX(1) + centerX(4)) / 2} ${Y0 + 2} ${centerX(4) - 4} ${cellY(1) + 6}" stroke="#eb4d35" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="180" marker-end="url(#sc-arrow-v-swap)"/>
        <path class="sc-arc-bot" d="M${centerX(4)} ${cellY(1) + 38} Q${(centerX(1) + centerX(4)) / 2} ${Y0 + 3 * CELL - 4} ${centerX(1) + 4} ${cellY(1) + 38}" stroke="#e89c1c" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="180" marker-end="url(#sc-arrow-o-swap)"/>

        <!-- Square Morph golden diamond bursts on landing -->
        <g class="sc-morph-burst-a" transform="translate(${centerX(4)} ${centerY(1)})">
          <rect x="-15" y="-15" width="30" height="30" rx="5" transform="rotate(45)" stroke="#e89c1c" stroke-width="2.2" fill="rgba(232,156,28,0.22)"/>
        </g>
        <g class="sc-morph-burst-b" transform="translate(${centerX(1)} ${centerY(1)})">
          <rect x="-15" y="-15" width="30" height="30" rx="5" transform="rotate(45)" stroke="#e89c1c" stroke-width="2.2" fill="rgba(232,156,28,0.22)"/>
        </g>

        <!-- Piece A: White Knight on c4 -> flies +132px to f4 -> morphs into Gold Bishop -->
        <g class="sc-swap-piece-a">
          <g class="sc-piece-orig" transform="translate(${cellX(1) + 6} ${cellY(1) + 6})">${pieceGroup("n", "light")}</g>
          <g class="sc-piece-morphed" transform="translate(${cellX(1) + 6} ${cellY(1) + 6})">${pieceGroup("b", "ochre")}</g>
        </g>

        <!-- Piece B: Coral Bishop on f4 -> flies -132px to c4 -> morphs into Dark Knight -->
        <g class="sc-swap-piece-b">
          <g class="sc-piece-orig" transform="translate(${cellX(4) + 6} ${cellY(1) + 6})">${pieceGroup("b", "vermilion")}</g>
          <g class="sc-piece-morphed" transform="translate(${cellX(4) + 6} ${cellY(1) + 6})">${pieceGroup("n", "dark")}</g>
        </g>

        <!-- Floating pop-up callout pills appearing on morph impact -->
        <g class="sc-morph-callout" transform="translate(${centerX(4)} ${cellY(0) + 18})">
          <rect x="-26" y="-10" width="52" height="20" rx="10" fill="#151e2c"/>
          <text x="0" y="3.5" text-anchor="middle" fill="#ffd98a" font-family="Inter,sans-serif" font-size="10" font-weight="800">♞ → ♝</text>
        </g>
        <g class="sc-morph-callout" transform="translate(${centerX(1)} ${cellY(0) + 18})">
          <rect x="-26" y="-10" width="52" height="20" rx="10" fill="#151e2c"/>
          <text x="0" y="3.5" text-anchor="middle" fill="#ffd98a" font-family="Inter,sans-serif" font-size="10" font-weight="800">♝ → ♞</text>
        </g>
      </svg>
    </div>
  `;

  // Scene 2 (Tactical Slide):
  // White Rook on b3=(0,2) slides +176px right to empty f3=(4,2), opening file f onto Dark Queen at f5=(4,0)!
  const slideScene = `
    <div class="showcase-scene scene-slide">
      <svg class="showcase-svg" viewBox="0 0 340 156" fill="none">
        ${defs("slide")}
        ${baseBoard}
        <!-- Pawn wall blocking b3/c3 -->
        <g opacity=".55" transform="translate(${cellX(0) + 8} ${cellY(1) + 7}) scale(0.86)">${pieceGroup("p", "dark")}</g>
        <g opacity=".55" transform="translate(${cellX(1) + 8} ${cellY(1) + 7}) scale(0.86)">${pieceGroup("p", "dark")}</g>
        <!-- Enemy Queen on f5=(4,0) -->
        <g opacity=".9" transform="translate(${cellX(4) + 6} ${cellY(0) + 6})">${pieceGroup("q", "dark")}</g>

        <!-- Newly opened f-file emerald attack beam -->
        <g class="sc-open-file">
          <rect x="${cellX(4) + 4}" y="${cellY(0) + 4}" width="36" height="124" rx="6" fill="rgba(16,155,126,0.2)" stroke="#109b7e" stroke-width="1.6" stroke-dasharray="5 4"/>
          <circle cx="${centerX(4)}" cy="${centerY(0)}" r="18" stroke="#eb4d35" stroke-width="2" stroke-dasharray="4 3"/>
        </g>

        <!-- Linked Jade frames on b3 and f3 -->
        <rect x="${cellX(0) + 2.5}" y="${cellY(2) + 2.5}" width="39" height="39" rx="5" fill="rgba(16,155,126,0.14)" stroke="#109b7e" stroke-width="1.6"/>
        <rect x="${cellX(4) + 2.5}" y="${cellY(2) + 2.5}" width="39" height="39" rx="5" fill="rgba(16,155,126,0.22)" stroke="#109b7e" stroke-width="1.8"/>
        <circle cx="${centerX(4)}" cy="${centerY(2)}" r="8" stroke="#109b7e" stroke-width="2" stroke-dasharray="3 3"/>

        <!-- Glide rail b3 -> f3 -->
        <path class="sc-slide-rail" d="M${cellX(0) + 34} ${centerY(2)} H${cellX(4) + 8}" stroke="#109b7e" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="180" marker-end="url(#sc-arrow-j-slide)"/>

        <!-- Sliding Rook -->
        <g class="sc-slide-rook">${pieceGroup("r", "light")}</g>
      </svg>
    </div>
  `;

  // Scene 3 (Simultaneous Clash):
  // White Rook b4=(0,1) rushes +88px to d4=(2,1); Coral Rook f4=(4,1) rushes -88px to d4=(2,1) -> mutual annihilation!
  const clashScene = `
    <div class="showcase-scene scene-clash">
      <svg class="showcase-svg" viewBox="0 0 340 156" fill="none">
        ${defs("clash")}
        ${baseBoard}
        <!-- Context King observing from g5 -->
        <g opacity=".4" transform="translate(${cellX(5) + 8} ${cellY(0) + 7}) scale(0.86)">${pieceGroup("k", "dark")}</g>

        <!-- Secret move dotted paths converging on d4=(2,1) -->
        <line class="sc-clash-line-w" x1="${centerX(0) + 14}" y1="${centerY(1)}" x2="${centerX(2) - 10}" y2="${centerY(1)}" stroke="#4c5a70" stroke-width="2.2" stroke-dasharray="4 4"/>
        <line class="sc-clash-line-b" x1="${centerX(4) - 14}" y1="${centerY(1)}" x2="${centerX(2) + 10}" y2="${centerY(1)}" stroke="#eb4d35" stroke-width="2.2" stroke-dasharray="4 4"/>

        <!-- Collision square d4 highlight -->
        <rect class="sc-clash-tile" x="${cellX(2) + 2.5}" y="${cellY(1) + 2.5}" width="39" height="39" rx="5" fill="rgba(235,77,53,0.22)" stroke="#eb4d35" stroke-width="1.8"/>

        <!-- Starburst impact shockwave at d4 -->
        <g class="sc-clash-explosion" transform="translate(${centerX(2)} ${centerY(1)})">
          <circle r="19" stroke="#eb4d35" stroke-width="2.6"/>
          <circle r="11" stroke="#e89c1c" stroke-width="2"/>
          <path d="M-19 -19l8 8M19 -19l-8 8M-19 19l8-8M19 19l-8-8M0 -24v8M0 24v-8M-24 0h8M24 0h-8" stroke="#eb4d35" stroke-width="2.2" stroke-linecap="round"/>
        </g>

        <!-- White Rook rushing right from b4=(0,1) to d4=(2,1) -->
        <g class="sc-clash-piece-w">
          <g transform="translate(${cellX(0) + 6} ${cellY(1) + 6})">${pieceGroup("r", "light")}</g>
        </g>

        <!-- Coral Rook rushing left from f4=(4,1) to d4=(2,1) -->
        <g class="sc-clash-piece-b">
          <g transform="translate(${cellX(4) + 6} ${cellY(1) + 6})">${pieceGroup("r", "vermilion")}</g>
        </g>

        <!-- Floating ×2 clash pop badge -->
        <g class="sc-clash-callout" transform="translate(${centerX(2)} ${cellY(0) + 18})">
          <rect x="-24" y="-10" width="48" height="20" rx="10" fill="#eb4d35"/>
          <text x="0" y="3.5" text-anchor="middle" fill="#ffffff" font-family="Inter,sans-serif" font-size="10" font-weight="800">×2 OUT</text>
        </g>
      </svg>
    </div>
  `;

  return `${swapScene}${slideScene}${clashScene}`;
}
