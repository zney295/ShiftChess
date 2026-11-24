import type { Setting } from "./models";

export function createSoundscape(context: AudioContext, setting: Setting) {
  const park = setting === "park";
  const seconds = 16;
  const rate = context.sampleRate;
  const buffer = context.createBuffer(2, seconds * rate, rate);
  const events = park
    ? [1.7, 2.04, 6.8, 7.13, 7.46, 12.4].map((start, index) => ({
        start, length: 0.16 + Math.random() * 0.1, tone: 2050 + index % 3 * 380,
      }))
    : [3.1, 8.4, 13.2].map((start) => ({ start, length: 0.38 + Math.random() * 0.3, tone: 0 }));
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    const smoothing = 1 - Math.exp(-2 * Math.PI * (park ? 240 : 90) / rate);
    let bed = 0;
    for (let i = 0; i < samples.length; i++) {
      bed += (Math.random() * 2 - 1 - bed) * smoothing;
      const position = i / samples.length;
      const edge = Math.min(1, i / (rate * 0.08), (samples.length - 1 - i) / (rate * 0.08));
      const swell = 0.65 + 0.24 * Math.sin(position * Math.PI * 6 + channel * 0.35);
      samples[i] = bed * swell * edge * (park ? 0.055 : 0.036);
    }
    for (const [index, { start, length, tone }] of events.entries()) {
      const pan = index % 2 === channel ? 1 : 0.55;
      const first = Math.floor(start * rate);
      const count = Math.floor(length * rate);
      let rustle = 0;
      for (let i = 0; i < count; i++) {
        const t = i / rate;
        const phase = i / count;
        const envelope = Math.sin(Math.PI * phase) ** 2;
        rustle += (Math.random() * 2 - 1 - rustle) * 0.17;
        const sound = park ? Math.sin(2 * Math.PI * (tone * t - 1550 * t * t)) : rustle;
        samples[first + i] += sound * envelope * pan * (park ? 0.009 : 0.035);
      }
    }
  }
  return buffer;
}
