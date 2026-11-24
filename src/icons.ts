/**
 * Bespoke architectural Staunton SVG chess pieces and cohesive 20px UI iconography
 * designed specifically for ShiftChess's Obsidian Slate / Porcelain / Vermilion / Jade identity.
 */

export type PieceTone = "light" | "dark" | "vermilion" | "jade" | "ochre";

const tonePalette: Record<PieceTone, { fill: string; stroke: string; detail: string }> = {
  light: { fill: "#ffffff", stroke: "#1c2839", detail: "#94a3b8" },
  dark: { fill: "#1e2a3b", stroke: "#ffffff", detail: "#94a3b8" },
  vermilion: { fill: "#eb4d35", stroke: "#ffffff", detail: "#ffd0c7" },
  jade: { fill: "#109b7e", stroke: "#ffffff", detail: "#aef5e4" },
  ochre: { fill: "#f2a421", stroke: "#1f180b", detail: "#fff5dc" },
};

const piecePaths: Record<"k" | "q" | "r" | "b" | "n" | "p", (d: string) => string> = {
  k: (d) => `
    <path d="M16 4v4.2M13.8 6.1h4.4" stroke-width="1.8"/>
    <path d="M11.2 12.2c0-2.1 2.1-3.4 4.8-3.4s4.8 1.3 4.8 3.4c0 1.7-1.1 3.1-2.2 4.3l1.1 5.5H12.3l1.1-5.5c-1.1-1.2-2.2-2.6-2.2-4.3Z"/>
    <path d="M9.5 24.5h13l1 2.7H8.5l1-2.7Z"/>
    <path d="M12.2 22h7.6" stroke="${d}" stroke-width="1.2"/>
  `,
  q: (d) => `
    <circle cx="8" cy="10" r="1.4"/><circle cx="12" cy="7.5" r="1.4"/><circle cx="16" cy="6.5" r="1.5"/><circle cx="20" cy="7.5" r="1.4"/><circle cx="24" cy="10" r="1.4"/>
    <path d="M8.5 11.4 11 21.8h10l2.5-10.4-3.7 4.2-3.8-6.4-3.8 6.4-3.7-4.2Z"/>
    <path d="M9.4 24.4h13.2l1 2.8H8.4l1-2.8Z"/>
    <path d="M11.4 21.8h9.2" stroke="${d}" stroke-width="1.2"/>
  `,
  r: (d) => `
    <path d="M9.5 7.5h3v2.7h2V7.5h3v2.7h2V7.5h3v5.4l-2 1.8v7.1l1.8 2.4v3H9.7v-3l1.8-2.4v-7.1l-2-1.8V7.5Z"/>
    <path d="M11.8 14.7h8.4M11.5 21.8h9" stroke="${d}" stroke-width="1.2"/>
  `,
  b: (d) => `
    <circle cx="16" cy="6.2" r="1.6"/>
    <path d="M16 8.2c-3.1 2.2-4.6 5.2-4.2 8.2.3 2 1.4 3.4 1.4 5.4h5.6c0-2 1.1-3.4 1.4-5.4.4-3-1.1-6-4.2-8.2Z"/>
    <path d="M13.8 13.6 18.2 10.6" stroke="${d}" stroke-width="1.4"/>
    <path d="M9.5 24.4h13l1 2.8H8.5l1-2.8Z"/>
    <path d="M12.6 21.8h6.8" stroke="${d}" stroke-width="1.2"/>
  `,
  n: (d) => `
    <path d="M10.4 22.2c.4-3.2 2.4-5.6 4.4-7.4-1.3.4-3.1.8-4.5.4-.9-.3-1.3-1.2-.9-2.2.8-2 2.9-4.5 5.4-5.8l.9-1.9 2.3 1.5c3.5 1.1 5.4 4.4 5.2 9.2-.1 2.3-.7 4.4-1.5 6.2H10.4Z"/>
    <circle cx="14.3" cy="11.2" r="1" fill="${d}" stroke="none"/>
    <path d="M9.3 24.5h13.4l1 2.7H8.3l1-2.7Z"/>
  `,
  p: (d) => `
    <circle cx="16" cy="10.2" r="3.4"/>
    <path d="M13.2 14.3h5.6c-.4 2.8.8 5.2 2.4 7.5H10.8c1.6-2.3 2.8-4.7 2.4-7.5Z"/>
    <path d="M9.6 24.5h12.8l.9 2.7H8.7l.9-2.7Z"/>
    <path d="M12.5 21.8h7" stroke="${d}" stroke-width="1.2"/>
  `,
};

export function pieceGroup(
  type: "k" | "q" | "r" | "b" | "n" | "p",
  tone: PieceTone = "light",
) {
  const { fill, stroke, detail } = tonePalette[tone];
  return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${piecePaths[type](detail)}</g>`;
}

export function pieceSvg(
  type: "k" | "q" | "r" | "b" | "n" | "p",
  tone: PieceTone = "light",
  className = "piece-svg",
) {
  return `<svg class="${className}" viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">${pieceGroup(type, tone)}</svg>`;
}

const uiIcon = (body: string, cls = "ui-icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  playArrow: uiIcon('<path d="M5 12h13"/><path d="m13 6 6 6-6 6"/>'),
  guide: uiIcon('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2V5.5Z"/>'),
  settings: uiIcon('<path d="M4 7h4m4 0h8M4 17h10m4 0h2"/><circle cx="10" cy="7" r="2.4" fill="currentColor" fill-opacity=".18"/><circle cx="16" cy="17" r="2.4" fill="currentColor" fill-opacity=".18"/>'),
  history: uiIcon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>'),
  menu: uiIcon('<path d="M4 7h16M4 12h12M4 17h16"/>'),
  sound: uiIcon('<path d="M4 9.5h4.2L13 5.5v13l-4.8-4H4z" fill="currentColor" fill-opacity=".16"/><path class="sound-wave" d="M16.5 9a4.2 4.2 0 0 1 0 6M19.2 6.5a7.8 7.8 0 0 1 0 11"/><path class="sound-muted" d="m16.5 9.5 5 5m0-5-5 5"/>'),
  fullscreen: uiIcon('<path class="enter-fullscreen" d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/><path class="exit-fullscreen" d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/>'),
  shiftGrid: uiIcon('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" fill-opacity=".2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill="currentColor" fill-opacity=".2"/><path d="M14 6.5h4.5V11M10 17.5H5.5V13"/>'),
  shield: uiIcon('<path d="M12 3 5 6v5.2c0 4.9 3 8.1 7 9.8 4-1.7 7-4.9 7-9.8V6l-7-3Z" fill="currentColor" fill-opacity=".14"/><path d="m9.2 12 2 2 3.8-4"/>'),
  swapArrows: uiIcon('<path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3-3m-3 3 3 3"/>'),
  slideArrow: uiIcon('<path d="M4 12h15m0 0-4.5-4.5M19 12l-4.5 4.5"/><circle cx="5.5" cy="12" r="1.5" fill="currentColor"/>'),
  clashBurst: uiIcon('<path d="m5 5 6 6m8-6-6 6m-8 8 6-6m8 6-6-6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>'),
  inspect: uiIcon('<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>'),
  brandMark: `<svg class="brand-mark-svg" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="34" height="34" rx="9" fill="#ffffff" stroke="rgba(21,30,44,0.14)" stroke-width="1.2"/>
    <rect x="5" y="19" width="12" height="12" rx="3" fill="#e7e2d8"/>
    <rect x="19" y="5" width="12" height="12" rx="3" fill="#e7e2d8"/>
    <rect x="5" y="5" width="12" height="12" rx="3" fill="#eb4d35"/>
    <rect x="19" y="19" width="12" height="12" rx="3" fill="#109b7e"/>
    <path d="M13 11h7v7" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M23 25h-7v-7" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

/** Full-width sunlit illustrated tactical board banners with subtle live motion for the 3 Mode Cards */
export const modeBanners = {
  local: `<svg class="mode-miniboard mode-banner-svg" viewBox="0 0 280 108" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mb-bg-local" x1="0" y1="0" x2="280" y2="108" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f6f3ec"/><stop offset="100%" stop-color="#e5e9f0"/>
      </linearGradient>
    </defs>
    <rect width="280" height="108" rx="10" fill="url(#mb-bg-local)"/>
    <g transform="translate(88 10)">
      <rect width="104" height="88" rx="8" fill="#ffffff" stroke="rgba(21,30,44,0.12)"/>
      <g>
        <rect x="6" y="6" width="23" height="19" rx="2" fill="#d9e1ec"/><rect x="52" y="6" width="23" height="19" rx="2" fill="#d9e1ec"/>
        <rect x="29" y="25" width="23" height="19" rx="2" fill="#d9e1ec"/><rect x="75" y="25" width="23" height="19" rx="2" fill="#d9e1ec"/>
        <rect x="6" y="44" width="23" height="19" rx="2" fill="#d9e1ec"/><rect x="52" y="44" width="23" height="19" rx="2" fill="#d9e1ec"/>
        <rect x="29" y="63" width="23" height="19" rx="2" fill="#d9e1ec"/><rect x="75" y="63" width="23" height="19" rx="2" fill="#d9e1ec"/>
      </g>
      <path class="mb-dash-flow" d="M18 46c-4-18 10-32 34-32 14 0 25 5 31 13" stroke="#eb4d35" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 4"/>
      <path d="m78 27 6 1-1-6" stroke="#eb4d35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="mb-dash-flow" d="M86 42c4 18-10 32-34 32-14 0-25-5-31-13" stroke="#109b7e" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 4"/>
      <path d="m26 61-6-1 1 6" stroke="#109b7e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <g class="mb-float-a" transform="translate(50 54) scale(0.88)" fill="#ffffff" stroke="#1c2839" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${piecePaths.k("#94a3b8")}</g>
      <g class="mb-float-b" transform="translate(26 4) scale(0.88)" fill="#1e2a3b" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${piecePaths.k("#94a3b8")}</g>
    </g>
    <text x="18" y="92" fill="#546277" font-family="Inter,sans-serif" font-size="10" font-weight="700" letter-spacing="1.2">180° FLIP</text>
  </svg>`,

  bot: `<svg class="mode-miniboard mode-banner-svg" viewBox="0 0 280 108" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mb-bg-bot" x1="0" y1="0" x2="280" y2="108" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#fff4ef"/><stop offset="100%" stop-color="#f5eadc"/>
      </linearGradient>
    </defs>
    <rect width="280" height="108" rx="10" fill="url(#mb-bg-bot)"/>
    <g transform="translate(88 10)">
      <rect width="104" height="88" rx="8" fill="#ffffff" stroke="rgba(235,77,53,0.28)"/>
      <g>
        <rect x="6" y="6" width="23" height="19" rx="2" fill="#ede4d8"/><rect x="52" y="6" width="23" height="19" rx="2" fill="#ede4d8"/>
        <rect x="29" y="25" width="23" height="19" rx="2" fill="#ede4d8"/><rect x="75" y="25" width="23" height="19" rx="2" fill="#ede4d8"/>
        <rect x="6" y="44" width="23" height="19" rx="2" fill="#ede4d8"/><rect x="52" y="44" width="23" height="19" rx="2" fill="#ede4d8"/>
        <rect x="29" y="63" width="23" height="19" rx="2" fill="#ede4d8"/><rect x="75" y="63" width="23" height="19" rx="2" fill="#ede4d8"/>
      </g>
      <rect class="mb-pulse-tile" x="29" y="25" width="23" height="19" rx="2" fill="rgba(235,77,53,0.22)" stroke="#eb4d35" stroke-width="1.6"/>
      <rect class="mb-pulse-tile" x="52" y="44" width="23" height="19" rx="2" fill="rgba(242,164,33,0.25)" stroke="#e89c1c" stroke-width="1.6"/>
      <path class="mb-dash-flow" d="M44 26c16-10 34 2 25 22" stroke="#eb4d35" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 3"/>
      <path d="m66 44 2 5 5-2" stroke="#eb4d35" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <g class="mb-float-a" transform="translate(26 19) scale(0.86)" fill="#ffffff" stroke="#1c2839" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${piecePaths.n("#94a3b8")}</g>
      <g class="mb-float-b" transform="translate(50 38) scale(0.86)" fill="#eb4d35" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${piecePaths.b("#ffd0c7")}</g>
    </g>
    <text x="18" y="92" fill="#c4472c" font-family="Inter,sans-serif" font-size="10" font-weight="700" letter-spacing="1">AI · SHIFT</text>
  </svg>`,

  online: `<svg class="mode-miniboard mode-banner-svg" viewBox="0 0 280 108" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mb-bg-online" x1="0" y1="0" x2="280" y2="108" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#edf9f5"/><stop offset="100%" stop-color="#dff2ed"/>
      </linearGradient>
    </defs>
    <rect width="280" height="108" rx="10" fill="url(#mb-bg-online)"/>
    <g transform="translate(36 16)">
      <rect width="72" height="76" rx="8" fill="#ffffff" stroke="rgba(21,30,44,0.12)"/>
      <rect x="6" y="6" width="30" height="32" rx="2" fill="#dbeee8"/><rect x="36" y="38" width="30" height="32" rx="2" fill="#dbeee8"/>
      <g class="mb-float-a" transform="translate(21 22) scale(0.95)" fill="#1e2a3b" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${piecePaths.r("#94a3b8")}</g>
    </g>
    <g transform="translate(172 16)">
      <rect width="72" height="76" rx="8" fill="#ffffff" stroke="rgba(16,155,126,0.34)"/>
      <rect x="6" y="6" width="30" height="32" rx="2" fill="#dbeee8"/><rect x="36" y="38" width="30" height="32" rx="2" fill="#dbeee8"/>
      <g class="mb-float-b" transform="translate(21 22) scale(0.95)" fill="#109b7e" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${piecePaths.r("#aef5e4")}</g>
    </g>
    <path class="mb-dash-flow" d="M114 54h52" stroke="#109b7e" stroke-width="2.2" stroke-dasharray="5 4"/>
    <circle class="mb-pulse-node" cx="140" cy="54" r="12" fill="#ffffff" stroke="#109b7e" stroke-width="2"/>
    <circle cx="140" cy="54" r="4.5" fill="#109b7e"/>
    <text x="124" y="94" fill="#0d7d66" font-family="ui-monospace,monospace" font-size="9.5" font-weight="700" letter-spacing="1.4">LIVE</text>
  </svg>`,
};
