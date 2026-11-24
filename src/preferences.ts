import type { GameAudio } from "./audio";
import type { Locale } from "./copy";

const preferencesKey = "shiftchess-preferences";
const defaults = {
  muted: false,
  lobbySound: false,
  master: 80,
  effects: 75,
  ambience: 22,
  quality: "high",
  speed: "normal",
  shake: true,
  hints: true,
  autoQueen: false,
  localFlip: true,
  theme: "random",
  language: "en",
  boardView: "3d",
} as const;
export type Preferences = {
  muted: boolean;
  lobbySound: boolean;
  master: number;
  effects: number;
  ambience: number;
  quality: "low" | "high";
  speed: "normal" | "fast";
  shake: boolean;
  hints: boolean;
  autoQueen: boolean;
  localFlip: boolean;
  theme: "random" | "park" | "library";
  language: Locale;
  boardView: "3d" | "3d-high" | "2d";
};
export function loadPreferences(): Preferences {
  const result: Preferences = { ...defaults };
  try {
    const previousLanguage = localStorage.getItem("shiftchess-language");
    if (previousLanguage === "vi" || previousLanguage === "en") result.language = previousLanguage;
    const saved = JSON.parse(localStorage.getItem(preferencesKey) ?? "null");
    if (!saved) return result;
    for (const key of ["master", "effects", "ambience"] as const) {
      if (typeof saved[key] === "number" && Number.isFinite(saved[key]))
        result[key] = Math.round(Math.min(100, Math.max(0, saved[key])));
    }
    for (const key of ["muted", "lobbySound", "shake", "hints", "autoQueen", "localFlip"] as const) {
      if (typeof saved[key] === "boolean") result[key] = saved[key];
    }
    if (saved.quality === "low" || saved.quality === "high") result.quality = saved.quality;
    if (saved.speed === "normal" || saved.speed === "fast") result.speed = saved.speed;
    if (["random", "park", "library"].includes(saved.theme)) result.theme = saved.theme;
    if (saved.language === "vi" || saved.language === "en") result.language = saved.language;
    if (saved.boardView === "2d" || saved.boardView === "3d-high") result.boardView = saved.boardView;
  } catch {}
  return result;
}

export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  } catch {}
}

export function bindPreferenceControls(preferences: Preferences, audio: GameAudio, hooks: {
  viewChanged: () => void;
  stageChanged: () => void;
  themeChanged: () => void;
  translate: () => void;
}) {
  const input = (id: string) => document.getElementById(id) as HTMLInputElement;
  const select = (id: string) => document.getElementById(id) as HTMLSelectElement;

  select("view").value = preferences.boardView;
  select("view").onchange = () => {
    preferences.boardView = select("view").value as Preferences["boardView"];
    hooks.viewChanged();
    savePreferences(preferences);
  };

  const categories = [...document.querySelectorAll<HTMLButtonElement>("[data-settings]")];
  function selectCategory(category: HTMLButtonElement) {
    for (const button of categories) {
      const selected = button === category;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      document.getElementById("settings-" + button.dataset.settings)!.hidden = !selected;
    }
    document.getElementById("settings-content")!.scrollTop = 0;
  }
  categories.forEach((category, index) => {
    category.onclick = () => selectCategory(category);
    category.onkeydown = (event) => {
      const last = categories.length - 1;
      const destinations: Record<string, number> = {
        ArrowLeft: index === 0 ? last : index - 1,
        ArrowRight: index === last ? 0 : index + 1,
        Home: 0,
        End: last,
      };
      const next = categories[destinations[event.key]];
      if (!next) return;
      event.preventDefault();
      selectCategory(next);
      next.focus();
    };
  });

  function applyVolumes() {
    audio.volumes(preferences.effects / 100, preferences.ambience / 100, preferences.master / 100);
  }
  function updateSliderDisplay(id: string, value: number) {
    const slider = input(id);
    if (!slider) return;
    slider.style.setProperty("--slider-pct", `${value}%`);
    const textEl = document.getElementById(`${id}-value`);
    if (textEl) textEl.textContent = `${Math.round(value)}%`;
  }
  for (const [id, key] of [["master-volume", "master"], ["effects-volume", "effects"], ["ambient-volume", "ambience"]] as const) {
    const slider = input(id);
    if (!slider) continue;
    slider.value = String(preferences[key]);
    updateSliderDisplay(id, preferences[key]);
    slider.oninput = () => {
      preferences[key] = slider.valueAsNumber;
      updateSliderDisplay(id, preferences[key]);
      applyVolumes();
      savePreferences(preferences);
    };
  }
  input("lobby-sound").checked = preferences.lobbySound;
  input("lobby-sound").onchange = () => {
    preferences.lobbySound = input("lobby-sound").checked;
    savePreferences(preferences);
    if (preferences.lobbySound) void audio.unlock().catch(() => {});
  };
  for (const [id, key] of [["camera-shake", "shake"], ["move-hints", "hints"], ["auto-queen", "autoQueen"], ["local-flip", "localFlip"]] as const) {
    const checkbox = input(id);
    if (!checkbox) continue;
    checkbox.checked = preferences[key];
    checkbox.onchange = () => {
      preferences[key] = checkbox.checked;
      if (key === "localFlip") hooks.viewChanged();
      else if (key !== "autoQueen") hooks.stageChanged();
      savePreferences(preferences);
    };
  }
  select("quality").value = preferences.quality;
  select("quality").onchange = () => {
    preferences.quality = select("quality").value === "low" ? "low" : "high";
    hooks.stageChanged();
    savePreferences(preferences);
  };
  select("animation-speed").value = preferences.speed;
  select("animation-speed").onchange = () => {
    preferences.speed = select("animation-speed").value === "fast" ? "fast" : "normal";
    hooks.stageChanged();
    savePreferences(preferences);
  };
  select("board-theme").value = preferences.theme;
  select("board-theme").onchange = () => {
    preferences.theme = select("board-theme").value as Preferences["theme"];
    savePreferences(preferences);
    hooks.themeChanged();
  };
  function setLanguage(next: Locale) {
    preferences.language = next;
    select("language").value = next;
    savePreferences(preferences);
    hooks.translate();
  }
  select("language").value = preferences.language;
  select("language").onchange = () => setLanguage(select("language").value === "en" ? "en" : "vi");

  applyVolumes();
}
