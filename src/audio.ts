import type { Setting } from "./models";

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private ambient?: GainNode;
  private effectsVolume = 0.75;
  private ambientVolume = 0.5;
  private noise?: AudioBuffer;
  private timer?: number;
  private ambience?: AudioBufferSourceNode;
  private setting: Setting = "park";
  muted = false;

  async enable(setting: Setting) {
    this.setting = setting;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.effects = this.context.createGain();
      this.ambient = this.context.createGain();
      this.effects.connect(this.master);
      this.ambient.connect(this.master);
      this.volumes(this.effectsVolume, this.ambientVolume);
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate * 2,
        this.context.sampleRate,
      );
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = Math.random() * 2 - 1;
    }
    await this.context.resume();
    this.master!.gain.value = this.muted ? 0 : 0.45;
    this.stopAmbience();
    const source = this.context.createBufferSource(),
      filter = this.context.createBiquadFilter(),
      gain = this.context.createGain();
    source.buffer = this.noise!;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = setting === "park" ? 640 : 135;
    gain.gain.value = setting === "park" ? 0.021 : 0.011;
    source.connect(filter).connect(gain).connect(this.ambient!);
    source.start();
    this.ambience = source;
    this.timer = window.setInterval(() => {
      if (this.setting === "park") {
        this.tone(1450, 1920, 0.09, 0.028, "sine", 0, true);
        this.tone(1890, 1490, 0.13, 0.023, "sine", 0.11, true);
      } else this.tap(0.13, 1200, 0.017, true);
    }, 7600);
  }

  stopAmbience() {
    this.ambience?.stop();
    this.ambience = undefined;
    clearInterval(this.timer);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
  }

  volumes(effects: number, ambient: number) {
    this.effectsVolume = effects;
    this.ambientVolume = ambient;
    if (this.effects) this.effects.gain.value = effects;
    if (this.ambient) this.ambient.gain.value = ambient;
  }

  select() {
    this.tone(530, 640, 0.055, 0.035, "sine");
  }
  result() {
    [392, 494, 587, 784].forEach((note, i) =>
      this.tone(note, note, 0.35, 0.08, "sine", i * 0.13),
    );
  }

  private tone(
    from: number,
    to: number,
    length: number,
    volume: number,
    type: OscillatorType,
    delay = 0,
    ambient = false,
  ) {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime + delay,
      note = this.context.createOscillator(),
      gain = this.context.createGain();
    note.type = type;
    note.frequency.setValueAtTime(from, t);
    note.frequency.exponentialRampToValueAtTime(to, t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    note.connect(gain).connect((ambient ? this.ambient : this.effects)!);
    note.start(t);
    note.stop(t + length);
  }

  private tap(length: number, frequency: number, volume: number, ambient=false) {
    if (!this.context || !this.master || !this.noise) return;
    const t = this.context.currentTime,
      source = this.context.createBufferSource(),
      filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.connect(filter).connect(gain).connect((ambient ? this.ambient : this.effects)!);
    source.start(t, Math.random(), length);
  }

  move(capture: boolean) {
    this.tap(
      capture ? 0.18 : 0.08,
      this.setting === "park" ? 2600 : 1000,
      capture ? 0.45 : 0.14,
    );
    this.tone(
      capture ? 180 : 124,
      58,
      capture ? 0.24 : 0.08,
      capture ? 0.32 : 0.11,
      "triangle",
    );
  }

  cue(shifted = false) {
    if (this.context && this.ambient) {
      const now = this.context.currentTime;
      this.ambient.gain.cancelScheduledValues(now);
      this.ambient.gain.setValueAtTime(this.ambientVolume * 0.3, now);
      this.ambient.gain.linearRampToValueAtTime(this.ambientVolume, now + 1.2);
    }
    const notes = shifted ? [311, 466, 622] : [392, 523];
    notes.forEach((note, i) =>
      this.tone(
        note,
        note * 1.01,
        0.29,
        shifted ? 0.15 : 0.08,
        "sine",
        i * 0.1,
      ),
    );
  }
}
