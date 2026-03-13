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

const RINGTONE_PATTERNS = {
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

  marimba: (ctx, vol) => {
    const notes = [783.99, 659.25, 523.25, 659.25];
    const play = () => {
      notes.forEach((freq, i) => {
        const t   = ctx.currentTime + i * 0.12;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
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

  nokia: (ctx, vol) => {
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

  chime: (ctx, vol) => {
    const bells = [
      { freq: 523.25, delay: 0.00, dur: 1.2 },
      { freq: 659.25, delay: 0.22, dur: 1.0 },
      { freq: 783.99, delay: 0.44, dur: 0.9 },
      { freq: 1046.5, delay: 0.66, dur: 1.4 },
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
    osc.type = 'sine'; osc.frequency.value = 1318.5;
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

  silent: () => {},
};

// ─── Custom ringtone storage ──────────────────────────────────────────────────

const CUSTOM_KEY = {
  ring:    'vmeet_custom_ring_audio',
  video:   'vmeet_custom_ring_video',
  message: 'vmeet_custom_ring_message',
};

export const getCustomRingtone = (type = 'ring') => {
  try { return localStorage.getItem(CUSTOM_KEY[type] ?? CUSTOM_KEY.ring) || null; } catch { return null; }
};

export const setCustomRingtone = (type = 'ring', dataUrl) => {
  try {
    const key = CUSTOM_KEY[type] ?? CUSTOM_KEY.ring;
    if (dataUrl) localStorage.setItem(key, dataUrl);
    else         localStorage.removeItem(key);
  } catch {}
};

export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload  = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.readAsDataURL(file);
});

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
    this._ctx             = null;
    this._ringtoneHandle  = null;
    this._videoHandle     = null;
    this._vibrationTimer  = null;   // ← NEW: tracks the looping vibration interval
  }

  _getCtx() {
    if (!this._ctx || this._ctx.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._ctx = new Ctx();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  // ─── NEW: Looping vibration ──────────────────────────────────────────────

  /**
   * Starts vibrating on a repeating interval until stopVibration() is called.
   * Each cycle: buzz → pause → buzz, then waits `intervalMs` before repeating.
   *
   * @param {number[]} pattern     - Vibration pattern in ms  [buzz, pause, buzz, ...]
   * @param {number}   intervalMs  - Gap between each full pattern repeat (default 3000ms)
   */
  startVibration(pattern = [300, 150, 300], intervalMs = 3000) {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;

    // Stop any existing vibration loop first
    this.stopVibration();

    // Fire immediately, then repeat on interval
    navigator.vibrate(pattern);
    this._vibrationTimer = setInterval(() => {
      navigator.vibrate(pattern);
    }, intervalMs);
  }

  /**
   * Stops the looping vibration and cancels any active hardware buzz.
   */
  stopVibration() {
    if (this._vibrationTimer !== null) {
      clearInterval(this._vibrationTimer);
      this._vibrationTimer = null;
    }
    // Cancel any in-progress hardware vibration immediately
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
  }

  // ─── Ringtone methods ────────────────────────────────────────────────────

  /** Play audio call ringtone + start looping vibration if enabled */
  playRingtone(id = 'classic', vol = 0.8, vibrate = true) {
    this.stopRingtone();
    const custom = getCustomRingtone('ring');
    if (custom) { this._ringtoneHandle = makeAudioLoop(custom, vol); }
    else {
      try {
        const ctx = this._getCtx();
        const fn  = RINGTONE_PATTERNS[id] ?? RINGTONE_PATTERNS.classic;
        this._ringtoneHandle = fn(ctx, Math.max(0, Math.min(1, vol)));
      } catch (_) {}
    }
    // Start looping vibration synced to ring cycle
    if (vibrate) this.startVibration([300, 150, 300], 3200);
  }

  /** Stop audio call ringtone AND vibration */
  stopRingtone() {
    try { this._ringtoneHandle?.stop(); } catch (_) {}
    this._ringtoneHandle = null;
    this.stopVibration();   // ← always kill vibration when ring stops
  }

  /** Play video call ringtone + start looping vibration if enabled */
  playVideoCallTone(id = 'chime', vol = 0.8, vibrate = true) {
    this.stopVideoCallTone();
    const custom = getCustomRingtone('video');
    if (custom) { this._videoHandle = makeAudioLoop(custom, vol); }
    else {
      try {
        const ctx = this._getCtx();
        const fn  = RINGTONE_PATTERNS[id] ?? RINGTONE_PATTERNS.chime;
        this._videoHandle = fn(ctx, vol);
      } catch (_) {}
    }
    // Start looping vibration synced to video ring cycle
    if (vibrate) this.startVibration([200, 100, 200, 100, 200], 3600);
  }

  /** Stop video call ringtone AND vibration */
  stopVideoCallTone() {
    try { this._videoHandle?.stop(); } catch (_) {}
    this._videoHandle = null;
    this.stopVibration();   // ← always kill vibration when ring stops
  }

  /** One-shot message tone — no looping vibration */
  playMessageTone(id = 'ding', vol = 0.6, vibrate = false) {
    const custom = getCustomRingtone('message');
    if (custom) { playAudioOnce(custom, vol); }
    else {
      try {
        const ctx = this._getCtx();
        const fn  = MESSAGE_TONES[id] ?? MESSAGE_TONES.ding;
        fn(ctx, Math.max(0, Math.min(1, vol)));
      } catch (_) {}
    }
    // Single short buzz for messages (not looping)
    if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100]);
    }
  }

  /** Preview ringtone for 3s then auto-stop (vibration also stops after 3s) */
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

  /**
   * @deprecated Use startVibration() / stopVibration() for looping,
   *             or call navigator.vibrate() directly for one-shots.
   */
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