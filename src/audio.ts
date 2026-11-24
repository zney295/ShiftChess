import type { PieceSymbol } from "chess.js";
import type { Setting } from "./models";
import { createSoundscape } from "./soundscape";

const clampVolume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private ambient?: GainNode;
  private masterVolume = 0.8;
  private effectsVolume = 0.75;
  private ambientVolume = 0.22;
  private noise?: AudioBuffer;
  private ambience?: AudioBufferSourceNode;
  private ambienceGain?: GainNode;
  private ambientBuffers = new Map<Setting, AudioBuffer>();
  private activeEffects = new Set<AudioScheduledSourceNode>();
  private setting: Setting = "park";
  private enableVersion = 0;
  private lastHover = -Infinity;
  muted = false;

  async unlock() {
    if (!this.context) {
      if (typeof AudioContext === "undefined") return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.effects = this.context.createGain();
      this.ambient = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 12;
      limiter.ratio.value = 5;
      this.effects.connect(this.master);
      this.ambient.connect(this.master);
      this.master.connect(limiter).connect(this.context.destination);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      this.volumes(this.effectsVolume, this.ambientVolume, this.masterVolume);
    }
    try {
      await this.context.resume();
    } catch {
      // A later user gesture can retry when the browser blocks audio activation.
    }
  }

  async enable(setting: Setting) {
    this.setting = setting;
    const version = ++this.enableVersion;
    await this.unlock();
    if (!this.context || version !== this.enableVersion) return;
    this.stopAmbientSource();
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.ambientBuffer(setting);
    source.loop = true;
    gain.gain.setValueAtTime(0, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.context.currentTime + 1.2);
    source.connect(gain).connect(this.ambient!);
    source.start(0, Math.random() * source.buffer.duration);
    this.ambience = source;
    this.ambienceGain = gain;
  }

  stopAmbience() {
    ++this.enableVersion;
    this.stopAmbientSource();
  }

  private stopAmbientSource() {
    this.ambience?.stop();
    this.ambience?.disconnect();
    this.ambienceGain?.disconnect();
    this.ambience = undefined;
    this.ambienceGain = undefined;
  }

  toggle() {
    this.muted = !this.muted;
    this.volumes(this.effectsVolume, this.ambientVolume, this.masterVolume);
  }

  volumes(effects: number, ambient: number, master = this.masterVolume) {
    this.effectsVolume = clampVolume(effects);
    this.ambientVolume = clampVolume(ambient);
    this.masterVolume = clampVolume(master);
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const [node, volume] of [
      [this.master, this.muted ? 0 : this.masterVolume],
      [this.effects, this.effectsVolume],
      [this.ambient, this.ambientVolume],
    ] as const) {
      node?.gain.cancelScheduledValues(now);
      node?.gain.setTargetAtTime(volume, now, 0.025);
    }
  }

  select() {
    this.burst(0.022, 2200, 0.045);
    this.tone(650, 890, 0.075, 0.06);
  }

  move(capture: boolean, pieceType: PieceSymbol = "p") {
    const weight = { p: 0.65, n: 0.95, b: 0.85, r: 1.3, q: 1.45, k: 1.55 }[pieceType];
    const variation = 0.95 + Math.random() * 0.1;
    const body = 260 / weight * variation;
    const surface = this.setting === "park" ? 1 : 0.85;
    this.duck(capture ? 0.7 : 0.3);
    this.burst(0.035, 2400 / weight * surface, capture ? 0.24 : 0.11, 0, 1.5);
    this.burst(0.12, body * 2.5, capture ? 0.16 : 0.075, 0.008, 7);
    this.tone(body, body * 0.65, capture ? 0.2 : 0.12, capture ? 0.2 : 0.11, 0, "triangle");
    if (capture) {
      for (let i = 0; i < 4; i++) {
        const delay = 0.12 + i * 0.066;
        this.burst(0.025, 1500 + i * 320, 0.09 / (i + 1), delay, 3);
        this.tone(body * (1.4 + i * 0.1), body, 0.045, 0.045 / (i + 1), delay, "triangle");
      }
    }
  }

  shiftWarning() {
    this.duck(0.55);
    [659.25, 880, 987.77].forEach((note, i) => this.mallet(note, 0.1, i * 0.105));
  }

  shiftExecute(scale = 1) {
    const timing = Math.max(0.15, Math.min(1, scale));
    this.duck(timing);
    this.burst(0.42 * timing, 900, 0.13, 0, 0.65, true);
    [261.63, 392, 523.25].forEach((note, i) => {
      this.tone(note * 0.65, note, 0.36 * timing, 0.07, i * 0.045 * timing, "triangle", 0.1 * timing);
      this.mallet(note * 2, 0.1, (0.35 + i * 0.045) * timing);
    });
  }

  shiftLand(pair: number) {
    this.tone(91, 39, 0.3, 0.21, 0, "sine");
    this.burst(0.13, 940, 0.12, 0, 3);
    this.mallet(pair ? 698.46 : 523.25, 0.12, 0.025);
  }

  check() {
    this.duck(0.55);
    [440, 466.16].forEach((note, i) => this.mallet(note, 0.12, i * 0.14));
  }

  victory() {
    this.duck(1.4);
    [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => this.mallet(note, 0.14, i * 0.135));
    [523.25, 659.25, 783.99].forEach(note => this.tone(note, note, 0.7, 0.045, 0.46, "triangle"));
  }

  defeat() {
    this.duck(1.1);
    [523.25, 440, 349.23].forEach((note, i) => this.mallet(note, 0.09, i * 0.19));
  }

  draw() {
    this.duck(0.9);
    this.mallet(392, 0.075);
    this.mallet(523.25, 0.075, 0.16);
    this.tone(659.25, 659.25, 0.42, 0.035, 0.24);
  }

  uiClick() {
    this.burst(0.016, 1800, 0.035);
    this.tone(480, 610, 0.045, 0.035);
  }

  uiHover() {
    if (!this.context || this.context.currentTime - this.lastHover < 0.065) return;
    this.lastHover = this.context.currentTime;
    this.tone(820, 900, 0.035, 0.015);
  }

  filmCue(cue: "opening" | "shift" | "cut" | "mate") {
    if (cue === "opening") {
      [55, 82.41, 116.54].forEach((note, index) =>
        this.tone(note, note * 0.998, 7.8, 0.055 / (1 + index * 0.5), 0,
          "triangle", 1.35, (index - 1) * 0.42));
      for (let beat = 0; beat < 10; beat++) {
        const delay = beat * (0.85 - beat * 0.024);
        this.tone(66, 39, 0.26, 0.12, delay, "sine", 0.012);
        this.burst(0.026, 2100, 0.036, delay + 0.11, 5);
      }
    } else if (cue === "shift") {
      this.burst(0.66, 420, 0.18, 0, 0.8, true);
      this.tone(75, 32, 0.68, 0.23, 0.93, "sine");
      this.mallet(466.16, 0.095, 1.04);
      this.mallet(698.46, 0.058, 1.12);
    } else if (cue === "cut") {
      this.burst(0.28, 540, 0.09, 0, 0.72, true);
      this.tone(98, 64, 0.31, 0.07, 0.19, "sine", 0.035);
    } else {
      this.tone(88, 30, 1.25, 0.35, 0, "sine");
      this.burst(0.36, 630, 0.18, 0, 1.1);
      [110, 164.81, 220, 261.63].forEach((note, i) =>
        this.tone(note, note, 2.5, 0.058, i * 0.075, "triangle", 0.13, (i - 1.5) * 0.4));
    }
  }

  result() { this.victory(); }
  cue(shifted = false) {
    if (shifted) this.shiftExecute();
    else this.shiftWarning();
  }

  stopEffects() {
    for (const source of this.activeEffects) source.stop();
    this.activeEffects.clear();
  }

  private duck(duration: number) {
    if (!this.context || !this.ambient) return;
    const now = this.context.currentTime;
    this.ambient.gain.cancelScheduledValues(now);
    this.ambient.gain.setTargetAtTime(this.ambientVolume * 0.4, now, 0.025);
    this.ambient.gain.setTargetAtTime(this.ambientVolume, now + duration, 0.25);
  }

  private mallet(frequency: number, volume: number, delay = 0) {
    this.tone(frequency, frequency * 0.998, 0.36, volume, delay);
    this.tone(frequency * 2.76, frequency * 2.76, 0.065, volume * 0.25, delay);
    this.tone(frequency * 5.4, frequency * 5.4, 0.028, volume * 0.07, delay);
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.activeEffects.add(source);
    source.onended = () => {
      this.activeEffects.delete(source);
      source.disconnect();
      nodes.forEach(node => node.disconnect());
    };
  }

  private tone(from: number, to: number, length: number, volume: number, delay = 0,
    type: OscillatorType = "sine", attack = 0.004, pan = 0) {
    if (!this.context || !this.effects || this.muted) return;
    const t = this.context.currentTime + delay;
    const note = this.context.createOscillator();
    const gain = this.context.createGain();
    note.type = type;
    note.frequency.setValueAtTime(from, t);
    note.frequency.exponentialRampToValueAtTime(to, t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    note.connect(gain);
    if (pan) {
      const stereo = this.context.createStereoPanner();
      stereo.pan.value = pan;
      gain.connect(stereo).connect(this.effects);
      this.track(note, [gain, stereo]);
    } else {
      gain.connect(this.effects);
      this.track(note, [gain]);
    }
    note.start(t);
    note.stop(t + length);
  }

  private burst(length: number, frequency: number, volume: number, delay = 0,
    resonance = 1, swell = false) {
    if (!this.context || !this.effects || !this.noise || this.muted) return;
    const t = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noise;
    filter.type = "bandpass";
    filter.Q.value = resonance;
    filter.frequency.setValueAtTime(frequency, t);
    filter.frequency.exponentialRampToValueAtTime(frequency * (swell ? 3 : 0.65), t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + (swell ? length * 0.55 : 0.002));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.connect(filter).connect(gain).connect(this.effects);
    this.track(source, [filter, gain]);
    source.start(t, Math.random() * (1 - length), length);
  }

  private ambientBuffer(setting: Setting) {
    const cached = this.ambientBuffers.get(setting);
    if (cached) return cached;
    const buffer = createSoundscape(this.context!, setting);
    this.ambientBuffers.set(setting, buffer);
    return buffer;
  }
}
