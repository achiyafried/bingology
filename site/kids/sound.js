// Short Web Audio tones for the toddler games. Silent when muted or without Web Audio.
const TONES = {
  snap: [[520, 0, 0.09]],
  pair: [[660, 0, 0.1], [880, 0.1, 0.14]],
  win: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.25]],
};

export function makeSound(isMuted) {
  let ctx = null;
  const play = name => {
    try {
      if (isMuted()) return;
      if (!ctx) {
        if (typeof globalThis.AudioContext !== "function") return;
        ctx = new globalThis.AudioContext();
      }
      for (const [freq, at, dur] of TONES[name]) {
        const t = ctx.currentTime + at;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + dur);
      }
    } catch {}
  };
  return { snap: () => play("snap"), pair: () => play("pair"), win: () => play("win") };
}
