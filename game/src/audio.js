// EMBERLINE — audio.js (round 3 re-author)
// Every sound is synthesised live with WebAudio — no audio files, no
// network. One-shots are short oscillator/noise envelopes; the engine,
// siren and the DOCK FM radio loop run as persistent nodes.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenTimer = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture; headless shot mode never calls it.
  init() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  get ready() { return !!this.ctx; }

  _noiseBuffer(seconds = 1) {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noiseBurst(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this._noiseBuffer(dur + 0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t);
    source.stop(t + dur + 0.02);
  }

  _sequence(freqs, stepMs, type, vol, dur) {
    freqs.forEach((f, i) => setTimeout(() => this._tone(f, dur, type, vol), i * stepMs));
  }

  shot() { this._noiseBurst(0.16, 0.5, 1800, 'highpass'); this._tone(160, 0.1, 'square', 0.25, 60); }
  dryClick() { this._tone(1200, 0.05, 'square', 0.12); }
  reload() { this._tone(500, 0.06, 'square', 0.15); setTimeout(() => this._tone(700, 0.06, 'square', 0.15), 120); }
  chime() { this._sequence([523, 659, 784], 90, 'sine', 0.22, 0.22); }
  cash() { this._sequence([880, 1174, 1568], 70, 'triangle', 0.2, 0.16); }
  thud() { this._noiseBurst(0.12, 0.4, 300); this._tone(90, 0.12, 'sine', 0.3, 45); }
  crash() { this._noiseBurst(0.35, 0.55, 500); this._tone(70, 0.3, 'sine', 0.35, 35); }
  door() { this._noiseBurst(0.08, 0.25, 900); }
  horn() { this._tone(370, 0.28, 'square', 0.12); this._tone(466, 0.28, 'square', 0.1); }
  busted() { this._sequence([392, 330, 262], 220, 'sawtooth', 0.16, 0.35); }
  missionStart() { this._sequence([262, 392, 523], 100, 'triangle', 0.2, 0.2); }

  engineStart() {
    if (!this.ready || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  engineSet(speed01, on) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(350 + speed01 * 1400, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0.0, t, 0.1);
  }

  engineStop() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
    this.engineOsc = null;
  }

  sirenStart() {
    if (!this.ready || this.sirenTimer) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.045;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.sirenOsc) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, this.ctx.currentTime, 0.05);
    }, 420);
  }

  sirenStop() {
    if (this.sirenTimer) { clearInterval(this.sirenTimer); this.sirenTimer = null; }
    if (this.sirenOsc) { try { this.sirenOsc.stop(); } catch (e) { /* noop */ } this.sirenOsc = null; }
  }

  // DOCK FM: a lazy minor-key synth loop — bass pulse, hat ticks, soft pad.
  musicStart() {
    if (!this.ready || this.musicTimer || !this.musicOn) return;
    const bassline = [
      55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0,
      55, 0, 55, 0, 65.4, 0, 55, 0, 82.4, 0, 73.4, 0, 65.4, 0, 58.3, 0,
    ];
    const stepDur = 60 / 96 / 4;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const step = this.musicStep;
      const freq = bassline[step % bassline.length];
      if (freq) this._tone(freq, stepDur * 0.95, 'triangle', 0.16);
      if (step % 4 === 2) this._noiseBurst(0.03, 0.05, 6000, 'highpass');
      if (step % 32 === 0) this._tone(220, 1.6, 'sine', 0.05);
      if (step % 32 === 16) this._tone(261.6, 1.6, 'sine', 0.05);
      this.musicStep++;
    }, stepDur * 1000);
  }

  musicStop() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.musicStart();
    else this.musicStop();
    return this.musicOn;
  }
}
