import { useNavigate } from 'react-router-dom';
import { useSoundSettings } from '../../hooks/useSoundSettings';

export default function Settings() {
  const navigate = useNavigate();
  const { settings } = useSoundSettings();

  const badge =
    settings.audioCall.ringtone.charAt(0).toUpperCase() +
    settings.audioCall.ringtone.slice(1);

  return (
    <>
      <style>{`
        .settings-root {
          min-height: 100vh;
          background: #ffffff;
          padding: clamp(24px, 4vw, 48px) clamp(16px, 4vw, 40px);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          color: #0c1120;
          box-sizing: border-box;
        }
        .settings-inner {
          max-width: 640px;
          margin: 0 auto;
          width: 100%;
        }
        .settings-title {
          font-size: clamp(20px, 4vw, 26px);
          font-weight: 800;
          color: #0c1120;
          letter-spacing: -.02em;
          margin: 0 0 4px;
        }
        .settings-subtitle {
          font-size: 13px;
          color: #6b7897;
          margin: 0 0 28px;
        }
        .section-label {
          font-size: 10px;
          font-weight: 700;
          color: #9ba8bf;
          text-transform: uppercase;
          letter-spacing: .1em;
          margin: 0 0 8px 2px;
        }
        .settings-group {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e8ecf2;
          overflow: hidden;
          margin-bottom: 20px;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }
        .settings-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          cursor: pointer;
          transition: background .15s;
          border-bottom: 1px solid #f0f3f7;
        }
        .settings-row:last-child { border-bottom: none; }
        .settings-row:hover { background: #f9fafb; }
        .row-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          flex-shrink: 0;
        }
        .row-text { flex: 1; min-width: 0; }
        .row-title {
          font-size: 13.5px;
          font-weight: 600;
          color: #0c1120;
          margin: 0;
        }
        .row-sub {
          font-size: 11px;
          color: #9ba8bf;
          margin: 2px 0 0;
        }
        .row-arrow {
          color: #9ba8bf;
          font-size: 18px;
          flex-shrink: 0;
        }
        .sound-badge {
          font-size: 10px;
          font-weight: 700;
          color: #0d9f6e;
          background: #edfaf5;
          border: 1px solid #bbf0d8;
          padding: 3px 9px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        @media (max-width: 400px) {
          .sound-badge { display: none; }
        }
      `}</style>

      <div className="settings-root">
        <div className="settings-inner">

          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage your account and app preferences</p>

          {/* ── Account ── */}
          <p className="section-label">Account</p>
          <div className="settings-group">
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #bfdbfe' }}>👤</div>
              <div className="row-text">
                <p className="row-title">Profile</p>
                <p className="row-sub">Name, photo, status message</p>
              </div>
              <span className="row-arrow">›</span>
            </div>
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#f3efff', border: '1px solid #ddd6fe' }}>🛡️</div>
              <div className="row-text">
                <p className="row-title">Privacy &amp; Security</p>
                <p className="row-sub">Blocked contacts, two-factor auth</p>
              </div>
              <span className="row-arrow">›</span>
            </div>
          </div>

          {/* ── Preferences ── */}
          <p className="section-label">Preferences</p>
          <div className="settings-group">

            <div className="settings-row" onClick={() => navigate('/dashboard/sound-settings')}>
              <div className="row-icon" style={{ background: '#edfaf5', border: '1px solid #bbf0d8' }}>🎵</div>
              <div className="row-text">
                <p className="row-title">Sound &amp; Ringtones</p>
                <p className="row-sub">Ringtones, tones &amp; vibration</p>
              </div>
              <span className="sound-badge">{badge}</span>
              <span className="row-arrow">›</span>
            </div>
            
            <div className="settings-row" onClick={() => navigate('/dashboard/support')}>
  <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #c7d7fe' }}>🎧</div>
  <div className="row-text">
    <p className="row-title">Support</p>
    <p className="row-sub">Chat directly with our admin team</p>
  </div>
  <span className="row-arrow">›</span>
</div>


            <div className="settings-row">
              <div className="row-icon" style={{ background: '#fef9ec', border: '1px solid #fde68a' }}>🔔</div>
              <div className="row-text">
                <p className="row-title">Notifications</p>
                <p className="row-sub">Push, in-app, badge counts</p>
              </div>
              <span className="row-arrow">›</span>
            </div>

            <div className="settings-row">
              <div className="row-icon" style={{ background: '#fdf4ff', border: '1px solid #f0abfc' }}>🎨</div>
              <div className="row-text">
                <p className="row-title">Appearance</p>
                <p className="row-sub">Theme, font size, layout</p>
              </div>
              <span className="row-arrow">›</span>
            </div>

          </div>

          {/* ── Network ── */}
          <p className="section-label">Network</p>
          <div className="settings-group">
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #bfdbfe' }}>📶</div>
              <div className="row-text">
                <p className="row-title">Data &amp; Storage</p>
                <p className="row-sub">Auto-download, media quality</p>
              </div>
              <span className="row-arrow">›</span>
            </div>
          </div>

          {/* ── About ── */}
          <p className="section-label">About</p>
          <div className="settings-group">
            <div className="settings-row">
              <div className="row-icon" style={{ background: '#f9fafb', border: '1px solid #e8ecf2' }}>ℹ️</div>
              <div className="row-text">
                <p className="row-title">About V-Meet</p>
                <p className="row-sub">Version, licenses, terms</p>
              </div>
              <span className="row-arrow">›</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}