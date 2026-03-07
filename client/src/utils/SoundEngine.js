/**
 * SoundEngine.js
 * ──────────────────────────────────────────────────────────────────
 * Pure Web Audio API sound synthesis — zero external audio files.
 * Generates 6 ringtones + 3 notification tones entirely in-browser.
 *
 * Usage:
 *   import { SoundEngine } from './SoundEngine';
 *   const engine = SoundEngine.getInstance();
 *   engine.playRingtone('classic', 0.8);   // id, volume 0–1
 *   engine.stopRingtone();
 *   engine.playMessageTone('ding', 0.6);
 *   engine.playVideoCallTone('chime', 0.8);
 */

// ─── Tone definitions ─────────────────────────────────────────────────────────

/**
 * Each ringtone is a function that receives an AudioContext and volume,
 * and returns a { stop() } handle.
 */
const RINGTONE_PATTERNS = {

  // 1. Classic — two-tone telephone ring
  classic: (ctx, vol) => {
    const beep = (freq, t0, dur) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol * 0.28, t0 + 0.02);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    };
    const play = () => {
      const t = ctx.currentTime;
      beep(440, t + 0.00, 0.42);
      beep(480, t + 0.55, 0.42);
    };
    play();
    const id = setInterval(play, 3200);
    return { stop: () => clearInterval(id) };
  },

  // 2. Marimba — warm wooden chime (like iOS)
  marimba: (ctx, vol) => {
    const notes = [783.99, 659.25, 523.25, 659.25]; // G5 E5 C5 E5
    const play = () => {
      notes.forEach((freq, i) => {
        const t   = ctx.currentTime + i * 0.12;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        // Add slight harmonic for marimba warmth
        const osc2 = ctx.createOscillator();
        osc.connect(g); osc2.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.value = freq;
        osc2.type = 'sine';   osc2.frequency.value = freq * 2.01;
        g.gain.setValueAtTime(vol * 0.32, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.start(t); osc.stop(t + 0.6);
        osc2.start(t); osc2.stop(t + 0.6);
      });
    };
    play();
    const id = setInterval(play, 3000);
    return { stop: () => clearInterval(id) };
  },

  // 3. Digital — rising electronic pulse
  digital: (ctx, vol) => {
    const play = () => {
      const freqs = [880, 1100, 1320, 1760];
      freqs.forEach((freq, i) => {
        const t   = ctx.currentTime + i * 0.08;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(vol * 0.12, t);
        g.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.start(t); osc.stop(t + 0.15);
      });
    };
    play();
    const id = setInterval(play, 1600);
    return { stop: () => clearInterval(id) };
  },

  // 4. Nokia — legendary 8-note melody (Gran Vals excerpt)
  nokia: (ctx, vol) => {
    // E5 D5 F#4 G#4 C#5 B4 D4 E4
    const seq = [
      { f: 659.25, d: 0.18 }, { f: 587.33, d: 0.18 },
      { f: 369.99, d: 0.36 }, { f: 415.30, d: 0.36 },
      { f: 554.37, d: 0.18 }, { f: 493.88, d: 0.18 },
      { f: 293.66, d: 0.36 }, { f: 329.63, d: 0.54 },
    ];
    const play = () => {
      let t = ctx.currentTime + 0.05;
      seq.forEach(({ f, d }) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'square'; osc.frequency.value = f;
        g.gain.setValueAtTime(vol * 0.2, t);
        g.gain.linearRampToValueAtTime(0, t + d - 0.03);
        osc.start(t); osc.stop(t + d);
        t += d;
      });
    };
    play();
    const id = setInterval(play, 4500);
    return { stop: () => clearInterval(id) };
  },

  // 5. Chime — soft ethereal bell cluster
  chime: (ctx, vol) => {
    const bells = [
      { freq: 523.25, delay: 0.00, dur: 1.2 },  // C5
      { freq: 659.25, delay: 0.22, dur: 1.0 },  // E5
      { freq: 783.99, delay: 0.44, dur: 0.9 },  // G5
      { freq: 1046.5, delay: 0.66, dur: 1.4 },  // C6
    ];
    const play = () => {
      bells.forEach(({ freq, delay, dur }) => {
        const t   = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * 0.22, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur + 0.1);
      });
    };
    play();
    const id = setInterval(play, 3600);
    return { stop: () => clearInterval(id) };
  },

  // 6. Pulse — modern minimal triple-blip
  pulse: (ctx, vol) => {
    const play = () => {
      [0, 0.22, 0.44].forEach(delay => {
        const t   = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = 1047;
        g.gain.setValueAtTime(vol * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t); osc.stop(t + 0.2);
      });
    };
    play();
    const id = setInterval(play, 2400);
    return { stop: () => clearInterval(id) };
  },
};

// ─── Notification / message tones ─────────────────────────────────────────────

const MESSAGE_TONES = {

  ding: (ctx, vol) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 1318.5; // E6
    g.gain.setValueAtTime(vol * 0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.65);
  },

  pop: (ctx, vol) => {
    [0, 0.14].forEach((delay, i) => {
      const t   = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880 + i * 220, t);
      osc.frequency.exponentialRampToValueAtTime(440 + i * 110, t + 0.08);
      g.gain.setValueAtTime(vol * 0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.18);
    });
  },

  swoosh: (ctx, vol) => {
    const osc  = ctx.createOscillator();
    const g    = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    osc.connect(filt); filt.connect(g); g.connect(ctx.destination);
    osc.type = 'sawtooth';
    filt.type = 'lowpass'; filt.frequency.value = 800;
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(vol * 0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  },

  // silent
  silent: () => {},
};


// ─── Custom ringtone storage ──────────────────────────────────────────────────
// Custom ringtones stored as base64 data-URLs in localStorage.
const CUSTOM_KEY = {
  ring:    'vmeet_custom_ring_audio',
  video:   'vmeet_custom_ring_video',
  message: 'vmeet_custom_ring_message',
};

/** Get stored custom ringtone data-URL for a type, or null. */
export const getCustomRingtone = (type = 'ring') => {
  try { return localStorage.getItem(CUSTOM_KEY[type] ?? CUSTOM_KEY.ring) || null; } catch { return null; }
};

/** Store (or clear) a custom ringtone data-URL. */
export const setCustomRingtone = (type = 'ring', dataUrl) => {
  try {
    const key = CUSTOM_KEY[type] ?? CUSTOM_KEY.ring;
    if (dataUrl) localStorage.setItem(key, dataUrl);
    else         localStorage.removeItem(key);
  } catch { /* localStorage quota — silently skip */ }
};

/** Convert a File from <input type="file"> to a data-URL. */
export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload  = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.readAsDataURL(file);
});

// HTMLAudioElement helpers for custom file playback
const makeAudioLoop = (src, vol) => {
  const el = new Audio(src);
  el.loop   = true;
  el.volume = Math.max(0, Math.min(1, vol));
  el.play().catch(() => {});
  return { stop: () => { try { el.pause(); el.src = ''; } catch (_) {} } };
};

const playAudioOnce = (src, vol) => {
  const el = new Audio(src);
  el.volume = Math.max(0, Math.min(1, vol));
  el.play().catch(() => {});
};

// ─── Singleton engine ─────────────────────────────────────────────────────────

class SoundEngineClass {
  constructor() {
    this._ctx            = null;
    this._ringtoneHandle = null;
    this._videoHandle    = null;
  }

  _getCtx() {
    if (!this._ctx || this._ctx.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._ctx = new Ctx();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  /** Play audio call ringtone — custom file takes priority over synth */
  playRingtone(id = 'classic', vol = 0.8) {
    this.stopRingtone();
    const custom = getCustomRingtone('ring');
    if (custom) { this._ringtoneHandle = makeAudioLoop(custom, vol); return; }
    try {
      const ctx = this._getCtx();
      const fn  = RINGTONE_PATTERNS[id] ?? RINGTONE_PATTERNS.classic;
      this._ringtoneHandle = fn(ctx, Math.max(0, Math.min(1, vol)));
    } catch (_) {}
  }

  stopRingtone() {
    try { this._ringtoneHandle?.stop(); } catch (_) {}
    this._ringtoneHandle = null;
  }

  /** Play video call ringtone — custom file takes priority */
  playVideoCallTone(id = 'chime', vol = 0.8) {
    this.stopVideoCallTone();
    const custom = getCustomRingtone('video');
    if (custom) { this._videoHandle = makeAudioLoop(custom, vol); return; }
    try {
      const ctx = this._getCtx();
      const fn  = RINGTONE_PATTERNS[id] ?? RINGTONE_PATTERNS.chime;
      this._videoHandle = fn(ctx, vol);
    } catch (_) {}
  }

  stopVideoCallTone() {
    try { this._videoHandle?.stop(); } catch (_) {}
    this._videoHandle = null;
  }

  /** One-shot message tone — custom file takes priority */
  playMessageTone(id = 'ding', vol = 0.6) {
    const custom = getCustomRingtone('message');
    if (custom) { playAudioOnce(custom, vol); return; }
    try {
      const ctx = this._getCtx();
      const fn  = MESSAGE_TONES[id] ?? MESSAGE_TONES.ding;
      fn(ctx, Math.max(0, Math.min(1, vol)));
    } catch (_) {}
  }

  /** Preview ringtone for 3s then auto-stop. Custom file takes priority. */
  previewRingtone(id, vol, type = 'ring') {
    if (type === 'message') {
      this.playMessageTone(id, vol);
    } else if (type === 'video') {
      this.stopVideoCallTone();
      const custom = getCustomRingtone('video');
      if (custom) {
        this._videoHandle = makeAudioLoop(custom, vol);
        setTimeout(() => this.stopVideoCallTone(), 3000);
        return;
      }
      try {
        const ctx = this._getCtx();
        this._videoHandle = (RINGTONE_PATTERNS[id] ?? RINGTONE_PATTERNS.classic)(ctx, vol);
        setTimeout(() => this.stopVideoCallTone(), 3000);
      } catch (_) {}
    } else {
      this.stopRingtone();
      const custom = getCustomRingtone('ring');
      if (custom) {
        this._ringtoneHandle = makeAudioLoop(custom, vol);
        setTimeout(() => this.stopRingtone(), 3000);
        return;
      }
      try {
        const ctx = this._getCtx();
        this._ringtoneHandle = (RINGTONE_PATTERNS[id] ?? RINGTONE_PATTERNS.classic)(ctx, vol);
        setTimeout(() => this.stopRingtone(), 3000);
      } catch (_) {}
    }
  }

  /** Vibrate (mobile only) */
  vibrate(pattern = [200, 100, 200]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  }
}

export const SoundEngine = new SoundEngineClass();

// ─── Metadata for the UI ──────────────────────────────────────────────────────

export const RINGTONE_OPTIONS = [
  { id: 'classic',  label: 'Classic Ring',  desc: 'Traditional two-tone telephone ring'   },
  { id: 'marimba',  label: 'Marimba',       desc: 'Warm wooden chime melody'               },
  { id: 'digital',  label: 'Digital',       desc: 'Rising electronic pulse sequence'       },
  { id: 'nokia',    label: 'Nokia',         desc: 'Classic 8-note Gran Vals melody'        },
  { id: 'chime',    label: 'Chime',         desc: 'Soft ethereal bell cluster'             },
  { id: 'pulse',    label: 'Pulse',         desc: 'Modern minimal triple-blip'             },
];

export const MESSAGE_TONE_OPTIONS = [
  { id: 'ding',    label: 'Ding',    desc: 'Clean high-pitched bell'    },
  { id: 'pop',     label: 'Pop',     desc: 'Soft double-tap pop'        },
  { id: 'swoosh',  label: 'Swoosh',  desc: 'Quick rising swipe tone'    },
  { id: 'silent',  label: 'Silent',  desc: 'No notification sound'      },
];