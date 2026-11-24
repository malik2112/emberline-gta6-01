// EMBERLINE audio — all sounds synthesized with WebAudio, no assets.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radioOn = false;
    this.radioTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.station = 0;
    this.stations = [
      { name: 'EMBER 87.5 — sunset drive', notes: [220, 277, 330, 392, 440] },
      { name: 'PIER FM — harbour nights', notes: [196, 247, 294, 370, 415] },
      { name: 'CRANE RADIO — dock static', notes: [165, 208, 247, 311, 370] },
    ];
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  _tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  blip(freq = 880, dur = 0.08) {
    if (!this.ensure()) return;
    this._tone(freq, dur, 'sine', 0.25);
  }

  gunshot() {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.14);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(this.master);
    src.start(t0);
    this._tone(140, 0.1, 'square', 0.18);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this._sirenOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 700;
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lg = this.ctx.createGain();
      lg.gain.value = 220;
      lfo.connect(lg);
      lg.connect(o.frequency);
      o.connect(g);
      g.connect(this.master);
      o.start();
      lfo.start();
      this._sirenOsc = o;
      this._sirenLfo = lfo;
      this._sirenGain = g;
    } else if (!on && this._sirenOsc) {
      try { this._sirenOsc.stop(); this._sirenLfo.stop(); } catch { /* already stopped */ }
      this._sirenOsc = null;
      this._sirenLfo = null;
      this._sirenGain = null;
    }
  }

  engine(speed01) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 55 + speed01 * 130;
    this.engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
  }

  engineStop() {
    if (this.engineGain) this.engineGain.gain.value = 0;
  }

  // Looped chord arpeggio: a tiny synth radio.
  radioToggle() {
    if (!this.ensure()) return null;
    this.radioOn = !this.radioOn;
    if (!this.radioOn) {
      window.clearInterval(this.radioTimer);
      this.radioTimer = null;
      return null;
    }
    const st = this.stations[this.station % this.stations.length];
    this.station += 1;
    let i = 0;
    const tick = () => {
      const n = st.notes[i % st.notes.length];
      this._tone(n, 0.32, 'triangle', 0.12);
      if (i % 4 === 0) this._tone(n / 2, 0.5, 'sine', 0.1);
      i += 1;
    };
    tick();
    this.radioTimer = window.setInterval(tick, 240);
    return st.name;
  }
}
