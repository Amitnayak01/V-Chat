import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Github, Shield, FileText, Star, Zap, Globe, Mail, Heart } from 'lucide-react';

const APP_VERSION   = '2.4.1';
const BUILD_NUMBER  = '20250610';
const RELEASE_DATE  = 'June 10, 2025';

const TECH_STACK = [
  { label: 'Frontend',  value: 'React 18 + Vite',        color: '#61dafb', bg: '#e8f8fd', border: '#b3eaf8' },
  { label: 'Realtime',  value: 'Socket.IO',               color: '#010101', bg: '#f0f0f0', border: '#d0d0d0' },
  { label: 'Video',     value: 'WebRTC + PeerJS',          color: '#ff6b35', bg: '#fff2ed', border: '#ffd4bf' },
  { label: 'Backend',   value: 'Node.js + Express',        color: '#3c873a', bg: '#eef9ee', border: '#b9eab8' },
  { label: 'Database',  value: 'MongoDB',                  color: '#47a248', bg: '#eef9ee', border: '#b9eab8' },
  { label: 'Styling',   value: 'Tailwind CSS',             color: '#0ea5e9', bg: '#e8f6fe', border: '#b3e3fb' },
];

const FEATURES = [
  { icon: '📹', title: 'HD Video Calls',        desc: 'Crystal-clear peer-to-peer video with adaptive quality' },
  { icon: '💬', title: 'Real-time Messaging',   desc: 'Instant messaging with read receipts and media sharing' },
  { icon: '🔒', title: 'End-to-End Encrypted', desc: 'All calls and messages are fully encrypted' },
  { icon: '🌐', title: 'Cross-Platform',        desc: 'Works on any modern browser, no install required' },
  { icon: '🎵', title: 'Custom Ringtones',      desc: 'Personalise your call experience with custom tones' },
  { icon: '👥', title: 'Group Meetings',         desc: 'Host meetings with multiple participants seamlessly' },
];

const LEGAL_LINKS = [
  { icon: FileText, label: 'Privacy Policy',       path: '/privacy-policy' },
  { icon: Shield,   label: 'Terms of Service',     path: '/terms-of-service' },
  { icon: FileText, label: 'Open Source Licenses', path: '/licenses' },
  { icon: Globe,    label: 'Website',               href: 'https://vmeet.app' },
];

export default function AboutVMeet() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        .about-root {
          min-height: 100vh;
          background: #ffffff;
          padding: clamp(24px, 4vw, 48px) clamp(16px, 4vw, 40px);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          color: #0c1120;
          box-sizing: border-box;
        }
        .about-inner {
          max-width: 640px;
          margin: 0 auto;
          width: 100%;
        }

        /* ── Header ── */
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #6b7897;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-bottom: 20px;
          transition: color .15s;
        }
        .back-btn:hover { color: #0c1120; }

        .about-title {
          font-size: clamp(20px, 4vw, 26px);
          font-weight: 800;
          color: #0c1120;
          letter-spacing: -.02em;
          margin: 0 0 4px;
        }
        .about-subtitle {
          font-size: 13px;
          color: #6b7897;
          margin: 0 0 28px;
        }

        /* ── Hero card ── */
        .hero-card {
          background: linear-gradient(135deg, #1a1f35 0%, #2d3561 50%, #1a2a5e 100%);
          border-radius: 20px;
          padding: 28px 24px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          position: relative;
          overflow: hidden;
        }
        .hero-card::before {
          content: '';
          position: absolute;
          top: -30px; right: -30px;
          width: 120px; height: 120px;
          background: radial-gradient(circle, rgba(99,102,241,.35) 0%, transparent 70%);
          border-radius: 50%;
        }
        .hero-card::after {
          content: '';
          position: absolute;
          bottom: -20px; left: 40px;
          width: 80px; height: 80px;
          background: radial-gradient(circle, rgba(59,130,246,.25) 0%, transparent 70%);
          border-radius: 50%;
        }
        .hero-logo {
          width: 64px; height: 64px;
          border-radius: 18px;
          object-fit: contain;
          flex-shrink: 0;
          box-shadow: 0 8px 24px rgba(0,0,0,.3);
          position: relative; z-index: 1;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 30px;
        }
        .hero-text { position: relative; z-index: 1; }
        .hero-name {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -.02em;
          margin: 0 0 2px;
        }
        .hero-tagline {
          font-size: 11px;
          color: rgba(255,255,255,.55);
          text-transform: uppercase;
          letter-spacing: .1em;
          margin: 0 0 10px;
        }
        .version-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 8px;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 700;
          color: #ffffff;
          backdrop-filter: blur(4px);
        }
        .version-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
        }

        /* ── Section label ── */
        .section-label {
          font-size: 10px;
          font-weight: 700;
          color: #9ba8bf;
          text-transform: uppercase;
          letter-spacing: .1em;
          margin: 0 0 8px 2px;
        }

        /* ── Generic group ── */
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
          border-bottom: 1px solid #f0f3f7;
          cursor: pointer;
          transition: background .15s;
        }
        .settings-row:last-child { border-bottom: none; }
        .settings-row:hover { background: #f9fafb; }
        .row-icon {
          width: 38px; height: 38px;
          border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
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
        .row-arrow { color: #9ba8bf; font-size: 18px; flex-shrink: 0; }
        .row-value {
          font-size: 12px;
          font-weight: 600;
          color: #9ba8bf;
          flex-shrink: 0;
        }

        /* ── Feature grid ── */
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
        }
        @media (max-width: 480px) { .feature-grid { grid-template-columns: 1fr; } }
        .feature-card {
          background: #ffffff;
          border: 1px solid #e8ecf2;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
          transition: box-shadow .15s, transform .15s;
        }
        .feature-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,.08);
          transform: translateY(-1px);
        }
        .feature-emoji { font-size: 22px; margin-bottom: 8px; display: block; }
        .feature-title {
          font-size: 12.5px;
          font-weight: 700;
          color: #0c1120;
          margin: 0 0 3px;
        }
        .feature-desc {
          font-size: 11px;
          color: #9ba8bf;
          margin: 0;
          line-height: 1.5;
        }

        /* ── Tech stack ── */
        .tech-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
        }
        .tech-chip {
          display: flex;
          align-items: center;
          gap: 7px;
          border-radius: 9px;
          border: 1px solid;
          padding: 6px 12px;
          font-size: 12px;
        }
        .tech-label {
          font-weight: 500;
          color: #9ba8bf;
        }
        .tech-value { font-weight: 700; }

        /* ── Build info ── */
        .build-info {
          background: #f9fafb;
          border-radius: 16px;
          border: 1px solid #e8ecf2;
          padding: 16px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .build-item {}
        .build-key {
          font-size: 10px;
          font-weight: 700;
          color: #9ba8bf;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin: 0 0 3px;
        }
        .build-val {
          font-size: 13px;
          font-weight: 700;
          color: #0c1120;
          margin: 0;
          font-variant-numeric: tabular-nums;
        }

        /* ── Footer ── */
        .made-with {
          text-align: center;
          font-size: 12px;
          color: #9ba8bf;
          padding: 8px 0 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .heart { color: #f43f5e; }
        .copyright {
          text-align: center;
          font-size: 11px;
          color: #bfc9db;
          padding-bottom: 12px;
        }
      `}</style>

      <div className="about-root">
        <div className="about-inner">

          {/* Back */}
          <button className="back-btn" onClick={() => window.history.back()}>
            <ArrowLeft size={15} />
            Settings
          </button>

          <h1 className="about-title">About V-Meet</h1>
          <p className="about-subtitle">Version, licenses &amp; terms</p>

          {/* ── Hero card ── */}
          <div className="hero-card">
            <div className="hero-logo">📹</div>
            <div className="hero-text">
              <p className="hero-name">V-Meet</p>
              <p className="hero-tagline">Video Collaboration Platform</p>
              <div className="version-pill">
                <span className="version-dot" />
                Version {APP_VERSION} — Latest
              </div>
            </div>
          </div>

          {/* ── Build Info ── */}
          <p className="section-label">Build Information</p>
          <div className="build-info">
            <div className="build-item">
              <p className="build-key">Version</p>
              <p className="build-val">{APP_VERSION}</p>
            </div>
            <div className="build-item">
              <p className="build-key">Build</p>
              <p className="build-val">#{BUILD_NUMBER}</p>
            </div>
            <div className="build-item">
              <p className="build-key">Released</p>
              <p className="build-val">{RELEASE_DATE}</p>
            </div>
            <div className="build-item">
              <p className="build-key">Environment</p>
              <p className="build-val">Production</p>
            </div>
          </div>

          {/* ── Features ── */}
          <p className="section-label">What's Inside</p>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="feature-emoji">{f.icon}</span>
                <p className="feature-title">{f.title}</p>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* ── Tech Stack ── */}
          <p className="section-label">Built With</p>
          <div className="tech-grid">
            {TECH_STACK.map((t) => (
              <div
                key={t.label}
                className="tech-chip"
                style={{ background: t.bg, borderColor: t.border }}
              >
                <span className="tech-label">{t.label}:</span>
                <span className="tech-value" style={{ color: t.color }}>{t.value}</span>
              </div>
            ))}
          </div>

          {/* ── Legal ── */}
          <p className="section-label">Legal</p>
          <div className="settings-group">
            {LEGAL_LINKS.map(({ icon: Icon, label, path, href }) => (
              <div
                key={label}
                className="settings-row"
                onClick={() => href ? window.open(href, '_blank') : navigate(path)}
              >
                <div className="row-icon" style={{ background: '#f0f4ff', border: '1px solid #c7d7fe' }}>
                  <Icon size={16} color="#4f6ef7" />
                </div>
                <div className="row-text">
                  <p className="row-title">{label}</p>
                </div>
                {href
                  ? <ExternalLink size={14} color="#9ba8bf" />
                  : <span className="row-arrow">›</span>
                }
              </div>
            ))}
          </div>

          {/* ── Contact ── */}
          <p className="section-label">Contact &amp; Support</p>
          <div className="settings-group">

            <div
              className="settings-row"
              onClick={() => navigate('/dashboard/support')}
            >
              <div className="row-icon" style={{ background: '#eef3fe', border: '1px solid #c7d7fe' }}>
                <Star size={16} color="#4f6ef7" />
              </div>
              <div className="row-text">
                <p className="row-title">Rate &amp; Feedback</p>
                <p className="row-sub">Chat with our admin team</p>
              </div>
              <span className="row-arrow">›</span>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="made-with">
            Made with <Heart size={13} className="heart" fill="#f43f5e" color="#f43f5e" /> by the V-Meet Team
          </div>
          <p className="copyright">© {new Date().getFullYear()} V-Meet. All rights reserved.</p>

        </div>
      </div>
    </>
  );
}