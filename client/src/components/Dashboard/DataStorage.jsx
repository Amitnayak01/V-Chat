import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HardDrive, Image, Video, FileText, Music, Trash2, RefreshCw, Wifi, WifiOff, ChevronRight, AlertCircle } from 'lucide-react';

/* ── Mock storage data ── */
const STORAGE_USED_MB  = 284;
const STORAGE_TOTAL_MB = 1024;
const STORAGE_PCT      = Math.round((STORAGE_USED_MB / STORAGE_TOTAL_MB) * 100);

const CACHE_ITEMS = [
  { key: 'media',     icon: Image,    label: 'Media Cache',    desc: 'Photos & videos cache',      size: '128 MB', color: '#4f6ef7', bg: '#eef3fe', border: '#c7d7fe' },
  { key: 'voice',     icon: Music,    label: 'Voice Messages', desc: 'Audio clips & recordings',   size:  '42 MB', color: '#0d9f6e', bg: '#edfaf5', border: '#bbf0d8' },
  { key: 'documents', icon: FileText, label: 'Documents',      desc: 'PDFs and shared files',      size:  '67 MB', color: '#f59e0b', bg: '#fef9ec', border: '#fde68a' },
  { key: 'video',     icon: Video,    label: 'Video Cache',    desc: 'Streamed video thumbnails',  size:  '47 MB', color: '#ef4444', bg: '#fff1f2', border: '#fecaca' },
];

const AUTO_DL_OPTIONS = ['Always', 'Wi-Fi only', 'Never'];
const QUALITY_OPTIONS = ['Auto', 'High', 'Medium', 'Low'];

export default function DataStorage() {
  const navigate = useNavigate();

  const [clearing,    setClearing]    = useState(null);
  const [cleared,     setCleared]     = useState(new Set());
  const [autoImages,  setAutoImages]  = useState('Wi-Fi only');
  const [autoVideos,  setAutoVideos]  = useState('Wi-Fi only');
  const [autoFiles,   setAutoFiles]   = useState('Always');
  const [quality,     setQuality]     = useState('Auto');
  const [dataLimiter, setDataLimiter] = useState(false);

  const handleClear = (key) => {
    setClearing(key);
    setTimeout(() => {
      setClearing(null);
      setCleared(prev => new Set([...prev, key]));
    }, 1200);
  };

  const handleClearAll = () => {
    setClearing('all');
    setTimeout(() => {
      setClearing(null);
      setCleared(new Set(CACHE_ITEMS.map(i => i.key)));
    }, 1800);
  };

  return (
    <>
      <style>{`
        .ds-root {
          min-height: 100vh;
          background: #ffffff;
          padding: clamp(24px, 4vw, 48px) clamp(16px, 4vw, 40px);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          color: #0c1120;
          box-sizing: border-box;
        }
        .ds-inner { max-width: 640px; margin: 0 auto; width: 100%; }

        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600; color: #6b7897;
          background: none; border: none; cursor: pointer; padding: 0;
          margin-bottom: 20px; transition: color .15s;
        }
        .back-btn:hover { color: #0c1120; }

        .ds-title { font-size: clamp(20px,4vw,26px); font-weight: 800; color: #0c1120; letter-spacing: -.02em; margin: 0 0 4px; }
        .ds-subtitle { font-size: 13px; color: #6b7897; margin: 0 0 28px; }

        .section-label {
          font-size: 10px; font-weight: 700; color: #9ba8bf;
          text-transform: uppercase; letter-spacing: .1em; margin: 0 0 8px 2px;
        }

        /* ── Storage bar card ── */
        .storage-card {
          background: linear-gradient(135deg, #1a1f35 0%, #2d3561 100%);
          border-radius: 20px; padding: 22px 20px; margin-bottom: 24px;
          position: relative; overflow: hidden;
        }
        .storage-card::before {
          content: ''; position: absolute; top: -40px; right: -40px;
          width: 130px; height: 130px;
          background: radial-gradient(circle, rgba(99,102,241,.3) 0%, transparent 70%);
          border-radius: 50%;
        }
        .storage-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; position: relative; z-index: 1; }
        .storage-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .1em; }
        .storage-size { font-size: 22px; font-weight: 800; color: #fff; }
        .storage-of { font-size: 12px; color: rgba(255,255,255,.45); font-weight: 500; }
        .storage-bar-bg {
          height: 8px; background: rgba(255,255,255,.12); border-radius: 99px; overflow: hidden;
          margin-bottom: 10px; position: relative; z-index: 1;
        }
        .storage-bar-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #6366f1, #818cf8);
          transition: width .6s cubic-bezier(.4,0,.2,1);
          box-shadow: 0 0 10px rgba(99,102,241,.5);
        }
        .storage-meta { display: flex; justify-content: space-between; position: relative; z-index: 1; }
        .storage-meta-item { font-size: 11px; color: rgba(255,255,255,.45); }
        .storage-meta-val  { font-weight: 700; color: rgba(255,255,255,.75); }

        /* ── Generic group ── */
        .settings-group {
          background: #fff; border-radius: 16px; border: 1px solid #e8ecf2;
          overflow: hidden; margin-bottom: 20px;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }
        .settings-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-bottom: 1px solid #f0f3f7;
          transition: background .15s;
        }
        .settings-row:last-child { border-bottom: none; }
        .settings-row.clickable { cursor: pointer; }
        .settings-row.clickable:hover { background: #f9fafb; }
        .row-icon {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .row-text { flex: 1; min-width: 0; }
        .row-title { font-size: 13.5px; font-weight: 600; color: #0c1120; margin: 0; }
        .row-sub   { font-size: 11px; color: #9ba8bf; margin: 2px 0 0; }
        .row-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .row-size  { font-size: 12px; font-weight: 700; color: #9ba8bf; }

        /* ── Clear button ── */
        .clear-btn {
          font-size: 11px; font-weight: 700; padding: 5px 11px; border-radius: 8px;
          border: 1px solid; cursor: pointer; transition: all .15s; white-space: nowrap;
        }
        .clear-btn.idle   { color: #ef4444; background: #fff1f2; border-color: #fecaca; }
        .clear-btn.idle:hover { background: #fee2e2; }
        .clear-btn.busy   { color: #9ba8bf; background: #f9fafb; border-color: #e8ecf2; cursor: not-allowed; }
        .clear-btn.done   { color: #0d9f6e; background: #edfaf5; border-color: #bbf0d8; }

        /* ── Toggle ── */
        .toggle-track {
          width: 44px; height: 24px; border-radius: 99px; border: none; cursor: pointer;
          position: relative; transition: background .2s; flex-shrink: 0;
          padding: 0;
        }
        .toggle-thumb {
          position: absolute; top: 3px; width: 18px; height: 18px;
          border-radius: 50%; background: #fff; transition: left .2s;
          box-shadow: 0 1px 4px rgba(0,0,0,.2);
        }

        /* ── Segmented selector ── */
        .seg-wrap { display: flex; gap: 6px; flex-wrap: wrap; }
        .seg-btn {
          font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 8px;
          border: 1px solid; cursor: pointer; transition: all .15s;
          background: #f9fafb; border-color: #e8ecf2; color: #6b7897;
        }
        .seg-btn.active { background: #eef3fe; border-color: #c7d7fe; color: #4f6ef7; }

        /* ── Clear all ── */
        .clear-all-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px; border-radius: 14px; border: 1px dashed #fecaca;
          background: #fff1f2; color: #ef4444; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all .15s; margin-bottom: 20px;
        }
        .clear-all-btn:hover { background: #fee2e2; border-color: #fca5a5; }
        .clear-all-btn:disabled { opacity: .5; cursor: not-allowed; }

        /* ── Info banner ── */
        .info-banner {
          display: flex; align-items: flex-start; gap: 10px;
          background: #fef9ec; border: 1px solid #fde68a; border-radius: 14px;
          padding: 14px; margin-bottom: 20px;
        }
        .info-text { font-size: 12px; color: #92400e; line-height: 1.5; margin: 0; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin .8s linear infinite; }
      `}</style>

      <div className="ds-root">
        <div className="ds-inner">

          {/* Back */}
          <button className="back-btn" onClick={() => window.history.back()}>
            <ArrowLeft size={15} /> Settings
          </button>

          <h1 className="ds-title">Data &amp; Storage</h1>
          <p className="ds-subtitle">Manage cache, downloads &amp; media quality</p>

          {/* ── Storage overview ── */}
          <div className="storage-card">
            <div className="storage-top">
              <div>
                <p className="storage-label">Storage Used</p>
                <p className="storage-size">
                  {cleared.size === CACHE_ITEMS.length ? '0 MB' : `${STORAGE_USED_MB} MB`}
                  <span className="storage-of"> / {STORAGE_TOTAL_MB} MB</span>
                </p>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HardDrive size={22} color="rgba(255,255,255,.8)" />
              </div>
            </div>
            <div className="storage-bar-bg">
              <div
                className="storage-bar-fill"
                style={{ width: cleared.size === CACHE_ITEMS.length ? '0%' : `${STORAGE_PCT}%` }}
              />
            </div>
            <div className="storage-meta">
              <span className="storage-meta-item">
                Used: <span className="storage-meta-val">{cleared.size === CACHE_ITEMS.length ? '0 MB' : `${STORAGE_USED_MB} MB`}</span>
              </span>
              <span className="storage-meta-item">
                Free: <span className="storage-meta-val">{cleared.size === CACHE_ITEMS.length ? `${STORAGE_TOTAL_MB} MB` : `${STORAGE_TOTAL_MB - STORAGE_USED_MB} MB`}</span>
              </span>
              <span className="storage-meta-item">
                <span className="storage-meta-val">{cleared.size === CACHE_ITEMS.length ? 0 : STORAGE_PCT}%</span> used
              </span>
            </div>
          </div>

          {/* ── Cache ── */}
          <p className="section-label">Cache &amp; Stored Data</p>
          <div className="settings-group">
            {CACHE_ITEMS.map(({ key, icon: Icon, label, desc, size, color, bg, border }) => {
              const isBusy  = clearing === key || clearing === 'all';
              const isDone  = cleared.has(key);
              return (
                <div className="settings-row" key={key}>
                  <div className="row-icon" style={{ background: bg, border: `1px solid ${border}` }}>
                    <Icon size={16} color={color} />
                  </div>
                  <div className="row-text">
                    <p className="row-title">{label}</p>
                    <p className="row-sub">{desc}</p>
                  </div>
                  <div className="row-right">
                    <span className="row-size">{isDone ? '0 MB' : size}</span>
                    <button
                      className={`clear-btn ${isDone ? 'done' : isBusy ? 'busy' : 'idle'}`}
                      onClick={() => !isBusy && !isDone && handleClear(key)}
                      disabled={isBusy || isDone}
                    >
                      {isBusy
                        ? <RefreshCw size={11} className="spinning" style={{ display: 'inline' }} />
                        : isDone ? 'Cleared' : 'Clear'
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clear all */}
          <button
            className="clear-all-btn"
            onClick={handleClearAll}
            disabled={!!clearing || cleared.size === CACHE_ITEMS.length}
          >
            {clearing === 'all'
              ? <><RefreshCw size={15} className="spinning" /> Clearing…</>
              : cleared.size === CACHE_ITEMS.length
              ? <><Trash2 size={15} /> All Cache Cleared</>
              : <><Trash2 size={15} /> Clear All Cache</>
            }
          </button>

          {/* ── Auto-download ── */}
          <p className="section-label">Auto-Download</p>
          <div className="settings-group">

            <div className="settings-row">
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #c7d7fe' }}>
                <Image size={16} color="#4f6ef7" />
              </div>
              <div className="row-text">
                <p className="row-title">Images</p>
                <p className="row-sub">Auto-download photos</p>
              </div>
              <div className="seg-wrap">
                {AUTO_DL_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`seg-btn ${autoImages === opt ? 'active' : ''}`}
                    onClick={() => setAutoImages(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="row-icon" style={{ background: '#fff1f2', border: '1px solid #fecaca' }}>
                <Video size={16} color="#ef4444" />
              </div>
              <div className="row-text">
                <p className="row-title">Videos</p>
                <p className="row-sub">Auto-download video clips</p>
              </div>
              <div className="seg-wrap">
                {AUTO_DL_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`seg-btn ${autoVideos === opt ? 'active' : ''}`}
                    onClick={() => setAutoVideos(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="row-icon" style={{ background: '#fef9ec', border: '1px solid #fde68a' }}>
                <FileText size={16} color="#f59e0b" />
              </div>
              <div className="row-text">
                <p className="row-title">Files &amp; Docs</p>
                <p className="row-sub">Auto-download documents</p>
              </div>
              <div className="seg-wrap">
                {AUTO_DL_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`seg-btn ${autoFiles === opt ? 'active' : ''}`}
                    onClick={() => setAutoFiles(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>

          </div>

          {/* ── Media quality ── */}
          <p className="section-label">Media Quality</p>
          <div className="settings-group">
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#edfaf5', border: '1px solid #bbf0d8' }}>
                <Video size={16} color="#0d9f6e" />
              </div>
              <div className="row-text">
                <p className="row-title">Video Call Quality</p>
                <p className="row-sub">Higher quality uses more data</p>
              </div>
              <div className="seg-wrap">
                {QUALITY_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`seg-btn ${quality === opt ? 'active' : ''}`}
                    onClick={() => setQuality(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Network ── */}
          <p className="section-label">Network</p>
          <div className="settings-group">
            <div className="settings-row">
              <div className="row-icon" style={{ background: dataLimiter ? '#edfaf5' : '#f9fafb', border: `1px solid ${dataLimiter ? '#bbf0d8' : '#e8ecf2'}` }}>
                {dataLimiter ? <Wifi size={16} color="#0d9f6e" /> : <WifiOff size={16} color="#9ba8bf" />}
              </div>
              <div className="row-text">
                <p className="row-title">Data Saver</p>
                <p className="row-sub">Reduce data usage on mobile networks</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: dataLimiter ? '#0d9f6e' : '#e2e8f0' }}
                onClick={() => setDataLimiter(v => !v)}
              >
                <div
                  className="toggle-thumb"
                  style={{ left: dataLimiter ? '23px' : '3px' }}
                />
              </button>
            </div>

            <div className="settings-row clickable" onClick={() => {}}>
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #c7d7fe' }}>
                <HardDrive size={16} color="#4f6ef7" />
              </div>
              <div className="row-text">
                <p className="row-title">Network Usage</p>
                <p className="row-sub">View detailed data consumption</p>
              </div>
              <ChevronRight size={16} color="#9ba8bf" />
            </div>
          </div>

          {/* Info banner */}
          <div className="info-banner">
            <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <p className="info-text">
              Clearing cache removes temporarily stored files. Your messages, contacts, and account data will not be affected.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}