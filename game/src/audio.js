// All sound is synthesised with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, pickups, a mission jingle and a looping bassline.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: a triangle that wails between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function setEngine(speedRatio, driving) {
    if (!ctx || !engineOsc) return;
    const target = driving ? 0.05 + speedRatio * 0.09 : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, ctx.currentTime, 0.1);
    engineOsc2.frequency.setTargetAtTime(26 + speedRatio * 62, ctx.currentTime, 0.1);
  }

  function setSiren(on) {
    if (!ctx || !sirenOsc) return;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    if (on) {
      const now = ctx.currentTime;
      sirenOsc.frequency.cancelScheduledValues(now);
      sirenOsc.frequency.setValueAtTime(660, now);
      for (let i = 0; i < 6; i += 1) {
        sirenOsc.frequency.linearRampToValueAtTime(i % 2 === 0 ? 880 : 660, now + (i + 1) * 0.45);
      }
    }
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, type, volume, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // A lazy synthwave bassline: A minor, 8 steps a bar, kick on the beat.
  const BASS = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const step = musicStep % 16;
      const note = BASS[step];
      if (note > 0) tone(note, 0.22, 'triangle', 0.12);
      if (step % 4 === 0) tone(48, 0.12, 'sine', 0.22);
      if (step % 4 === 2) noiseBurst(0.05, 0.05, 6000);
      musicStep += 1;
    }, 150);
  }

  return {
    ensure,
    resume,
    set started(v) { started = v; },
    get started() { return started; },
    setEngine,
    setSiren,
    gunshot() { noiseBurst(0.14, 0.5, 2800); tone(160, 0.08, 'square', 0.18); },
    crash() { noiseBurst(0.3, 0.4, 900); },
    pickup() { tone(880, 0.12, 'sine', 0.25); tone(1320, 0.16, 'sine', 0.22, 0.09); },
    missionDone() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, i * 0.11));
    },
    missionFail() { tone(220, 0.4, 'sawtooth', 0.2); tone(174, 0.5, 'sawtooth', 0.2, 0.15); },
    click() { tone(660, 0.06, 'square', 0.15); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
