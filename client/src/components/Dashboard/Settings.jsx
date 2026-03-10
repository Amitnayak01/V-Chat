import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Palette ─────────────────────────────────────────── */
const T = {
  bg:        '#F4F6FA',
  surface:   '#FFFFFF',
  surf2:     '#F9FAFB',
  border:    '#E8ECF2',
  borderSub: '#F0F3F7',
  ink:       '#0C1120',
  inkSub:    '#3A4257',
  muted:     '#6B7897',
  dim:       '#9BA8BF',
  blue:      '#2451F5',
  blueH:     '#1A3ED4',
  blueL:     '#EEF3FE',
  blueLH:    '#DCE9FD',
  green:     '#0D9F6E',
  greenL:    '#EDFAF5',
  amber:     '#C97B1A',
  amberL:    '#FEF9EC',
  red:       '#DC2626',
  redL:      '#FFF4F4',
  purple:    '#6D28D9',
  purpleL:   '#F3EFFF',
  purpleLH:  '#E3D9FC',
};

const TABS = [
  { id: 'audio',   label: 'Audio Call', emoji: '📞', accent: T.green,  accentL: T.greenL,  border: '#BBF0D8' },
  { id: 'video',   label: 'Video Call', emoji: '🎥', accent: T.blue,   accentL: T.blueL,   border: '#BFDBFE' },
  { id: 'message', label: 'Messages',   emoji: '💬', accent: T.purple, accentL: T.purpleL, border: '#DDD6FE' },
];

const RINGTONES = [
  { id: 'classic',  label: 'Classic Ring',    desc: 'Traditional phone ringtone' },
  { id: 'gentle',   label: 'Gentle Pulse',    desc: 'Soft, gradual tones' },
  { id: 'digital',  label: 'Digital Buzz',    desc: 'Modern electronic sound' },
  { id: 'marimba',  label: 'Marimba',         desc: 'Warm, wooden percussion' },
  { id: 'silent',   label: 'Silent',          desc: 'No ringtone' },
];
const MSG_TONES = [
  { id: 'ding',     label: 'Ding',            desc: 'Quick single chime' },
  { id: 'pop',      label: 'Pop',             desc: 'Soft notification pop' },
  { id: 'note',     label: 'Note',            desc: 'Musical note ping' },
  { id: 'silent',   label: 'Silent',          desc: 'No notification sound' },
];

const SPR = { type: 'spring', stiffness: 500, damping: 38 };
const EASE = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };

/* ─── Toggle ──────────────────────────────────────────── */
function Toggle({ checked, onChange, accent = T.blue }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', flexShrink: 0,
        width: 52, height: 30, borderRadius: 99,
        border: 'none', cursor: 'pointer', outline: 'none',
        background: checked ? accent : '#D8DCEA',
        transition: 'background .25s cubic-bezier(.4,0,.2,1)',
        boxShadow: checked
          ? `0 0 0 4px ${accent}26, inset 0 1px 2px ${accent}40`
          : 'inset 0 1px 2px rgba(0,0,0,.1)',
      }}
    >
      <motion.span
        animate={{ x: checked ? 24 : 3 }}
        transition={SPR}
        style={{
          position: 'absolute', top: 3,
          width: 24, height: 24, borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 5px rgba(0,0,0,.22), 0 0 1px rgba(0,0,0,.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {checked && (
          <motion.svg
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.15 }}
            width="10" height="8" viewBox="0 0 10 8" fill="none"
          >
            <path d="M1 4L3.5 6.5L9 1" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </motion.svg>
        )}
      </motion.span>
    </button>
  );
}

/* ─── Volume Slider ───────────────────────────────────── */
function VolumeSlider({ value, onChange, accent }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{value === 0 ? '🔇' : value < 0.4 ? '🔈' : value < 0.8 ? '🔉' : '🔊'}</span>
      <div style={{ flex: 1, position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 5, borderRadius: 3, background: T.border }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 5,
          borderRadius: 3, background: `linear-gradient(90deg, ${accent}88, ${accent})`,
          transition: 'width .08s',
        }} />
        <input
          type="range" min={0} max={1} step={0.05} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            position: 'relative', width: '100%',
            appearance: 'none', WebkitAppearance: 'none',
            background: 'transparent', cursor: 'pointer',
            outline: 'none', margin: 0,
            '--thumb-color': accent,
          }}
        />
      </div>
      <span style={{
        fontSize: 11.5, fontWeight: 700, color: T.muted,
        minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
      }}>{pct}%</span>
    </div>
  );
}

/* ─── Tone Row ────────────────────────────────────────── */
function ToneRow({ opt, selected, previewing, onSelect, onPreview, onStop, accent, accentL, accentBd }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      layout
      onClick={() => onSelect(opt.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
        background: selected ? accentL : hovered ? T.surf2 : T.surface,
        border: `1.5px solid ${selected ? accentBd : hovered ? T.border : T.borderSub}`,
        marginBottom: 6, transition: 'all .15s',
      }}
    >
      {/* Radio */}
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: selected ? accent : 'transparent',
        border: `2px solid ${selected ? accent : T.dim}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .18s',
        boxShadow: selected ? `0 0 0 3px ${accent}20` : 'none',
      }}>
        {selected && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPR}
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: selected ? 600 : 500, color: selected ? T.ink : T.inkSub, margin: 0, letterSpacing: '-.01em' }}>{opt.label}</p>
        <p style={{ fontSize: 11.5, color: T.dim, margin: '2px 0 0', lineHeight: 1.3 }}>{opt.desc}</p>
      </div>

      {opt.id !== 'silent' && (
        <button
          onClick={e => { e.stopPropagation(); previewing ? onStop() : onPreview(opt.id); }}
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            border: `1.5px solid ${previewing ? '#FECACA' : T.border}`,
            background: previewing ? T.redL : T.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          {previewing
            ? <span style={{ fontSize: 13 }}>⏹</span>
            : <span style={{ fontSize: 13 }}>▶</span>}
        </button>
      )}
    </motion.div>
  );
}

/* ─── Upload Zone ─────────────────────────────────────── */
function UploadZone({ tabId }) {
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) return alert('Please upload an audio file.');
    if (file.size > 10 * 1024 * 1024) return alert('Max file size is 10 MB.');
    setUploaded(file.name);
  };

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
        style={{
          border: `2px dashed ${dragging ? T.blue : uploaded ? T.green : T.border}`,
          borderRadius: 14, padding: '18px 16px',
          background: dragging ? T.blueL : uploaded ? T.greenL : T.surf2,
          transition: 'all .2s', cursor: 'default',
        }}
      >
        {uploaded ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: T.greenL, border: `1px solid #BBF0D8`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🎵</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, margin: 0 }}>Custom tone active</p>
              <p style={{ fontSize: 11.5, color: T.green, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploaded}</p>
            </div>
            <button
              onClick={() => setUploaded(null)}
              style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid #FECACA`, background: T.redL, fontSize: 11.5, color: T.red, cursor: 'pointer', fontWeight: 600 }}
            >Remove</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: dragging ? T.blueLH : T.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, transition: 'background .15s',
            }}>{dragging ? '🎯' : '📂'}</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.inkSub, margin: 0 }}>
                {dragging ? 'Drop audio file' : 'Upload from device'}
              </p>
              <p style={{ fontSize: 11.5, color: T.dim, margin: '4px 0 0', lineHeight: 1.5 }}>
                Drag & drop or{' '}
                <span onClick={() => inputRef.current?.click()} style={{ color: T.blue, cursor: 'pointer', fontWeight: 600 }}>browse files</span>
                {' '}· MP3, WAV, OGG · Max 10 MB
              </p>
            </div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="audio/*" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

/* ─── Ring Panel ──────────────────────────────────────── */
function RingPanel({ tabId, tones, accent, accentL, accentBd }) {
  const isMsg = tabId === 'message';
  const [selected, setSelected]   = useState(tones[0].id);
  const [previewing, setPreviewing]= useState(null);
  const [volume, setVolume]       = useState(0.75);
  const [vibrate, setVibrate]     = useState(true);

  const handlePreview = (id) => {
    setPreviewing(id);
    setTimeout(() => setPreviewing(null), isMsg ? 800 : 3000);
  };

  return (
    <div>
      {/* Upload */}
      <p style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 10 }}>From Device</p>
      <UploadZone tabId={tabId} />

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px' }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.09em', whiteSpace: 'nowrap' }}>Built-in tones</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      {/* Tones */}
      <div>
        {tones.map(opt => (
          <ToneRow key={opt.id} opt={opt} selected={selected === opt.id} previewing={previewing === opt.id}
            onSelect={setSelected} onPreview={handlePreview} onStop={() => setPreviewing(null)}
            accent={accent} accentL={accentL} accentBd={accentBd} />
        ))}
      </div>

      {/* Volume */}
      <p style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.09em', margin: '20px 0 10px' }}>Volume</p>
      <div style={{ padding: '14px 16px', background: T.surf2, border: `1px solid ${T.border}`, borderRadius: 12 }}>
        <VolumeSlider value={volume} onChange={setVolume} accent={accent} />
      </div>

      {/* Vibration */}
      <p style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.09em', margin: '20px 0 10px' }}>Vibration</p>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: T.surf2, border: `1px solid ${T.border}`, borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>📳</span>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 500, color: T.inkSub, margin: 0 }}>
              {isMsg ? 'Vibrate on Message' : 'Vibrate on Ring'}
            </p>
            <p style={{ fontSize: 11.5, color: T.dim, margin: '2px 0 0' }}>Haptic feedback on mobile</p>
          </div>
        </div>
        <Toggle checked={vibrate} onChange={setVibrate} accent={accent} />
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────── */
export default function SoundSettings() {
  const [activeTab, setActiveTab] = useState('audio');
  const tabMeta = TABS.find(t => t.id === activeTab);
  const tones = activeTab === 'message' ? MSG_TONES : RINGTONES;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-tap-highlight-color: transparent; }
        .ss-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 14px; color: ${T.ink}; }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: var(--thumb-color, ${T.blue});
          box-shadow: 0 1px 4px rgba(0,0,0,.18), 0 0 0 3px rgba(0,0,0,.05);
          cursor: pointer; border: 2px solid #fff;
          transition: transform .15s;
        }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.15); }
        input[type=range]::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--thumb-color, ${T.blue}); border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,.18); cursor: pointer;
        }
        .ss-tabs { display: flex; }
        @media (max-width: 540px) {
          .ss-tab-btn span.tab-label { display: none; }
          .ss-tab-btn { padding: 10px 14px !important; gap: 0 !important; }
          .ss-reset-label { display: none !important; }
          .ss-reset-btn { padding: 6px 8px !important; font-size: 13px !important; }
        }
        @media (max-width: 360px) {
          .ss-tab-btn { padding: 10px 10px !important; }
        }
      `}</style>

      <div className="ss-root" style={{ minHeight: '100vh', background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${tabMeta.accentL}, ${T.bg} 60%)`, transition: 'background .5s' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(24px,5vw,52px) clamp(14px,4vw,28px) 64px' }}>

          {/* Page header */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={EASE} style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(22px,5vw,30px)', fontWeight: 800, color: T.ink, letterSpacing: '-.03em', lineHeight: 1.1 }}>
              Sound &amp; Ringtones
            </h1>
            <p style={{ fontSize: 13.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>Customize tones, volume and vibration for calls &amp; messages.</p>
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...EASE, delay: 0.05 }}
            style={{
              background: T.surface, borderRadius: 20,
              border: `1px solid ${T.border}`,
              boxShadow: '0 2px 4px rgba(0,0,0,.03), 0 8px 32px rgba(0,0,0,.06)',
              overflow: 'hidden',
            }}
          >
            {/* Tab bar */}
            <div className="ss-tabs" style={{
              display: 'flex', gap: 0,
              borderBottom: `1px solid ${T.borderSub}`,
              background: T.surf2,
              padding: '0 clamp(10px,3vw,22px)',
            }}>
              {TABS.map(tab => {
                const on = activeTab === tab.id;
                return (
                  <button key={tab.id} className="ss-tab-btn" onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: 'clamp(10px,2vw,13px) clamp(10px,2vw,18px)',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 'clamp(11.5px,2vw,13px)', fontWeight: on ? 700 : 500,
                      fontFamily: 'inherit', color: on ? tab.accent : T.muted,
                      borderBottom: `2.5px solid ${on ? tab.accent : 'transparent'}`,
                      marginBottom: -1, transition: 'all .18s', whiteSpace: 'nowrap',
                    }}>
                    <span style={{ fontSize: 'clamp(13px,2vw,15px)' }}>{tab.emoji}</span>
                    <span className="tab-label">{tab.label}</span>
                    {on && (
                      <motion.span layoutId="tab-pip" style={{
                        width: 5, height: 5, borderRadius: '50%', background: tab.accent, marginLeft: 1,
                      }} />
                    )}
                  </button>
                );
              })}

              {/* Reset */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 4 }}>
                <button
                  className="ss-reset-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 11px', borderRadius: 8,
                    border: `1px solid ${T.border}`, background: T.surface,
                    fontSize: 11.5, fontWeight: 600, color: T.dim, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.surf2; e.currentTarget.style.color = T.muted; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.dim; }}
                >
                  <span style={{ fontSize: 12 }}>↺</span>
                  <span className="ss-reset-label">Reset</span>
                </button>
              </div>
            </div>

            {/* Panel */}
            <div style={{ padding: 'clamp(16px,4vw,24px) clamp(14px,4vw,24px) clamp(20px,4vw,28px)' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <RingPanel
                    tabId={activeTab}
                    tones={tones}
                    accent={tabMeta.accent}
                    accentL={tabMeta.accentL}
                    accentBd={tabMeta.border}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px clamp(14px,4vw,24px)',
              borderTop: `1px solid ${T.borderSub}`,
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.surf2,
            }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <p style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.4 }}>Changes are saved automatically and apply immediately.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}