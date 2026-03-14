import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Lock, Eye, EyeOff, UserX, Bell,
  Smartphone, Key, ChevronRight, AlertTriangle, CheckCircle,
  Clock, Globe, MessageCircle, Phone, Video
} from 'lucide-react';

const BLOCKED_CONTACTS = [
  { id: 1, name: 'John Smith',   avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',   since: '2 weeks ago' },
  { id: 2, name: 'Alice Brown',  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',  since: '1 month ago' },
];

export default function PrivacySecurity() {
  const navigate = useNavigate();

  /* ── Privacy toggles ── */
  const [lastSeen,       setLastSeen]       = useState('Everyone');
  const [profilePhoto,   setProfilePhoto]   = useState('Everyone');
  const [onlineStatus,   setOnlineStatus]   = useState(true);
  const [readReceipts,   setReadReceipts]   = useState(true);
  const [typingIndicator,setTypingIndicator]= useState(true);
  const [callsFrom,      setCallsFrom]      = useState('Everyone');

  /* ── Security toggles ── */
  const [twoFactor,      setTwoFactor]      = useState(false);
  const [loginAlerts,    setLoginAlerts]    = useState(true);
  const [screenLock,     setScreenLock]     = useState(false);

  /* ── Blocked ── */
  const [blocked, setBlocked] = useState(BLOCKED_CONTACTS);
  const [unblocking, setUnblocking] = useState(null);

  const handleUnblock = (id) => {
    setUnblocking(id);
    setTimeout(() => {
      setBlocked(prev => prev.filter(c => c.id !== id));
      setUnblocking(null);
    }, 900);
  };

  const VISIBILITY_OPTIONS = ['Everyone', 'Contacts', 'Nobody'];
  const CALL_OPTIONS        = ['Everyone', 'Contacts', 'Nobody'];

  return (
    <>
      <style>{`
        .ps-root {
          min-height: 100vh;
          background: #ffffff;
          padding: clamp(24px,4vw,48px) clamp(16px,4vw,40px);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          color: #0c1120;
          box-sizing: border-box;
        }
        .ps-inner { max-width: 640px; margin: 0 auto; width: 100%; }

        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600; color: #6b7897;
          background: none; border: none; cursor: pointer; padding: 0;
          margin-bottom: 20px; transition: color .15s;
        }
        .back-btn:hover { color: #0c1120; }

        .ps-title   { font-size: clamp(20px,4vw,26px); font-weight: 800; color: #0c1120; letter-spacing: -.02em; margin: 0 0 4px; }
        .ps-subtitle{ font-size: 13px; color: #6b7897; margin: 0 0 28px; }

        /* ── Hero banner ── */
        .hero-banner {
          background: linear-gradient(135deg, #1a1f35 0%, #2d3561 100%);
          border-radius: 20px; padding: 22px 20px; margin-bottom: 24px;
          display: flex; align-items: center; gap: 18px;
          position: relative; overflow: hidden;
        }
        .hero-banner::before {
          content: ''; position: absolute; top: -30px; right: -30px;
          width: 110px; height: 110px;
          background: radial-gradient(circle, rgba(99,102,241,.3) 0%, transparent 70%);
          border-radius: 50%;
        }
        .hero-icon-wrap {
          width: 56px; height: 56px; border-radius: 16px;
          background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          position: relative; z-index: 1;
        }
        .hero-text { position: relative; z-index: 1; }
        .hero-title { font-size: 16px; font-weight: 800; color: #fff; margin: 0 0 4px; }
        .hero-sub   { font-size: 12px; color: rgba(255,255,255,.5); margin: 0 0 12px; }
        .security-score {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18);
          border-radius: 8px; padding: 5px 11px;
          font-size: 12px; font-weight: 700; color: #fff;
        }
        .score-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; }

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
          transition: background .15s;
        }
        .settings-row:last-child { border-bottom: none; }
        .settings-row.clickable { cursor: pointer; }
        .settings-row.clickable:hover { background: #f9fafb; }

        .row-icon {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .row-text { flex: 1; min-width: 0; }
        .row-title { font-size: 13.5px; font-weight: 600; color: #0c1120; margin: 0; }
        .row-sub   { font-size: 11px; color: #9ba8bf; margin: 2px 0 0; }
        .row-arrow { color: #9ba8bf; font-size: 18px; flex-shrink: 0; }

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

        /* ── Segmented ── */
        .seg-wrap { display: flex; gap: 5px; flex-wrap: wrap; flex-shrink: 0; }
        .seg-btn {
          font-size: 11px; font-weight: 700; padding: 5px 11px;
          border-radius: 8px; border: 1px solid; cursor: pointer;
          transition: all .15s; background: #f9fafb;
          border-color: #e8ecf2; color: #6b7897;
        }
        .seg-btn.active { background: #eef3fe; border-color: #c7d7fe; color: #4f6ef7; }

        /* ── 2FA badge ── */
        .twofa-badge {
          font-size: 10px; font-weight: 700; padding: 3px 9px;
          border-radius: 6px; white-space: nowrap; flex-shrink: 0;
        }
        .twofa-badge.on  { background: #edfaf5; border: 1px solid #bbf0d8; color: #0d9f6e; }
        .twofa-badge.off { background: #fff1f2; border: 1px solid #fecaca; color: #ef4444; }

        /* ── Blocked contact row ── */
        .blocked-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; border-bottom: 1px solid #f0f3f7;
        }
        .blocked-row:last-child { border-bottom: none; }
        .blocked-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .blocked-name  { font-size: 13px; font-weight: 600; color: #0c1120; margin: 0; }
        .blocked-since { font-size: 11px; color: #9ba8bf; margin: 2px 0 0; }
        .unblock-btn {
          margin-left: auto; font-size: 11px; font-weight: 700;
          padding: 5px 12px; border-radius: 8px; border: 1px solid #fecaca;
          background: #fff1f2; color: #ef4444; cursor: pointer;
          transition: all .15s; flex-shrink: 0;
        }
        .unblock-btn:hover    { background: #fee2e2; }
        .unblock-btn:disabled { opacity: .5; cursor: not-allowed; }
        .no-blocked {
          padding: 20px 16px; text-align: center;
          font-size: 13px; color: #9ba8bf; font-weight: 500;
        }

        /* ── Warning banner ── */
        .warn-banner {
          display: flex; align-items: flex-start; gap: 10px;
          background: #fff9ec; border: 1px solid #fde68a;
          border-radius: 14px; padding: 14px; margin-bottom: 20px;
        }
        .warn-text { font-size: 12px; color: #92400e; line-height: 1.5; margin: 0; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin .8s linear infinite; }
      `}</style>

      <div className="ps-root">
        <div className="ps-inner">

          {/* Back */}
          <button className="back-btn" onClick={() => window.history.back()}>
            <ArrowLeft size={15} /> Settings
          </button>

          <h1 className="ps-title">Privacy &amp; Security</h1>
          <p className="ps-subtitle">Control who sees your info and secure your account</p>

          {/* ── Hero ── */}
          <div className="hero-banner">
            <div className="hero-icon-wrap">
              <Shield size={26} color="rgba(255,255,255,.9)" />
            </div>
            <div className="hero-text">
              <p className="hero-title">Account Protection</p>
              <p className="hero-sub">Keep your account safe and private</p>
              <div className="security-score">
                <span className="score-dot" />
                {twoFactor ? 'Strong' : 'Moderate'} Security
              </div>
            </div>
          </div>

          {/* ── Privacy ── */}
          <p className="section-label">Privacy</p>
          <div className="settings-group">

            {/* Last seen */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #c7d7fe' }}>
                <Clock size={16} color="#4f6ef7" />
              </div>
              <div className="row-text">
                <p className="row-title">Last Seen</p>
                <p className="row-sub">Who can see when you were last active</p>
              </div>
              <div className="seg-wrap">
                {VISIBILITY_OPTIONS.map(opt => (
                  <button key={opt} className={`seg-btn ${lastSeen === opt ? 'active' : ''}`} onClick={() => setLastSeen(opt)}>{opt}</button>
                ))}
              </div>
            </div>

            {/* Profile photo */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#f3efff', border: '1px solid #ddd6fe' }}>
                <Eye size={16} color="#7c3aed" />
              </div>
              <div className="row-text">
                <p className="row-title">Profile Photo</p>
                <p className="row-sub">Who can see your profile picture</p>
              </div>
              <div className="seg-wrap">
                {VISIBILITY_OPTIONS.map(opt => (
                  <button key={opt} className={`seg-btn ${profilePhoto === opt ? 'active' : ''}`} onClick={() => setProfilePhoto(opt)}>{opt}</button>
                ))}
              </div>
            </div>

            {/* Online status */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#edfaf5', border: '1px solid #bbf0d8' }}>
                <Globe size={16} color="#0d9f6e" />
              </div>
              <div className="row-text">
                <p className="row-title">Online Status</p>
                <p className="row-sub">Show when you're currently active</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: onlineStatus ? '#0d9f6e' : '#e2e8f0' }}
                onClick={() => setOnlineStatus(v => !v)}
              >
                <div className="toggle-thumb" style={{ left: onlineStatus ? '23px' : '3px' }} />
              </button>
            </div>

            {/* Read receipts */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #c7d7fe' }}>
                <MessageCircle size={16} color="#4f6ef7" />
              </div>
              <div className="row-text">
                <p className="row-title">Read Receipts</p>
                <p className="row-sub">Let others know when you've read messages</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: readReceipts ? '#4f6ef7' : '#e2e8f0' }}
                onClick={() => setReadReceipts(v => !v)}
              >
                <div className="toggle-thumb" style={{ left: readReceipts ? '23px' : '3px' }} />
              </button>
            </div>

            {/* Typing indicator */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#fef9ec', border: '1px solid #fde68a' }}>
                <MessageCircle size={16} color="#f59e0b" />
              </div>
              <div className="row-text">
                <p className="row-title">Typing Indicator</p>
                <p className="row-sub">Show when you're composing a message</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: typingIndicator ? '#f59e0b' : '#e2e8f0' }}
                onClick={() => setTypingIndicator(v => !v)}
              >
                <div className="toggle-thumb" style={{ left: typingIndicator ? '23px' : '3px' }} />
              </button>
            </div>

            {/* Calls from */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#edfaf5', border: '1px solid #bbf0d8' }}>
                <Phone size={16} color="#0d9f6e" />
              </div>
              <div className="row-text">
                <p className="row-title">Calls From</p>
                <p className="row-sub">Who can call you on V-Meet</p>
              </div>
              <div className="seg-wrap">
                {CALL_OPTIONS.map(opt => (
                  <button key={opt} className={`seg-btn ${callsFrom === opt ? 'active' : ''}`} onClick={() => setCallsFrom(opt)}>{opt}</button>
                ))}
              </div>
            </div>

          </div>

          {/* ── Security ── */}
          <p className="section-label">Security</p>
          <div className="settings-group">

            {/* Two-factor */}
            <div className="settings-row clickable" onClick={() => setTwoFactor(v => !v)}>
              <div className="row-icon" style={{ background: twoFactor ? '#edfaf5' : '#fff1f2', border: `1px solid ${twoFactor ? '#bbf0d8' : '#fecaca'}` }}>
                <Key size={16} color={twoFactor ? '#0d9f6e' : '#ef4444'} />
              </div>
              <div className="row-text">
                <p className="row-title">Two-Factor Authentication</p>
                <p className="row-sub">Add an extra layer of login security</p>
              </div>
              <span className={`twofa-badge ${twoFactor ? 'on' : 'off'}`}>
                {twoFactor ? 'Enabled' : 'Disabled'}
              </span>
              <ChevronRight size={15} color="#9ba8bf" />
            </div>

            {/* Login alerts */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#fef9ec', border: '1px solid #fde68a' }}>
                <Bell size={16} color="#f59e0b" />
              </div>
              <div className="row-text">
                <p className="row-title">Login Alerts</p>
                <p className="row-sub">Get notified of new sign-ins</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: loginAlerts ? '#f59e0b' : '#e2e8f0' }}
                onClick={() => setLoginAlerts(v => !v)}
              >
                <div className="toggle-thumb" style={{ left: loginAlerts ? '23px' : '3px' }} />
              </button>
            </div>

            {/* Screen lock */}
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#f3efff', border: '1px solid #ddd6fe' }}>
                <Lock size={16} color="#7c3aed" />
              </div>
              <div className="row-text">
                <p className="row-title">App Lock</p>
                <p className="row-sub">Require PIN or biometrics to open</p>
              </div>
              <button
                className="toggle-track"
                style={{ background: screenLock ? '#7c3aed' : '#e2e8f0' }}
                onClick={() => setScreenLock(v => !v)}
              >
                <div className="toggle-thumb" style={{ left: screenLock ? '23px' : '3px' }} />
              </button>
            </div>

            {/* Active sessions */}
            <div className="settings-row clickable" onClick={() => {}}>
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #c7d7fe' }}>
                <Smartphone size={16} color="#4f6ef7" />
              </div>
              <div className="row-text">
                <p className="row-title">Active Sessions</p>
                <p className="row-sub">View and manage logged-in devices</p>
              </div>
              <ChevronRight size={15} color="#9ba8bf" />
            </div>

            {/* Change password */}
            <div className="settings-row clickable" onClick={() => {}}>
              <div className="row-icon" style={{ background: '#f9fafb', border: '1px solid #e8ecf2' }}>
                <EyeOff size={16} color="#6b7897" />
              </div>
              <div className="row-text">
                <p className="row-title">Change Password</p>
                <p className="row-sub">Update your account password</p>
              </div>
              <ChevronRight size={15} color="#9ba8bf" />
            </div>

          </div>

          {/* ── Blocked contacts ── */}
          <p className="section-label">Blocked Contacts ({blocked.length})</p>
          <div className="settings-group" style={{ marginBottom: 20 }}>
            {blocked.length === 0 ? (
              <div className="no-blocked">
                <CheckCircle size={22} color="#0d9f6e" style={{ margin: '0 auto 8px', display: 'block' }} />
                No blocked contacts
              </div>
            ) : (
              blocked.map(contact => (
                <div className="blocked-row" key={contact.id}>
                  <img className="blocked-avatar" src={contact.avatar} alt={contact.name} />
                  <div>
                    <p className="blocked-name">{contact.name}</p>
                    <p className="blocked-since">Blocked {contact.since}</p>
                  </div>
                  <button
                    className="unblock-btn"
                    disabled={unblocking === contact.id}
                    onClick={() => handleUnblock(contact.id)}
                  >
                    {unblocking === contact.id ? 'Unblocking…' : 'Unblock'}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Warning */}
          {!twoFactor && (
            <div className="warn-banner">
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <p className="warn-text">
                Two-factor authentication is off. Enable it to significantly improve your account security.
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}