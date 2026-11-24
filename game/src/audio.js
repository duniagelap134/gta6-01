// SOLMAR — all sound is synthesized with WebAudio: no audio files, no
// network. Everything is guarded, so a headless browser or a muted tab
// can never crash the game. Sound starts on the first real gesture.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) { /* sound is optional */ }
  }

  setEngine(speed, maxSpeed) {
    try {
      if (!this.ctx || !this.engineOsc) return;
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + (speed / maxSpeed) * 140, t, 0.1);
      this.engineGain.gain.setTargetAtTime(speed > 5 ? 0.035 : 0, t, 0.15);
    } catch (err) { /* sound is optional */ }
  }

  blip(freq, dur, type, vol) {
    try {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (err) { /* sound is optional */ }
  }

  shot() {
    try {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.09);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.14;
      src.connect(g);
      g.connect(this.ctx.destination);
      src.start(t);
    } catch (err) { /* sound is optional */ }
  }

  pickup() { this.blip(880, 0.12, 'sine', 0.08); setTimeout(() => this.blip(1320, 0.16, 'sine', 0.08), 90); }
  cash() { this.blip(660, 0.1, 'triangle', 0.09); setTimeout(() => this.blip(990, 0.18, 'triangle', 0.09), 80); }
  denied() { this.blip(160, 0.2, 'sawtooth', 0.07); }
}
