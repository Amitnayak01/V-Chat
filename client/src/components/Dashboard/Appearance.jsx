import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Sun, Moon, Monitor, Type, Layout,
  Check, Palette, Maximize2, AlignLeft, Grid,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Defaults & storage key
───────────────────────────────────────────── */
const STORAGE_KEY = 'vmeet_appearance';

const DEFAULTS = {
  theme:       'light',   // 'light' | 'dark' | 'system'
  accent:      'blue',    // see ACCENTS
  fontSize:    'medium',  // 'small' | 'medium' | 'large' | 'xlarge'
  fontFamily:  'default', // 'default' | 'serif' | 'mono'
  layout:      'default', // 'default' | 'compact' | 'comfortable'
  sidebarPos:  'left',    // 'left' | 'right'
  animations:  true,
  roundedUI:   true,
};

const load = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return DEFAULTS; }
};

/* ─────────────────────────────────────────────
   Config data
───────────────────────────────────────────── */
const THEMES = [
  { id: 'light',  label: 'Light',  icon: Sun,     bg: '#ffffff', fg: '#0c1120', border: '#e8ecf2' },
  { id: 'dark',   label: 'Dark',   icon: Moon,    bg: '#0f1923', fg: '#f1f5f9', border: '#1e293b' },
  { id: 'system', label: 'System', icon: Monitor, bg: 'linear-gradient(135deg,#fff 50%,#0f1923 50%)', fg: '#6b7897', border: '#e8ecf2' },
];

const ACCENTS = [
  { id: 'blue',    label: 'Blue',    color: '#4f6ef7' },
  { id: 'violet',  label: 'Violet',  color: '#7c3aed' },
  { id: 'emerald', label: 'Emerald', color: '#059669' },
  { id: 'rose',    label: 'Rose',    color: '#e11d48' },
  { id: 'amber',   label: 'Amber',   color: '#d97706' },
  { id: 'cyan',    label: 'Cyan',    color: '#0891b2' },
];

const FONT_SIZES = [
  { id: 'small',   label: 'Small',   size: '13px', preview: 'Aa' },
  { id: 'medium',  label: 'Medium',  size: '15px', preview: 'Aa' },
  { id: 'large',   label: 'Large',   size: '17px', preview: 'Aa' },
  { id: 'xlarge',  label: 'X-Large', size: '19px', preview: 'Aa' },
];

const FONT_FAMILIES = [
  { id: 'default', label: 'Default',   family: "'Plus Jakarta Sans', system-ui, sans-serif", preview: 'Hello' },
  { id: 'serif',   label: 'Serif',     family: "'Georgia', 'Times New Roman', serif",          preview: 'Hello' },
  { id: 'mono',    label: 'Monospace', family: "'JetBrains Mono', 'Courier New', monospace",   preview: 'Hello' },
];

const LAYOUTS = [
  { id: 'default',     label: 'Default',     desc: 'Balanced spacing',  icon: Layout   },
  { id: 'compact',     label: 'Compact',     desc: 'More content',      icon: AlignLeft },
  { id: 'comfortable', label: 'Comfortable', desc: 'Relaxed spacing',   icon: Maximize2 },
];

/* ─────────────────────────────────────────────
   Apply settings to :root
───────────────────────────────────────────── */
const applySettings = (s) => {
  const root = document.documentElement;

  /* Theme */
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = s.theme === 'dark' || (s.theme === 'system' && prefersDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if (isDark) {
    root.style.setProperty('--bg-primary',   '#0f1923');
    root.style.setProperty('--bg-secondary', '#1e293b');
    root.style.setProperty('--text-primary', '#f1f5f9');
    root.style.setProperty('--text-muted',   '#64748b');
    root.style.setProperty('--border-color', '#1e293b');
  } else {
    root.style.setProperty('--bg-primary',   '#ffffff');
    root.style.setProperty('--bg-secondary', '#f8fafc');
    root.style.setProperty('--text-primary', '#0c1120');
    root.style.setProperty('--text-muted',   '#6b7897');
    root.style.setProperty('--border-color', '#e8ecf2');
  }

  /* Accent */
  const accentMap = {
    blue:    '#4f6ef7', violet: '#7c3aed', emerald: '#059669',
    rose:    '#e11d48', amber:  '#d97706', cyan:    '#0891b2',
  };
  root.style.setProperty('--accent', accentMap[s.accent] || '#4f6ef7');

  /* Font size */
  const sizeMap = { small: '13px', medium: '15px', large: '17px', xlarge: '19px' };
  root.style.setProperty('--base-font-size', sizeMap[s.fontSize] || '15px');

  /* Font family */
  const familyMap = {
    default: "'Plus Jakarta Sans', system-ui, sans-serif",
    serif:   "'Georgia', 'Times New Roman', serif",
    mono:    "'JetBrains Mono', 'Courier New', monospace",
  };
  root.style.setProperty('--font-family', familyMap[s.fontFamily] || familyMap.default);
  document.body.style.fontFamily = familyMap[s.fontFamily] || familyMap.default;

  /* Border radius */
  root.style.setProperty('--radius', s.roundedUI ? '12px' : '4px');

  /* Animations */
  root.style.setProperty('--transition', s.animations ? 'all .2s' : 'none');

  /* Layout density */
  const densityMap = { compact: '10px', default: '14px', comfortable: '20px' };
  root.style.setProperty('--row-padding', densityMap[s.layout] || '14px');

  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
};

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function Appearance() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(load);
  const [saved,    setSaved]    = useState(false);

  /* Apply on every change */
  useEffect(() => { applySettings(settings); }, [settings]);

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const handleReset = () => {
    setSettings(DEFAULTS);
    applySettings(DEFAULTS);
  };

  const handleSave = () => {
    applySettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const accent = ACCENTS.find(a => a.id === settings.accent)?.color || '#4f6ef7';

  return (
    <>
      <style>{`
        .ap-root {
          min-height: 100vh;
          background: #ffffff;
          padding: clamp(24px,4vw,48px) clamp(16px,4vw,40px);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          color: #0c1120;
          box-sizing: border-box;
        }
        .ap-inner { max-width: 640px; margin: 0 auto; width: 100%; }

        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600; color: #6b7897;
          background: none; border: none; cursor: pointer; padding: 0;
          margin-bottom: 20px; transition: color .15s;
        }
        .back-btn:hover { color: #0c1120; }

        .ap-title    { font-size: clamp(20px,4vw,26px); font-weight: 800; color: #0c1120; letter-spacing: -.02em; margin: 0 0 4px; }
        .ap-subtitle { font-size: 13px; color: #6b7897; margin: 0 0 28px; }

        /* ── Live preview card ── */
        .preview-card {
          border-radius: 20px; border: 1px solid #e8ecf2;
          overflow: hidden; margin-bottom: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,.06);
        }
        .preview-top {
          padding: 10px 14px; display: flex; align-items: center; gap: 8px;
          border-bottom: 1px solid #f0f3f7;
        }
        .preview-dots { display: flex; gap: 5px; }
        .preview-dot  { width: 10px; height: 10px; border-radius: 50%; }
        .preview-title { font-size: 11px; font-weight: 700; color: #9ba8bf; margin-left: 4px; }
        .preview-body  { padding: 16px; background: #f9fafb; }
        .preview-msg-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 10px; }
        .preview-msg-row.me { flex-direction: row-reverse; }
        .preview-avatar { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
        .preview-bubble { max-width: 65%; padding: 9px 13px; border-radius: 14px; font-size: 12px; font-weight: 500; line-height: 1.4; }
        .preview-bubble.them { background: #fff; color: #0c1120; border: 1px solid #e8ecf2; border-bottom-left-radius: 4px; }
        .preview-bubble.me   { color: #fff; border-bottom-right-radius: 4px; }

        /* ── Section label ── */
        .section-label {
          font-size: 10px; font-weight: 700; color: #9ba8bf;
          text-transform: uppercase; letter-spacing: .1em; margin: 0 0 8px 2px;
        }

        /* ── Group ── */
        .settings-group {
          background: #fff; border-radius: 16px; border: 1px solid #e8ecf2;
          overflow: hidden; margin-bottom: 20px;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }
        .settings-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-bottom: 1px solid #f0f3f7;
        }
        .settings-row:last-child { border-bottom: none; }
        .row-icon {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .row-text { flex: 1; min-width: 0; }
        .row-title { font-size: 13.5px; font-weight: 600; color: #0c1120; margin: 0; }
        .row-sub   { font-size: 11px; color: #9ba8bf; margin: 2px 0 0; }

        /* ── Theme cards ── */
        .theme-grid { display: flex; gap: 10px; padding: 14px 16px; }
        .theme-card {
          flex: 1; border-radius: 14px; border: 2px solid #e8ecf2;
          padding: 14px 10px; cursor: pointer; transition: all .15s;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          position: relative; overflow: hidden;
        }
        .theme-card:hover { border-color: #c7d7fe; }
        .theme-card.active { border-width: 2px; }
        .theme-preview {
          width: 48px; height: 32px; border-radius: 8px; border: 1px solid rgba(0,0,0,.08);
          overflow: hidden; position: relative;
        }
        .theme-check {
          position: absolute; top: 6px; right: 6px;
          width: 18px; height: 18px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .theme-label { font-size: 11px; font-weight: 700; color: #0c1120; }

        /* ── Accent swatches ── */
        .accent-row { display: flex; gap: 10px; padding: 14px 16px; flex-wrap: wrap; }
        .accent-swatch {
          width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          border: 3px solid transparent; transition: all .15s;
          box-shadow: 0 2px 8px rgba(0,0,0,.12);
        }
        .accent-swatch:hover { transform: scale(1.12); }
        .accent-swatch.active { border-color: #ffffff; outline: 3px solid; }

        /* ── Font size selector ── */
        .fontsize-grid { display: flex; gap: 8px; padding: 14px 16px; }
        .fontsize-card {
          flex: 1; border-radius: 12px; border: 2px solid #e8ecf2;
          padding: 12px 8px; cursor: pointer; transition: all .15s;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .fontsize-card:hover  { border-color: #c7d7fe; }
        .fontsize-card.active { border-width: 2px; }
        .fontsize-preview { font-weight: 800; color: #0c1120; line-height: 1; }
        .fontsize-label   { font-size: 10px; font-weight: 700; color: #9ba8bf; }

        /* ── Font family ── */
        .fontfam-grid { display: flex; gap: 8px; padding: 14px 16px; }
        .fontfam-card {
          flex: 1; border-radius: 12px; border: 2px solid #e8ecf2;
          padding: 12px 8px; cursor: pointer; transition: all .15s;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .fontfam-card:hover  { border-color: #c7d7fe; }
        .fontfam-card.active { border-width: 2px; }
        .fontfam-preview { font-size: 18px; font-weight: 700; color: #0c1120; }
        .fontfam-label   { font-size: 10px; font-weight: 700; color: #9ba8bf; text-align: center; }

        /* ── Layout selector ── */
        .layout-grid { display: flex; gap: 8px; padding: 14px 16px; }
        .layout-card {
          flex: 1; border-radius: 12px; border: 2px solid #e8ecf2;
          padding: 12px 8px; cursor: pointer; transition: all .15s;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .layout-card:hover  { border-color: #c7d7fe; }
        .layout-card.active { border-width: 2px; }
        .layout-label { font-size: 11px; font-weight: 700; color: #0c1120; }
        .layout-desc  { font-size: 10px; color: #9ba8bf; }

        /* ── Toggle ── */
        .toggle-track {
          width: 44px; height: 24px; border-radius: 99px; border: none;
          cursor: pointer; position: relative; padding: 0; flex-shrink: 0;
          transition: background .2s;
        }
        .toggle-thumb {
          position: absolute; top: 3px; width: 18px; height: 18px;
          border-radius: 50%; background: #fff;
          transition: left .2s; box-shadow: 0 1px 4px rgba(0,0,0,.2);
        }

        /* ── Action buttons ── */
        .action-row { display: flex; gap: 10px; margin-bottom: 32px; }
        .save-btn {
          flex: 1; padding: 13px; border-radius: 14px; border: none;
          font-size: 14px; font-weight: 800; cursor: pointer;
          transition: all .15s; color: #fff;
        }
        .save-btn:active { transform: scale(.97); }
        .reset-btn {
          padding: 13px 20px; border-radius: 14px;
          border: 1px solid #e8ecf2; background: #fff;
          font-size: 13px; font-weight: 700; color: #6b7897;
          cursor: pointer; transition: all .15s;
        }
        .reset-btn:hover { background: #f9fafb; }
      `}</style>

      <div className="ap-root">
        <div className="ap-inner">

          {/* Back */}
          <button className="back-btn" onClick={() => window.history.back()}>
            <ArrowLeft size={15} /> Settings
          </button>

          <h1 className="ap-title">Appearance</h1>
          <p className="ap-subtitle">Personalise how V-Meet looks and feels</p>

          {/* ── Live Preview ── */}
          <div className="preview-card">
            <div className="preview-top">
              <div className="preview-dots">
                <div className="preview-dot" style={{ background: '#ff5f57' }} />
                <div className="preview-dot" style={{ background: '#febc2e' }} />
                <div className="preview-dot" style={{ background: '#28c840' }} />
              </div>
              <span className="preview-title">LIVE PREVIEW</span>
            </div>
            <div className="preview-body">
              <div className="preview-msg-row">
                <div className="preview-avatar" style={{ background: '#e8ecf2', color: '#6b7897' }}>A</div>
                <div className="preview-bubble them"
                  style={{
                    fontFamily: FONT_FAMILIES.find(f => f.id === settings.fontFamily)?.family,
                    fontSize:   FONT_SIZES.find(f => f.id === settings.fontSize)?.size,
                    borderRadius: settings.roundedUI ? '14px' : '4px',
                  }}
                >
                  Hey! Ready for the call? 👋
                </div>
              </div>
              <div className="preview-msg-row me">
                <div className="preview-avatar" style={{ background: accent, color: '#fff' }}>Y</div>
                <div className="preview-bubble me"
                  style={{
                    background:  accent,
                    fontFamily:  FONT_FAMILIES.find(f => f.id === settings.fontFamily)?.family,
                    fontSize:    FONT_SIZES.find(f => f.id === settings.fontSize)?.size,
                    borderRadius: settings.roundedUI ? '14px' : '4px',
                  }}
                >
                  Yes! Starting the meeting now 🚀
                </div>
              </div>
            </div>
          </div>

          {/* ── Theme ── */}
          <p className="section-label">Theme</p>
          <div className="settings-group" style={{ marginBottom: 20 }}>
            <div className="theme-grid">
              {THEMES.map(t => {
                const isActive = settings.theme === t.id;
                return (
                  <div
                    key={t.id}
                    className={`theme-card ${isActive ? 'active' : ''}`}
                    style={{ borderColor: isActive ? accent : '#e8ecf2' }}
                    onClick={() => update('theme', t.id)}
                  >
                    {isActive && (
                      <div className="theme-check" style={{ background: accent }}>
                        <Check size={10} color="#fff" />
                      </div>
                    )}
                    <div
                      className="theme-preview"
                      style={{ background: typeof t.bg === 'string' && t.bg.startsWith('linear') ? t.bg : t.bg }}
                    >
                      {t.id !== 'system' && (
                        <div style={{ padding: '4px 6px' }}>
                          <div style={{ width: '60%', height: 4, borderRadius: 2, background: t.id === 'dark' ? '#334155' : '#e8ecf2', marginBottom: 3 }} />
                          <div style={{ width: '40%', height: 4, borderRadius: 2, background: accent }} />
                        </div>
                      )}
                    </div>
                    <t.icon size={14} color={isActive ? accent : '#9ba8bf'} />
                    <span className="theme-label" style={{ color: isActive ? accent : '#6b7897' }}>{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Accent color ── */}
          <p className="section-label">Accent Color</p>
          <div className="settings-group" style={{ marginBottom: 20 }}>
            <div className="accent-row">
              {ACCENTS.map(a => (
                <div
                  key={a.id}
                  className={`accent-swatch ${settings.accent === a.id ? 'active' : ''}`}
                  style={{
                    background:   a.color,
                    outlineColor: settings.accent === a.id ? a.color : 'transparent',
                  }}
                  title={a.label}
                  onClick={() => update('accent', a.id)}
                >
                  {settings.accent === a.id && <Check size={14} color="#fff" strokeWidth={3} />}
                </div>
              ))}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#9ba8bf', marginLeft: 6, alignSelf: 'center' }}>
                {ACCENTS.find(a => a.id === settings.accent)?.label}
              </span>
            </div>
          </div>

          {/* ── Font size ── */}
          <p className="section-label">Font Size</p>
          <div className="settings-group" style={{ marginBottom: 20 }}>
            <div className="fontsize-grid">
              {FONT_SIZES.map(f => {
                const isActive = settings.fontSize === f.id;
                return (
                  <div
                    key={f.id}
                    className={`fontsize-card ${isActive ? 'active' : ''}`}
                    style={{ borderColor: isActive ? accent : '#e8ecf2', background: isActive ? `${accent}08` : '#fff' }}
                    onClick={() => update('fontSize', f.id)}
                  >
                    <span className="fontsize-preview" style={{ fontSize: f.size, color: isActive ? accent : '#0c1120' }}>
                      {f.preview}
                    </span>
                    <span className="fontsize-label" style={{ color: isActive ? accent : '#9ba8bf' }}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Font family ── */}
          <p className="section-label">Font Style</p>
          <div className="settings-group" style={{ marginBottom: 20 }}>
            <div className="fontfam-grid">
              {FONT_FAMILIES.map(f => {
                const isActive = settings.fontFamily === f.id;
                return (
                  <div
                    key={f.id}
                    className={`fontfam-card ${isActive ? 'active' : ''}`}
                    style={{ borderColor: isActive ? accent : '#e8ecf2', background: isActive ? `${accent}08` : '#fff' }}
                    onClick={() => update('fontFamily', f.id)}
                  >
                    <span className="fontfam-preview" style={{ fontFamily: f.family, color: isActive ? accent : '#0c1120' }}>
                      {f.preview}
                    </span>
                    <span className="fontfam-label" style={{ color: isActive ? accent : '#9ba8bf' }}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Layout ── */}
          <p className="section-label">Layout Density</p>
          <div className="settings-group" style={{ marginBottom: 20 }}>
            <div className="layout-grid">
              {LAYOUTS.map(l => {
                const isActive = settings.layout === l.id;
                return (
                  <div
                    key={l.id}
                    className={`layout-card ${isActive ? 'active' : ''}`}
                    style={{ borderColor: isActive ? accent : '#e8ecf2', background: isActive ? `${accent}08` : '#fff' }}
                    onClick={() => update('layout', l.id)}
                  >
                    <l.icon size={18} color={isActive ? accent : '#9ba8bf'} />
                    <span className="layout-label" style={{ color: isActive ? accent : '#0c1120' }}>{l.label}</span>
                    <span className="layout-desc">{l.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Display options ── */}
          <p className="section-label">Display Options</p>
          <div className="settings-group" style={{ marginBottom: 20 }}>

            <div className="settings-row">
              <div className="row-icon" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                <Palette size={16} color={accent} />
              </div>
              <div className="row-text">
                <p className="row-title">Rounded UI</p>
                <p className="row-sub">Softer corners on cards and buttons</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: settings.roundedUI ? accent : '#e2e8f0' }}
                onClick={() => update('roundedUI', !settings.roundedUI)}
              >
                <div className="toggle-thumb" style={{ left: settings.roundedUI ? '23px' : '3px' }} />
              </button>
            </div>

            <div className="settings-row">
              <div className="row-icon" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                <Grid size={16} color={accent} />
              </div>
              <div className="row-text">
                <p className="row-title">Animations</p>
                <p className="row-sub">Enable transitions and motion effects</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: settings.animations ? accent : '#e2e8f0' }}
                onClick={() => update('animations', !settings.animations)}
              >
                <div className="toggle-thumb" style={{ left: settings.animations ? '23px' : '3px' }} />
              </button>
            </div>

          </div>

          {/* ── Actions ── */}
          <div className="action-row">
            <button
              className="save-btn"
              style={{ background: accent, boxShadow: `0 4px 16px ${accent}40` }}
              onClick={handleSave}
            >
              {saved ? '✓ Saved!' : 'Apply Changes'}
            </button>
            <button className="reset-btn" onClick={handleReset}>
              Reset
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Boot helper — call this once in main.jsx / index.js
   import { initAppearance } from './components/Dashboard/Appearance';
   initAppearance();
───────────────────────────────────────────── */
export function initAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    applySettings({ ...DEFAULTS, ...saved });
  } catch {
    applySettings(DEFAULTS);
  }
}