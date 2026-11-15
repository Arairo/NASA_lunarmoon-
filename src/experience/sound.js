// Small sound kit made with the Web Audio API: no audio files, no licences.
// Browsers only allow sound after a click or key press, so the cinematic
// "ta-dum" plays when Start is pressed (like Netflix after choosing a profile).
// Muted state is remembered ('lsp.sound' = 'off').

let ctx = null;
let master = null;

export function soundOn() {
  try { return localStorage.getItem('lsp.sound') !== 'off'; } catch { return true; }
}

export function setSound(on) {
  try { localStorage.setItem('lsp.sound', on ? 'on' : 'off'); } catch {}
  document.querySelectorAll('[data-sound-label]').forEach((b) => {
    b.textContent = on ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Mute sounds' : 'Turn sounds on');
  });
  if (on) play('tick');
}
export const toggleSound = () => setSound(!soundOn());

function audio() {
  if (!soundOn()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(a, { type = 'sine', freq = 440, to = null, start = 0, dur = 0.3, gain = 0.3, attack = 0.01, filter = null }) {
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = o;
  if (filter) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filter[0], t0);
    f.frequency.exponentialRampToValueAtTime(filter[1], t0 + dur * 0.6);
    f.Q.value = 6;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(a, { start = 0, dur = 0.6, gain = 0.2, from = 400, to = 4000 }) {
  const t0 = a.currentTime + start;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.7);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

const SOUNDS = {
  // Cinematic opener: deep double hit and a bright swell (the "ta-dum").
  tadum(a) {
    tone(a, { type: 'sine', freq: 70, to: 38, dur: 1.1, gain: 0.9, attack: 0.005 });
    tone(a, { type: 'triangle', freq: 140, to: 70, dur: 0.5, gain: 0.35, attack: 0.005 });
    tone(a, { type: 'sine', freq: 62, to: 34, start: 0.32, dur: 2.2, gain: 1.0, attack: 0.005 });
    tone(a, { type: 'triangle', freq: 124, to: 62, start: 0.32, dur: 0.9, gain: 0.4, attack: 0.005 });
    [261.6, 329.6, 392, 523.3].forEach((f, i) =>
      tone(a, { type: 'sawtooth', freq: f, start: 0.34, dur: 2.6, gain: 0.07 - i * 0.008, attack: 0.5, filter: [300, 3200] }));
    noise(a, { start: 0.3, dur: 1.4, gain: 0.08, from: 300, to: 5000 });
  },
  // Choosing a mode: an airy whoosh and a soft two-note chime.
  whoosh(a) {
    noise(a, { dur: 0.7, gain: 0.22, from: 250, to: 6000 });
    tone(a, { freq: 659.3, start: 0.18, dur: 0.6, gain: 0.12 });
    tone(a, { freq: 987.8, start: 0.3, dur: 0.9, gain: 0.1 });
  },
  tick(a) { tone(a, { freq: 1200, to: 900, dur: 0.07, gain: 0.08, attack: 0.002 }); },
  pop(a) { tone(a, { type: 'triangle', freq: 520, to: 880, dur: 0.16, gain: 0.12, attack: 0.004 }); },
  go(a) { [523.3, 659.3, 784].forEach((f, i) => tone(a, { freq: f, start: i * 0.09, dur: 0.6, gain: 0.13 })); },
  care(a) { tone(a, { freq: 587.3, dur: 0.35, gain: 0.12 }); tone(a, { freq: 587.3, start: 0.22, dur: 0.45, gain: 0.1 }); },
  nogo(a) { tone(a, { type: 'triangle', freq: 330, dur: 0.35, gain: 0.14 }); tone(a, { type: 'triangle', freq: 247, start: 0.2, dur: 0.6, gain: 0.14 }); },
};

export function play(name) {
  const a = audio();
  if (!a || !SOUNDS[name]) return;
  try { SOUNDS[name](a); } catch {}
}
