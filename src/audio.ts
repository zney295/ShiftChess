import type { Setting } from './models';

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private timer?: number;
  private ambience?: AudioBufferSourceNode;
  private setting: Setting = 'park';
  muted = false;

  async enable(setting: Setting) {
    this.setting=setting;
    if (!this.context) {
      this.context=new AudioContext();
      this.master=this.context.createGain();
      this.master.connect(this.context.destination);
      this.noise=this.context.createBuffer(1,this.context.sampleRate*2,this.context.sampleRate);
      const samples=this.noise.getChannelData(0);
      for (let i=0;i<samples.length;i++) samples[i]=Math.random()*2-1;
    }
    await this.context.resume();
    this.master!.gain.value=this.muted ? 0 : .45;
    this.ambience?.stop();
    clearInterval(this.timer);
    const source=this.context.createBufferSource(), filter=this.context.createBiquadFilter(), gain=this.context.createGain();
    source.buffer=this.noise!;
    source.loop=true;
    filter.type='lowpass';
    filter.frequency.value=setting==='park' ? 640 : 135;
    gain.gain.value=setting==='park' ? .021 : .011;
    source.connect(filter).connect(gain).connect(this.master!);
    source.start();
    this.ambience=source;
    this.timer=window.setInterval(()=>{
      if (this.setting==='park') {
        this.tone(1450,1920,.09,.028,'sine');
        this.tone(1890,1490,.13,.023,'sine',.11);
      } else this.tap(.13,1200,.017);
    },7600);
  }

  toggle() {
    this.muted=!this.muted;
    if (this.master) this.master.gain.value=this.muted ? 0 : .45;
  }

  private tone(from: number,to: number,length: number,volume: number,type: OscillatorType, delay=0) {
    if (!this.context || !this.master) return;
    const t=this.context.currentTime+delay, note=this.context.createOscillator(), gain=this.context.createGain();
    note.type=type;
    note.frequency.setValueAtTime(from,t);
    note.frequency.exponentialRampToValueAtTime(to,t+length);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,t+length);
    note.connect(gain).connect(this.master);
    note.start(t);
    note.stop(t+length);
  }

  private tap(length: number,frequency: number,volume: number) {
    if (!this.context || !this.master || !this.noise) return;
    const t=this.context.currentTime, source=this.context.createBufferSource(), filter=this.context.createBiquadFilter();
    const gain=this.context.createGain();
    source.buffer=this.noise;
    filter.type='bandpass';
    filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,t);
    gain.gain.exponentialRampToValueAtTime(.0001,t+length);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t,Math.random(),length);
  }

  move(capture: boolean) {
    this.tap(capture ? .18 : .08,this.setting==='park' ? 2600 : 1000,capture ? .45 : .14);
    this.tone(capture ? 180 : 124,58,capture ? .24 : .08,capture ? .32 : .11,'triangle');
  }

  cue(shifted=false) {
    const notes=shifted ? [311,466,622] : [392,523];
    notes.forEach((note,i)=>this.tone(note,note*1.01,.29,shifted ? .15 : .08,'sine',i*.10));
  }
}
