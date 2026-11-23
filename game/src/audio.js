// Synthesised sound: WebAudio only, no audio files. Engine hum, siren,
// gunshots, punches, pickups and a small bass-driven music loop. Every
// method is a no-op until the player first interacts (browser policy)
// and while muted (M).
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    musicOn: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: null,
    musicStep: 0,
  };
  return audio;
}

function ensureContext(audio) {
  if (audio.ctx) return audio.ctx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio.ctx = new Ctx();
    return audio.ctx;
  } catch {
    return null;
  }
}

export function unlockAudio(audio) {
  const ctx = ensureContext(audio);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.engineGain) audio.engineGain.gain.value = 0;
  if (audio.sirenGain) audio.sirenGain.gain.value = 0;
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function blip(audio, freq, duration, type, volume, slideTo) {
  if (audio.muted) return;
  const ctx = ensureContext(audio);
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // audio is garnish; never break the game
  }
}

function noiseBurst(audio, duration, volume, lowpass) {
  if (audio.muted) return;
  const ctx = ensureContext(audio);
  if (!ctx) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 3000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    // ignore
  }
}

export function playShot(audio) {
  noiseBurst(audio, 0.14, 0.5, 2400);
  blip(audio, 220, 0.08, 'square', 0.12, 60);
}

export function playPunch(audio) {
  noiseBurst(audio, 0.08, 0.3, 900);
}

export function playCrash(audio) {
  noiseBurst(audio, 0.25, 0.5, 700);
}

export function playPickup(audio) {
  blip(audio, 660, 0.1, 'sine', 0.2);
  setTimeout(() => blip(audio, 990, 0.14, 'sine', 0.2), 90);
}

export function playMissionDone(audio) {
  [523, 659, 784, 1046].forEach((freq, i) => {
    setTimeout(() => blip(audio, freq, 0.18, 'triangle', 0.22), i * 110);
  });
}

export function playBusted(audio) {
  blip(audio, 330, 0.5, 'sawtooth', 0.15, 110);
}

// Continuous engine hum whose pitch follows speed (0..1).
export function setEngine(audio, speed01, driving) {
  if (audio.muted || !driving) {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
    return;
  }
  const ctx = ensureContext(audio);
  if (!ctx) return;
  try {
    if (!audio.engineOsc) {
      audio.engineOsc = ctx.createOscillator();
      audio.engineGain = ctx.createGain();
      audio.engineOsc.type = 'sawtooth';
      audio.engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      audio.engineOsc.connect(filter).connect(audio.engineGain).connect(ctx.destination);
      audio.engineOsc.start();
    }
    audio.engineOsc.frequency.value = 55 + speed01 * 140;
    audio.engineGain.gain.value = 0.03 + speed01 * 0.05;
  } catch {
    // ignore
  }
}

// Two-tone police siren while any police car is near.
export function setSiren(audio, on) {
  if (audio.muted || !on) {
    if (audio.sirenGain) audio.sirenGain.gain.value = 0;
    return;
  }
  const ctx = ensureContext(audio);
  if (!ctx) return;
  try {
    if (!audio.sirenOsc) {
      audio.sirenOsc = ctx.createOscillator();
      audio.sirenGain = ctx.createGain();
      audio.sirenOsc.type = 'triangle';
      audio.sirenGain.gain.value = 0.045;
      audio.sirenOsc.connect(audio.sirenGain).connect(ctx.destination);
      audio.sirenOsc.start();
      let high = true;
      audio.sirenTimer = setInterval(() => {
        if (!audio.sirenOsc) return;
        high = !high;
        audio.sirenOsc.frequency.value = high ? 880 : 660;
      }, 420);
    }
    audio.sirenGain.gain.value = 0.045;
  } catch {
    // ignore
  }
}

// A lazy bassline loop in A minor: root notes with a soft square wave.
const BASSLINE = [55, 55, 65.41, 49, 55, 55, 82.41, 65.41];
export function startMusic(audio) {
  if (audio.musicOn) return;
  audio.musicOn = true;
  audio.musicTimer = setInterval(() => {
    if (audio.muted || !audio.musicOn) return;
    const freq = BASSLINE[audio.musicStep % BASSLINE.length];
    audio.musicStep += 1;
    blip(audio, freq, 0.32, 'square', 0.05);
    if (audio.musicStep % 2 === 0) blip(audio, freq * 2, 0.12, 'sine', 0.03);
  }, 300);
}

export function stopMusic(audio) {
  audio.musicOn = false;
  if (audio.musicTimer) {
    clearInterval(audio.musicTimer);
    audio.musicTimer = null;
  }
}
