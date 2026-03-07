import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Eye, EyeOff, Monitor, Activity, Sun, Moon, Volume2,
  VolumeX, Wifi, BellRing, Smartphone, Mail, Calendar,
  User, CheckCircle2, Settings as SettingsIcon,
  Music, Play, Square, RotateCcw, Video, MessageCircle,
  Upload, FolderOpen, FileMusic,
} from 'lucide-react';
import { useAuth }     from '../../context/AuthContext';
import { settingsAPI } from '../../utils/api';
import toast           from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { SoundEngine, RINGTONE_OPTIONS, MESSAGE_TONE_OPTIONS,
         getCustomRingtone, setCustomRingtone, fileToDataUrl } from '../../utils/SoundEngine';
import { useSoundSettings } from '../../hooks/useSoundSettings';

/* ─── DESIGN TOKENS ──────────────────────────────── */
const C = {
  bg:       '#F0F2F5',
  surface:  '#FFFFFF',
  surfaceEl:'#F8F9FB',
  border:   '#E4E7EC',
  borderSub:'#EEF0F4',
  ink:      '#0D1117',
  inkSub:   '#3D4451',
  muted:    '#6C7789',
  dim:      '#9AA3B2',
  accent:   '#2563EB',
  accentH:  '#1D4ED8',
  accentL:  '#EFF6FF',
  accentLH: '#DBEAFE',
  red:      '#DC2626',
  redBg:    '#FFF5F5',
  redLine:  '#FECACA',
  green:    '#16A34A',
  greenBg:  '#F0FDF4',
  greenLn:  '#BBF7D0',
  amber:    '#D97706',
  amberBg:  '#FFFBEB',
  purple:   '#7C3AED',
  purpleBg: '#F5F3FF',
  teal:     '#0369A1',
  tealBg:   '#E0F2FE',
  emerald:    '#059669',
  emeraldBg:  '#ECFDF5',
  emeraldLn:  '#A7F3D0',
  rose:       '#E11D48',
  roseBg:     '#FFF1F2',
};

const SPR  = { type: 'spring', stiffness: 480, damping: 36 };
const EASE = { duration: 0.22, ease: [0.4, 0, 0.2, 1] };
const UP   = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: EASE } };
const STG  = { show: { transition: { staggerChildren: 0.055 } } };

/* ─── NAV — Security items removed ──────────────── */
const NAV = [
  { id: 'pref-appearance', label: 'Appearance',    icon: Sun,    group: 'Preferences' },
  { id: 'pref-notif',      label: 'Notifications', icon: Bell,   group: 'Preferences' },
  { id: 'pref-sound',      label: 'Sound & Tones', icon: Music,  group: 'Preferences' },
  { id: 'pref-av',         label: 'Audio & Video', icon: Volume2,group: 'Preferences' },
];

/* ─── HOOKS ──────────────────────────────────────── */
function useActiveSection() {
  const [active, setActive] = useState(NAV[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-12% 0px -68% 0px' },
    );
    NAV.forEach(({ id }) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return active;
}

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

const scrollTo = id => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ─── TOGGLE ─────────────────────────────────────── */
const Toggle = ({ id, checked, onChange }) => (
  <button
    id={id} role="switch" aria-checked={checked}
    onClick={() => onChange(!checked)}
    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked); } }}
    style={{
      position: 'relative', flexShrink: 0, width: 44, height: 24,
      borderRadius: 99, border: 'none', cursor: 'pointer',
      background: checked ? C.accent : '#D1D5DB',
      outline: 'none', transition: 'background .22s cubic-bezier(.4,0,.2,1)',
      boxShadow: checked ? `0 0 0 3px ${C.accentLH}` : 'none',
    }}
  >
    <motion.span
      animate={{ x: checked ? 22 : 3 }}
      transition={SPR}
      style={{
        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.20)',
      }}
    />
  </button>
);

/* ─── TOGGLE ROW ─────────────────────────────────── */
const TR = ({ label, description, value, onChange, icon: Icon }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '14px 0', borderBottom: `1px solid ${C.borderSub}`,
      transition: 'background .15s',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      {Icon && (
        <div style={{
          width: 34, height: 34, borderRadius: 8, background: C.surfaceEl,
          border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon style={{ width: 14, height: 14, color: C.muted }} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <label
          htmlFor={`t-${label.replace(/\s/g, '-').toLowerCase()}`}
          style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: C.inkSub, cursor: 'pointer', lineHeight: 1.3 }}
        >
          {label}
        </label>
        {description && (
          <p style={{ fontSize: 12, color: C.dim, marginTop: 2, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
    </div>
    <Toggle id={`t-${label.replace(/\s/g, '-').toLowerCase()}`} checked={value} onChange={onChange} />
  </div>
);

/* ─── CARD ───────────────────────────────────────── */
const Card = ({ id, children }) => (
  <motion.section
    id={id}
    variants={UP}
    style={{
      background: C.surface,
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${C.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04)',
      scrollMarginTop: 32,
    }}
  >
    {children}
  </motion.section>
);

/* ─── CARD HEAD ──────────────────────────────────── */
const CH = ({ icon: Icon, title, subtitle, iColor, iBg }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px',
    borderBottom: `1px solid ${C.borderSub}`, background: C.surfaceEl,
  }}>
    <div style={{
      width: 38, height: 38, borderRadius: 10, background: iBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: `0 0 0 1px ${iBg}`,
    }}>
      <Icon style={{ width: 16, height: 16, color: iColor }} />
    </div>
    <div>
      <h3 style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: 0, lineHeight: 1.25, letterSpacing: '-.01em' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{subtitle}</p>}
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════
   SOUND SETTINGS SECTION
══════════════════════════════════════════════════════ */

const SOUND_TABS = [
  { id: 'audio',   label: 'Audio Call', Icon: Bell,          accent: '#059669', accentL: '#ECFDF5', accentBd: '#A7F3D0' },
  { id: 'video',   label: 'Video Call', Icon: Video,         accent: '#2563EB', accentL: '#EFF6FF', accentBd: '#BFDBFE' },
  { id: 'message', label: 'Messages',   Icon: MessageCircle, accent: '#7C3AED', accentL: '#F5F3FF', accentBd: '#DDD6FE' },
];

const SmallToggle = ({ checked, onChange }) => (
  <button
    role="switch" aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      position: 'relative', flexShrink: 0, width: 44, height: 24,
      borderRadius: 99, border: 'none', cursor: 'pointer',
      background: checked ? C.accent : '#D1D5DB',
      outline: 'none', transition: 'background .22s',
      boxShadow: checked ? `0 0 0 3px ${C.accentLH}` : 'none',
    }}
  >
    <motion.span animate={{ x: checked ? 22 : 3 }} transition={SPR}
      style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.20)' }}
    />
  </button>
);

const VolumeSlider = ({ value, onChange, accent }) => {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <VolumeX style={{ width: 14, height: 14, color: C.dim, flexShrink: 0 }} />
      <div style={{ flex: 1, position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, background: C.border }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 2, background: accent, transition: 'width .1s' }} />
        <input type="range" min={0} max={1} step={0.05} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'relative', width: '100%', appearance: 'none', WebkitAppearance: 'none',
            background: 'transparent', cursor: 'pointer', outline: 'none', margin: 0 }}
        />
      </div>
      <Volume2 style={{ width: 14, height: 14, color: C.muted, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </div>
  );
};

const RingRow = ({ option, selected, previewing, onSelect, onPreview, onStop, accent, accentL }) => (
  <div
    onClick={() => onSelect(option.id)}
    style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
      background: selected ? accentL : C.surfaceEl,
      border: `1.5px solid ${selected ? accent : C.border}`,
      marginBottom: 6, transition: 'all .15s',
    }}
    onMouseEnter={e => { if (!selected) { e.currentTarget.style.background = C.bg; e.currentTarget.style.borderColor = '#CBD5E1'; } }}
    onMouseLeave={e => { if (!selected) { e.currentTarget.style.background = C.surfaceEl; e.currentTarget.style.borderColor = C.border; } }}
  >
    <div style={{
      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
      background: selected ? accent : 'transparent',
      border: `2px solid ${selected ? accent : C.dim}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
    }}>
      {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: selected ? C.ink : C.inkSub, margin: 0 }}>{option.label}</p>
      <p style={{ fontSize: 11, color: C.dim, margin: '2px 0 0' }}>{option.desc}</p>
    </div>
    <button
      onClick={e => { e.stopPropagation(); previewing ? onStop() : onPreview(option.id); }}
      style={{
        width: 30, height: 30, borderRadius: '50%', border: `1px solid ${C.border}`,
        background: previewing ? '#FFF1F2' : C.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, transition: 'all .15s',
      }}
    >
      {previewing
        ? <Square style={{ width: 10, height: 10, color: C.rose }} />
        : <Play   style={{ width: 10, height: 10, color: C.muted }} />}
    </button>
  </div>
);

const FromDeviceRow = ({ tabId, onCustomSet }) => {
  const typeMap = { audio: 'ring', video: 'video', message: 'message' };
  const type    = typeMap[tabId] ?? 'ring';

  const [custom,    setCustom]    = useState(() => getCustomRingtone(type));
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewing,setPreviewing]= useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setCustom(getCustomRingtone(type)); }, [type]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) { alert('Please select an audio file (mp3, wav, ogg, m4a, etc.)'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File too large — max 10 MB'); return; }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setCustomRingtone(type, dataUrl);
      setCustom(dataUrl);
      onCustomSet(true);
    } catch (e) { alert('Could not read file'); }
    finally { setUploading(false); }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); };

  const handleRemove = () => {
    SoundEngine.stopRingtone(); SoundEngine.stopVideoCallTone();
    setCustomRingtone(type, null);
    setCustom(null); setPreviewing(false); onCustomSet(false);
  };

  const handlePreview = () => {
    if (previewing) {
      SoundEngine.stopRingtone(); SoundEngine.stopVideoCallTone(); setPreviewing(false);
    } else {
      setPreviewing(true);
      if (tabId === 'video') {
        SoundEngine.playVideoCallTone('chime', 0.8);
        setTimeout(() => { SoundEngine.stopVideoCallTone(); setPreviewing(false); }, 3000);
      } else if (tabId === 'message') {
        SoundEngine.playMessageTone('ding', 0.6);
        setTimeout(() => setPreviewing(false), 1000);
      } else {
        SoundEngine.playRingtone('classic', 0.8);
        setTimeout(() => { SoundEngine.stopRingtone(); setPreviewing(false); }, 3000);
      }
    }
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#2563EB' : custom ? '#059669' : C.border}`,
          borderRadius: 12, padding: '16px 14px',
          background: dragging ? '#EFF6FF' : custom ? C.greenBg : C.surfaceEl,
          transition: 'all .18s', cursor: 'default',
        }}
      >
        {custom ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: C.greenBg, border: `1px solid ${C.greenLn}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileMusic style={{ width: 18, height: 18, color: C.emerald }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>Custom ringtone active</p>
              <p style={{ fontSize: 11, color: C.emerald, margin: '2px 0 0' }}>✓ This tone will play instead of built-in ringtones</p>
            </div>
            <button onClick={handlePreview} title={previewing ? 'Stop' : 'Preview'}
              style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.border}`,
                background: previewing ? '#FFF1F2' : C.surface, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {previewing ? <Square style={{ width: 10, height: 10, color: C.rose }} /> : <Play style={{ width: 10, height: 10, color: C.muted }} />}
            </button>
            <button onClick={() => inputRef.current?.click()} title="Change file"
              style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.border}`,
                background: C.surface, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Upload style={{ width: 12, height: 12, color: C.muted }} />
            </button>
            <button onClick={handleRemove} title="Remove custom ringtone"
              style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.redLine}`,
                background: C.redBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Square style={{ width: 12, height: 12, color: C.red }} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: dragging ? C.accentL : C.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s',
            }}>
              {uploading
                ? <div style={{ width: 18, height: 18, border: `2px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <FolderOpen style={{ width: 20, height: 20, color: dragging ? C.accent : C.muted }} />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.inkSub, margin: 0 }}>
                {uploading ? 'Loading…' : dragging ? 'Drop to upload' : 'Choose from device'}
              </p>
              <p style={{ fontSize: 11, color: C.dim, margin: '3px 0 0' }}>
                Drag & drop, or{' '}
                <span onClick={() => inputRef.current?.click()}
                  style={{ color: C.accent, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                  browse files
                </span>
                {' '}· MP3, WAV, OGG, M4A · Max 10 MB
              </p>
            </div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="audio/*" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
};

const RingPanel = ({ tabId, ringOptions, selectedId, onSelect, volume, onVolume, vibration, onVibration, accent, accentL }) => {
  const [previewing, setPreviewing] = useState(null);
  const [hasCustom,  setHasCustom]  = useState(() => {
    const typeMap = { audio: 'ring', video: 'video', message: 'message' };
    return !!getCustomRingtone(typeMap[tabId] ?? 'ring');
  });
  const isMsg = tabId === 'message';

  const handlePreview = (id) => {
    if (id === 'silent') return;
    setPreviewing(id);
    if (isMsg) {
      SoundEngine.playMessageTone(id, volume);
      setTimeout(() => setPreviewing(null), 900);
    } else {
      const type = tabId === 'video' ? 'video' : 'ring';
      SoundEngine.previewRingtone(id, volume, type);
      setTimeout(() => setPreviewing(null), 3100);
    }
  };

  const handleStop = () => {
    SoundEngine.stopRingtone(); SoundEngine.stopVideoCallTone(); setPreviewing(null);
  };

  useEffect(() => { handleStop(); }, [tabId]); // eslint-disable-line

  return (
    <div style={{ padding: '4px 0' }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>
        From Device
      </p>
      <FromDeviceRow tabId={tabId} onCustomSet={setHasCustom} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px' }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', whiteSpace: 'nowrap' }}>
          Built-in Ringtones
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      <div style={{ opacity: hasCustom ? 0.45 : 1, transition: 'opacity .2s', pointerEvents: hasCustom ? 'none' : 'auto' }}>
        {hasCustom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
            background: C.amberBg, border: `1px solid #FDE68A`, borderRadius: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13 }}>ℹ️</span>
            <p style={{ fontSize: 11.5, color: C.amber, margin: 0 }}>Custom file overrides built-in ringtones</p>
          </div>
        )}
        {ringOptions.map(opt => (
          <RingRow key={opt.id} option={opt} selected={selectedId === opt.id} previewing={previewing === opt.id}
            onSelect={onSelect} onPreview={handlePreview} onStop={handleStop} accent={accent} accentL={accentL} />
        ))}
      </div>

      <p style={{ fontSize: 10.5, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', margin: '18px 0 10px' }}>Volume</p>
      <div style={{ padding: '14px 16px', background: C.surfaceEl, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <VolumeSlider value={volume} onChange={onVolume} accent={accent} />
      </div>

      <p style={{ fontSize: 10.5, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', margin: '18px 0 10px' }}>Vibration</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: C.surfaceEl, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Smartphone style={{ width: 15, height: 15, color: C.muted }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.inkSub, margin: 0 }}>
              {isMsg ? 'Vibrate on Message' : 'Vibrate on Ring'}
            </p>
            <p style={{ fontSize: 11, color: C.dim, margin: '2px 0 0' }}>Haptic feedback (mobile)</p>
          </div>
        </div>
        <SmallToggle checked={vibration} onChange={onVibration} />
      </div>
    </div>
  );
};

const SoundSettingsCard = () => {
  const { settings, update, reset } = useSoundSettings();
  const [activeTab, setActiveTab]   = useState('audio');

  useEffect(() => () => { SoundEngine.stopRingtone(); SoundEngine.stopVideoCallTone(); }, []);

  const tabMeta  = SOUND_TABS.find(t => t.id === activeTab);
  const isVideo  = activeTab === 'video';
  const isMsg    = activeTab === 'message';
  const cat      = isMsg ? settings.messages : isVideo ? settings.videoCall : settings.audioCall;
  const catKey   = isMsg ? 'messages' : isVideo ? 'videoCall' : 'audioCall';
  const ringOpts = isMsg ? MESSAGE_TONE_OPTIONS : RINGTONE_OPTIONS;
  const selId    = isMsg ? cat.tone : cat.ringtone;
  const selKey   = isMsg ? 'tone' : 'ringtone';

  return (
    <Card id="pref-sound">
      <CH icon={Music} title="Sound & Ringtones" subtitle="Customize tones and vibration for calls and messages" iColor={C.emerald} iBg={C.emeraldBg} />

      <div style={{ display: 'flex', gap: 0, padding: '0 22px', borderBottom: `1px solid ${C.borderSub}`, background: C.surfaceEl }}>
        {SOUND_TABS.map(tab => {
          const on = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 12.5, fontWeight: on ? 700 : 500, fontFamily: 'inherit',
                color: on ? tab.accent : C.muted,
                borderBottom: `2px solid ${on ? tab.accent : 'transparent'}`,
                marginBottom: -1, transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
              <tab.Icon style={{ width: 13, height: 13 }} />
              {tab.label}
            </button>
          );
        })}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 4 }}>
          <button onClick={reset} title="Reset all sound settings to defaults"
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface,
              fontSize: 11, fontWeight: 500, color: C.dim, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceEl; e.currentTarget.style.color = C.muted; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.surface;   e.currentTarget.style.color = C.dim; }}>
            <RotateCcw style={{ width: 11, height: 11 }} /> Reset
          </button>
        </div>
      </div>

      <div className="card-body" style={{ padding: '20px 22px 26px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: .18 }}>
            <RingPanel
              tabId={activeTab} ringOptions={ringOpts} selectedId={selId}
              onSelect={id => update(catKey, { [selKey]: id })}
              volume={cat.volume} onVolume={v => update(catKey, { volume: v })}
              vibration={cat.vibration} onVibration={v => update(catKey, { vibration: v })}
              accent={tabMeta.accent} accentL={tabMeta.accentL}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ padding: '10px 22px', borderTop: `1px solid ${C.borderSub}`, display: 'flex', alignItems: 'center', gap: 7 }}>
        <CheckCircle2 style={{ width: 13, height: 13, color: C.emerald, flexShrink: 0 }} />
        <p style={{ fontSize: 11.5, color: C.dim }}>Settings saved automatically and apply to all calls immediately.</p>
      </div>
    </Card>
  );
};

/* ══════════════════════════════════════════════════════
   MAIN SETTINGS COMPONENT
══════════════════════════════════════════════════════ */
export default function Settings() {
  const active      = useActiveSection();
  const winW        = useWindowWidth();
  const isMobile    = winW < 768;
  const mobileNavRef = useRef(null);

  const [notif, setNotif] = useState({
    incomingCalls: true, chatMessages: true, userOnline: false,
    meetingReminders: true, emailNotifs: false, soundEnabled: true, desktopNotifs: true,
  });
  const [av, setAv] = useState({
    theme: 'system', autoJoinAudio: true, autoJoinVideo: false,
    mirrorVideo: true, noiseSuppression: true, echoCancel: true,
  });

  useEffect(() => {
    if (!isMobile || !mobileNavRef.current) return;
    const el = mobileNavRef.current.querySelector(`[data-id="${active}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [active, isMobile]);

  const un = (k, v) => setNotif(p => ({ ...p, [k]: v }));
  const ua = (k, v) => setAv(p => ({ ...p, [k]: v }));

  const THEMES = [
    { id: 'light',  label: 'Light',  icon: Sun,     note: 'Always on' },
    { id: 'dark',   label: 'Dark',   icon: Moon,    note: 'Always on' },
    { id: 'system', label: 'System', icon: Monitor, note: 'Follows OS' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-tap-highlight-color: transparent; }
        .vs { font-family: 'DM Sans', system-ui, -apple-system, sans-serif; font-size: 14px; color: #0D1117; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

        .nb-btn { transition: all .16s; }
        .nb-btn:hover { background: #EFF6FF !important; color: #2563EB !important; }
        .sb-btn:hover { background: #F0F2F5 !important; }

        .tr-row:last-child { border-bottom: none !important; }

        .settings-layout { display: flex; gap: 36px; align-items: flex-start; }
        .settings-sidebar {
          width: 220px; flex-shrink: 0;
          position: sticky; top: 28px;
          max-height: calc(100vh - 56px); overflow-y: auto;
        }
        .settings-main { flex: 1; min-width: 0; }

        @media(max-width: 767px) {
          .settings-layout  { flex-direction: column; gap: 0; }
          .settings-sidebar { display: none; }
          .settings-main    { width: 100%; }
        }

        .mobile-nav {
          display: none;
          overflow-x: auto; white-space: nowrap;
          padding: 12px 16px 10px; gap: 8px;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
          position: sticky; top: 0; z-index: 50;
          background: rgba(240,242,245,.97);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid #E4E7EC;
        }
        .mobile-nav::-webkit-scrollbar { display: none; }
        @media(max-width: 767px) { .mobile-nav { display: flex; } }

        @media(max-width: 767px) {
          .page-wrap   { padding: 0 0 40px !important; }
          .page-inner  { padding: 20px 16px 0 !important; }
        }
        @media(max-width: 480px) {
          .card-body  { padding: 18px !important; }
          .card-head  { padding: 14px 18px !important; }
          .tgl-wrap   { padding: 8px 18px 20px !important; }
          .theme-grid { grid-template-columns: 1fr !important; }
        }

        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,.18);
          cursor: pointer; border: none;
        }
        input[type=range]::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 50%;
          background: #2563EB; border: none;
          box-shadow: 0 0 0 3px rgba(37,99,235,.18); cursor: pointer;
        }
      `}</style>

      <div className="vs" style={{ minHeight: '100vh', background: C.bg }}>

        {/* ══ MOBILE NAV ══ */}
        <div className="mobile-nav" ref={mobileNavRef}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const on = active === id;
            return (
              <button key={id} data-id={id} onClick={() => scrollTo(id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: on ? 600 : 500, fontFamily: 'inherit',
                  background: on ? C.accent : '#FFFFFF',
                  color: on ? '#fff' : C.muted,
                  boxShadow: on ? '0 2px 8px rgba(37,99,235,.3)' : '0 1px 3px rgba(0,0,0,.08)',
                  transition: 'all .18s',
                }}>
                <Icon style={{ width: 12, height: 12 }} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ══ PAGE WRAP ══ */}
        <div className="page-wrap" style={{ maxWidth: 1000, margin: '0 auto', padding: '44px 28px 60px' }}>
          <div className="page-inner settings-layout">

            {/* ── SIDEBAR ── */}
            <aside className="settings-sidebar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 32 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11, background: C.ink,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(0,0,0,.28)', flexShrink: 0,
                }}>
                  <SettingsIcon style={{ width: 16, height: 16, color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1, letterSpacing: '-.02em' }}>Settings</p>
                  <p style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>V-Meet account</p>
                </div>
              </div>

              {/* Single group — Preferences only */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase',
                  letterSpacing: '.1em', marginBottom: 5, padding: '0 10px',
                }}>Preferences</p>
                {NAV.map(({ id, label, icon: Icon }) => {
                  const on = active === id;
                  return (
                    <button key={id} className="nb-btn" onClick={() => scrollTo(id)}
                      style={{
                        position: 'relative', width: '100%', display: 'flex', alignItems: 'center',
                        gap: 9, padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                        marginBottom: 2, fontSize: 13, fontWeight: on ? 600 : 500, fontFamily: 'inherit',
                        textAlign: 'left', background: on ? C.accentL : 'transparent',
                        color: on ? C.accent : C.muted,
                      }}>
                      {on && (
                        <motion.div layoutId="nav-bar" transition={SPR}
                          style={{
                            position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
                            borderRadius: '0 3px 3px 0', background: C.accent,
                          }} />
                      )}
                      <Icon style={{ width: 13, height: 13, flexShrink: 0, color: on ? C.accent : C.dim }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* ── MAIN ── */}
            <motion.main className="settings-main" variants={STG} initial="hidden" animate="show">

              <motion.div variants={UP} style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: isMobile ? 22 : 25, fontWeight: 700, color: C.ink, letterSpacing: '-.03em', lineHeight: 1.2 }}>
                  Settings
                </h1>
                <p style={{ fontSize: 13.5, color: C.muted, marginTop: 6, lineHeight: 1.65 }}>
                  {isMobile ? 'Manage your preferences' : 'Manage your preferences and account settings'}
                </p>
              </motion.div>

              {/* ══ Appearance ══ */}
              <Card id="pref-appearance">
                <CH icon={Sun} title="Appearance" subtitle="Choose your preferred color scheme" iColor={C.amber} iBg={C.amberBg} />
                <div className="card-body" style={{ padding: '22px' }}>
                  <div className="theme-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {THEMES.map(({ id, label, icon: Icon, note }) => {
                      const on = av.theme === id;
                      return (
                        <button key={id} onClick={() => ua('theme', id)}
                          style={{
                            position: 'relative', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 11, padding: '18px 12px', borderRadius: 12,
                            border: `2px solid ${on ? C.accent : C.border}`,
                            background: on ? C.accentL : C.surface,
                            cursor: 'pointer', textAlign: 'center', outline: 'none',
                            boxShadow: on ? '0 0 0 4px rgba(37,99,235,.09)' : '0 1px 3px rgba(0,0,0,.04)',
                            transition: 'all .18s', fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => { if (!on) { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.background = '#FAFBFC'; } }}
                          onMouseLeave={e => { if (!on) { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.background = C.surface;  } }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 11,
                            background: on ? C.accent : C.surfaceEl,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .18s',
                          }}>
                            <Icon style={{ width: 17, height: 17, color: on ? '#fff' : C.muted }} />
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: on ? C.accent : C.inkSub }}>{label}</p>
                            <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{note}</p>
                          </div>
                          {on && (
                            <motion.div layoutId="theme-tick" transition={SPR}
                              style={{
                                position: 'absolute', top: 9, right: 9, width: 20, height: 20,
                                borderRadius: '50%', background: C.accent,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 1px 4px rgba(37,99,235,.4)',
                              }}>
                              <CheckCircle2 style={{ width: 12, height: 12, color: '#fff' }} />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* ══ Notifications ══ */}
              <div style={{ marginTop: 12 }}>
                <Card id="pref-notif">
                  <CH icon={Bell} title="Notifications" subtitle="Control when and how you're notified" iColor={C.purple} iBg={C.purpleBg} />
                  <div className="tgl-wrap" style={{ padding: '8px 22px 22px' }}>
                    <TR label="Incoming Calls"        description="Get notified when someone calls you"       value={notif.incomingCalls}    onChange={v => un('incomingCalls', v)}    icon={Smartphone} />
                    <TR label="Chat Messages"         description="Notifications for new chat messages"       value={notif.chatMessages}     onChange={v => un('chatMessages', v)}     icon={BellRing} />
                    <TR label="User Online"           description="When a contact comes online"               value={notif.userOnline}       onChange={v => un('userOnline', v)}       icon={Wifi} />
                    <TR label="Meeting Reminders"     description="Reminders for scheduled meetings"          value={notif.meetingReminders} onChange={v => un('meetingReminders', v)} icon={Calendar} />
                    <TR label="Email Notifications"   description="Receive notifications via email"           value={notif.emailNotifs}      onChange={v => un('emailNotifs', v)}      icon={Mail} />
                    <TR label="Sound Effects"         description="Play sounds for notifications and events"  value={notif.soundEnabled}     onChange={v => un('soundEnabled', v)}     icon={Volume2} />
                    <TR label="Desktop Notifications" description="Show desktop pop-up notifications"         value={notif.desktopNotifs}    onChange={v => un('desktopNotifs', v)}    icon={Monitor} />
                  </div>
                </Card>
              </div>

              {/* ══ Sound & Ringtones ══ */}
              <div style={{ marginTop: 12 }}>
                <SoundSettingsCard />
              </div>

              {/* ══ Audio & Video ══ */}
              <div style={{ marginTop: 12, paddingBottom: 40 }}>
                <Card id="pref-av">
                  <CH icon={Activity} title="Audio & Video" subtitle="Default settings for meetings" iColor={C.teal} iBg={C.tealBg} />
                  <div className="tgl-wrap" style={{ padding: '8px 22px 22px' }}>
                    <TR label="Auto-join Audio"   description="Automatically join with audio enabled"  value={av.autoJoinAudio}    onChange={v => ua('autoJoinAudio', v)}    icon={Volume2} />
                    <TR label="Auto-join Video"   description="Automatically join with camera enabled" value={av.autoJoinVideo}    onChange={v => ua('autoJoinVideo', v)}    icon={User} />
                    <TR label="Mirror My Video"   description="Mirror your own camera preview"         value={av.mirrorVideo}      onChange={v => ua('mirrorVideo', v)}      icon={Monitor} />
                    <TR label="Noise Suppression" description="Reduce background noise during calls"   value={av.noiseSuppression} onChange={v => ua('noiseSuppression', v)} icon={VolumeX} />
                    <TR label="Echo Cancellation" description="Cancel audio echo during meetings"      value={av.echoCancel}       onChange={v => ua('echoCancel', v)}       icon={Volume2} />
                  </div>
                </Card>
              </div>

            </motion.main>
          </div>
        </div>
      </div>
    </>
  );
}