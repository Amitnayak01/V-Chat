/**
 * useSoundSettings.js
 * ────────────────────────────────────────────────────────────
 * Persistent sound preference store backed by localStorage.
 * All components read/write from this single hook.
 *
 * Shape:
 *   audioCall  : { ringtone, volume, vibration }
 *   videoCall  : { ringtone, volume, vibration }
 *   messages   : { tone, volume, vibration }
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'vmeet_sound_settings';

const DEFAULTS = {
  audioCall: {
    ringtone:  'classic',
    volume:    0.8,
    vibration: true,
  },
  videoCall: {
    ringtone:  'chime',
    volume:    0.8,
    vibration: true,
  },
  messages: {
    tone:      'ding',
    volume:    0.6,
    vibration: false,
  },
};

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    // Deep-merge with defaults so new keys always exist
    return {
      audioCall: { ...DEFAULTS.audioCall, ...parsed.audioCall },
      videoCall: { ...DEFAULTS.videoCall, ...parsed.videoCall },
      messages:  { ...DEFAULTS.messages,  ...parsed.messages  },
    };
  } catch (_) {
    return DEFAULTS;
  }
};

const save = (settings) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSoundSettings = () => {
  const [settings, setSettings] = useState(load);

  // Persist on every change
  useEffect(() => { save(settings); }, [settings]);

  const update = useCallback((category, patch) => {
    setSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], ...patch },
    }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULTS);
  }, []);

  return { settings, update, reset };
};

// ─── Standalone reader (for contexts that don't need React state) ─────────────
export const readSoundSettings = () => load();