/**
 * SoundSettingsModal.jsx
 * ──────────────────────────────────────────────────────────────────────
 * Full-featured sound & ringtone settings modal.
 * Matches V-Meet's dark glass aesthetic.
 *
 * Props:
 *   isOpen   : boolean
 *   onClose  : () => void
 *
 * Features:
 *   - 3 tabs: Audio Call / Video Call / Messages
 *   - 6 built-in ringtones with live preview
 *   - Per-category volume sliders
 *   - Vibration toggles (mobile)
 *   - Persists to localStorage via useSoundSettings
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Volume2, VolumeX, Bell, Video, MessageCircle,
         Play, Square, Smartphone, RotateCcw, Check, Music } from 'lucide-react';
import { useSoundSettings }   from '../hooks/useSoundSettings';
import { SoundEngine, RINGTONE_OPTIONS, MESSAGE_TONE_OPTIONS } from '../utils/SoundEngine';

// ─── Shared design tokens ─────────────────────────────────────────────────────
const T = {
  bg0:    '#060d1a',
  bg1:    '#0b1628',
  bg2:    '#0f1e35',
  bg3:    '#162440',
  border: 'rgba(255,255,255,.08)',
  borderHi: 'rgba(255,255,255,.14)',
  text1:  '#f1f5f9',
  text2:  'rgba(255,255,255,.55)',
  text3:  'rgba(255,255,255,.28)',
  teal:   '#0fe0c0',
  tealBg: 'rgba(15,224,192,.10)',
  tealBd: 'rgba(15,224,192,.28)',
  blue:   '#60a5fa',
  blueBg: 'rgba(96,165,250,.10)',
  blueBd: 'rgba(96,165,250,.28)',
  purple: '#a78bfa',
  purpleBg:'rgba(167,139,250,.10)',
  purpleBd:'rgba(167,139,250,.28)',
  red:    '#f87171',
  redBg:  'rgba(248,113,113,.10)',
  redBd:  'rgba(248,113,113,.28)',
};

// ─── Inline styles ────────────────────────────────────────────────────────────
const css = `
  @keyframes ssm-in  { from{opacity:0;transform:translateY(28px) scale(.97)} to{opacity:1;transform:none} }
  @keyframes ssm-bg  { from{opacity:0} to{opacity:1} }
  @keyframes ssm-bar { from{transform:scaleX(0)} to{transform:scaleX(1)} }

  .ssm-scroll::-webkit-scrollbar { width: 4px; }
  .ssm-scroll::-webkit-scrollbar-track { background: transparent; }
  .ssm-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius:4px; }

  .ssm-vol::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px; height: 18px; border-radius: 50%;
    background: #0fe0c0;
    box-shadow: 0 0 0 3px rgba(15,224,192,.22);
    cursor: pointer; border: none;
  }
  .ssm-vol::-moz-range-thumb {
    width: 18px; height: 18px; border-radius: 50%;
    background: #0fe0c0; border: none;
    box-shadow: 0 0 0 3px rgba(15,224,192,.22);
    cursor: pointer;
  }
  .ssm-vol { -webkit-appearance: none; appearance: none; cursor: pointer; outline: none; }

  .ssm-ring-card:hover { background: rgba(255,255,255,.06) !important; border-color: rgba(255,255,255,.16) !important; }
  .ssm-ring-card.selected { background: rgba(15,224,192,.08) !important; border-color: rgba(15,224,192,.35) !important; }

  .ssm-tab { transition: all .18s; }
  .ssm-tab:hover { background: rgba(255,255,255,.04); }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

const Toggle = ({ on, onChange }) => (
  <button
    onClick={() => onChange(!on)}
    style={{
      width: 46, height: 26, borderRadius: 13, padding: 0, border: 'none',
      background: on ? T.teal : 'rgba(255,255,255,.12)',
      cursor: 'pointer', position: 'relative', transition: 'background .22s', flexShrink: 0,
    }}
  >
    <span style={{
      position: 'absolute', top: 3,
      left: on ? 22 : 3,
      width: 20, height: 20, borderRadius: '50%',
      background: on ? T.bg0 : '#94a3b8',
      transition: 'left .22s', boxShadow: '0 1px 5px rgba(0,0,0,.4)',
    }} />
  </button>
);

const VolumeSlider = ({ value, onChange, accent = T.teal }) => {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <VolumeX style={{ width: 15, height: 15, color: T.text3, flexShrink: 0 }} />
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Track background */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 4, borderRadius: 2, transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,.1)',
        }} />
        {/* Filled portion */}
        <div style={{
          position: 'absolute', top: '50%', left: 0,
          width: `${pct}%`, height: 4, borderRadius: 2,
          transform: 'translateY(-50%)',
          background: accent, transition: 'width .1s',
        }} />
        <input
          type="range" min={0} max={1} step={0.05} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="ssm-vol"
          style={{
            position: 'relative', width: '100%', height: 20,
            background: 'transparent',
          }}
        />
      </div>
      <Volume2 style={{ width: 15, height: 15, color: T.text2, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {pct}%
      </span>
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <p style={{
    fontSize: 10, fontWeight: 700, color: T.text3,
    textTransform: 'uppercase', letterSpacing: '.12em', margin: '0 0 12px',
  }}>
    {children}
  </p>
);

const Card = ({ children, style }) => (
  <div style={{
    borderRadius: 14, background: T.bg3,
    border: `1px solid ${T.border}`, padding: '14px 16px',
    marginBottom: 12, ...style,
  }}>
    {children}
  </div>
);

// Ringtone picker row
const RingRow = ({ option, selected, previewing, onSelect, onPreview, onStopPreview, accent }) => (
  <div
    className={`ssm-ring-card${selected ? ' selected' : ''}`}
    onClick={() => onSelect(option.id)}
    style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
      background: selected ? 'rgba(15,224,192,.08)' : 'rgba(255,255,255,.03)',
      border: `1px solid ${selected ? 'rgba(15,224,192,.35)' : T.border}`,
      marginBottom: 6, transition: 'all .15s',
    }}
  >
    {/* Selection indicator */}
    <div style={{
      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
      background: selected ? accent : 'transparent',
      border: `2px solid ${selected ? accent : T.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all .15s',
    }}>
      {selected && <Check style={{ width: 11, height: 11, color: T.bg0 }} strokeWidth={3} />}
    </div>

    {/* Text */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ color: selected ? T.text1 : T.text2, fontWeight: selected ? 700 : 500, fontSize: 13, margin: 0 }}>
        {option.label}
      </p>
      <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>{option.desc}</p>
    </div>

    {/* Preview button */}
    <button
      onClick={e => { e.stopPropagation(); previewing ? onStopPreview() : onPreview(option.id); }}
      style={{
        width: 32, height: 32, borderRadius: '50%', border: 'none',
        background: previewing ? 'rgba(248,113,113,.18)' : 'rgba(255,255,255,.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, transition: 'all .15s',
      }}
    >
      {previewing
        ? <Square  style={{ width: 11, height: 11, color: T.red }} />
        : <Play    style={{ width: 11, height: 11, color: T.text2 }} />}
    </button>
  </div>
);

// ─── Tab content panels ───────────────────────────────────────────────────────

const AudioCallTab = ({ settings, update }) => {
  const [previewing, setPreviewing] = useState(null);

  const handlePreview = useCallback((id) => {
    setPreviewing(id);
    SoundEngine.previewRingtone(id, settings.volume, 'ring');
    setTimeout(() => setPreviewing(null), 3100);
  }, [settings.volume]);

  const handleStop = useCallback(() => {
    SoundEngine.stopRingtone();
    setPreviewing(null);
  }, []);

  return (
    <div>
      <SectionLabel>Ringtone</SectionLabel>
      <div style={{ marginBottom: 16 }}>
        {RINGTONE_OPTIONS.map(opt => (
          <RingRow
            key={opt.id}
            option={opt}
            selected={settings.ringtone === opt.id}
            previewing={previewing === opt.id}
            onSelect={id => update('audioCall', { ringtone: id })}
            onPreview={handlePreview}
            onStopPreview={handleStop}
            accent={T.teal}
          />
        ))}
      </div>

      <SectionLabel>Volume</SectionLabel>
      <Card>
        <VolumeSlider
          value={settings.volume}
          onChange={v => update('audioCall', { volume: v })}
          accent={T.teal}
        />
      </Card>

      <SectionLabel>Vibration</SectionLabel>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone style={{ width: 16, height: 16, color: T.text2 }} />
            <div>
              <p style={{ color: T.text1, fontSize: 13, fontWeight: 600, margin: 0 }}>Vibrate on Ring</p>
              <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>Haptic feedback on incoming calls</p>
            </div>
          </div>
          <Toggle on={settings.vibration} onChange={v => update('audioCall', { vibration: v })} />
        </div>
      </Card>
    </div>
  );
};

const VideoCallTab = ({ settings, update }) => {
  const [previewing, setPreviewing] = useState(null);

  const handlePreview = useCallback((id) => {
    setPreviewing(id);
    SoundEngine.previewRingtone(id, settings.volume, 'video');
    setTimeout(() => setPreviewing(null), 3100);
  }, [settings.volume]);

  const handleStop = useCallback(() => {
    SoundEngine.stopVideoCallTone();
    setPreviewing(null);
  }, []);

  return (
    <div>
      <SectionLabel>Video Call Ringtone</SectionLabel>
      <div style={{ marginBottom: 16 }}>
        {RINGTONE_OPTIONS.map(opt => (
          <RingRow
            key={opt.id}
            option={opt}
            selected={settings.ringtone === opt.id}
            previewing={previewing === opt.id}
            onSelect={id => update('videoCall', { ringtone: id })}
            onPreview={handlePreview}
            onStopPreview={handleStop}
            accent={T.blue}
          />
        ))}
      </div>

      <SectionLabel>Volume</SectionLabel>
      <Card>
        <VolumeSlider
          value={settings.volume}
          onChange={v => update('videoCall', { volume: v })}
          accent={T.blue}
        />
      </Card>

      <SectionLabel>Vibration</SectionLabel>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone style={{ width: 16, height: 16, color: T.text2 }} />
            <div>
              <p style={{ color: T.text1, fontSize: 13, fontWeight: 600, margin: 0 }}>Vibrate on Ring</p>
              <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>Haptic feedback on incoming video calls</p>
            </div>
          </div>
          <Toggle on={settings.vibration} onChange={v => update('videoCall', { vibration: v })} />
        </div>
      </Card>
    </div>
  );
};

const MessagesTab = ({ settings, update }) => {
  const [previewing, setPreviewing] = useState(null);

  const handlePreview = useCallback((id) => {
    if (id === 'silent') return;
    setPreviewing(id);
    SoundEngine.playMessageTone(id, settings.volume);
    setTimeout(() => setPreviewing(null), 800);
  }, [settings.volume]);

  return (
    <div>
      <SectionLabel>Message Tone</SectionLabel>
      <div style={{ marginBottom: 16 }}>
        {MESSAGE_TONE_OPTIONS.map(opt => (
          <RingRow
            key={opt.id}
            option={opt}
            selected={settings.tone === opt.id}
            previewing={previewing === opt.id}
            onSelect={id => update('messages', { tone: id })}
            onPreview={handlePreview}
            onStopPreview={() => setPreviewing(null)}
            accent={T.purple}
          />
        ))}
      </div>

      <SectionLabel>Volume</SectionLabel>
      <Card>
        <VolumeSlider
          value={settings.volume}
          onChange={v => update('messages', { volume: v })}
          accent={T.purple}
        />
      </Card>

      <SectionLabel>Vibration</SectionLabel>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone style={{ width: 16, height: 16, color: T.text2 }} />
            <div>
              <p style={{ color: T.text1, fontSize: 13, fontWeight: 600, margin: 0 }}>Vibrate on Message</p>
              <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>Haptic feedback for new messages</p>
            </div>
          </div>
          <Toggle on={settings.vibration} onChange={v => update('messages', { vibration: v })} />
        </div>
      </Card>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'audio',   label: 'Audio Call', Icon: Bell,          accent: T.teal,   accentBg: T.tealBg,   accentBd: T.tealBd   },
  { id: 'video',   label: 'Video Call', Icon: Video,         accent: T.blue,   accentBg: T.blueBg,   accentBd: T.blueBd   },
  { id: 'message', label: 'Messages',   Icon: MessageCircle, accent: T.purple, accentBg: T.purpleBg, accentBd: T.purpleBd },
];

const SoundSettingsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('audio');
  const { settings, update, reset } = useSoundSettings();

  // Stop all previews when tab changes or modal closes
  useEffect(() => {
    SoundEngine.stopRingtone();
    SoundEngine.stopVideoCallTone();
  }, [activeTab, isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeTabMeta = TABS.find(t => t.id === activeTab);

  return (
    <>
      <style>{css}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(10px)',
          animation: 'ssm-bg .2s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 501,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', pointerEvents: 'none',
      }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            width: '100%', maxWidth: 520,
            maxHeight: '90vh',
            borderRadius: 22,
            background: `linear-gradient(160deg, ${T.bg1} 0%, ${T.bg0} 100%)`,
            border: `1px solid ${T.borderHi}`,
            boxShadow: '0 32px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'ssm-in .28s cubic-bezier(.34,1.2,.64,1)',
          }}
        >
          {/* ── Header ────────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 14px', flexShrink: 0,
            borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 13,
                background: T.tealBg, border: `1px solid ${T.tealBd}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Music style={{ width: 18, height: 18, color: T.teal }} />
              </div>
              <div>
                <h2 style={{ color: T.text1, fontWeight: 700, fontSize: 16, margin: 0 }}>
                  Sound & Notifications
                </h2>
                <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>
                  Ringtones, tones & vibration
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Reset button */}
              <button
                onClick={reset}
                title="Reset to defaults"
                style={{
                  width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.border}`,
                  background: 'rgba(255,255,255,.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw style={{ width: 14, height: 14, color: T.text3 }} />
              </button>
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.border}`,
                  background: 'rgba(255,255,255,.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: 15, height: 15, color: T.text2 }} />
              </button>
            </div>
          </div>

          {/* ── Tab bar ───────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: 4, padding: '12px 16px 0',
            flexShrink: 0, borderBottom: `1px solid ${T.border}`,
          }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className="ssm-tab"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 14px', borderRadius: '10px 10px 0 0',
                    border: 'none', background: active ? tab.accentBg : 'transparent',
                    cursor: 'pointer',
                    borderBottom: active ? `2px solid ${tab.accent}` : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  <tab.Icon style={{ width: 14, height: 14, color: active ? tab.accent : T.text3 }} />
                  <span style={{
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    color: active ? tab.accent : T.text3,
                    whiteSpace: 'nowrap',
                  }}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Active accent stripe ───────────────────────────────────────── */}
          <div style={{
            height: 2, flexShrink: 0,
            background: `linear-gradient(90deg, ${activeTabMeta.accent}44, ${activeTabMeta.accent}, ${activeTabMeta.accent}44)`,
            animation: 'ssm-bar .25s ease',
          }} />

          {/* ── Scrollable body ───────────────────────────────────────────── */}
          <div
            className="ssm-scroll"
            style={{ overflowY: 'auto', flex: 1, padding: '20px 20px 28px' }}
          >
            {activeTab === 'audio'   && <AudioCallTab settings={settings.audioCall} update={update} />}
            {activeTab === 'video'   && <VideoCallTab settings={settings.videoCall} update={update} />}
            {activeTab === 'message' && <MessagesTab  settings={settings.messages}  update={update} />}
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div style={{
            padding: '12px 20px', flexShrink: 0,
            borderTop: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ color: T.text3, fontSize: 11, margin: 0 }}>
              Settings saved automatically
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '8px 20px', borderRadius: 10, border: 'none',
                background: T.teal, color: T.bg0,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SoundSettingsModal;