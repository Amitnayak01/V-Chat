import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Database, Share2, UserCheck, Bell, Mail } from 'lucide-react';

const sections = [
  {
    icon: Eye,
    title: 'Information We Collect',
    color: '#6366f1',
    bg: '#eef2ff',
    content: [
      {
        subtitle: 'Account Information',
        text: 'When you register for V-Meet, we collect your name, email address, profile photo, and password. This information is necessary to create and maintain your account.',
      },
      {
        subtitle: 'Usage Data',
        text: 'We automatically collect information about how you interact with our platform, including meeting durations, feature usage, device type, browser type, IP address, and log data.',
      },
      {
        subtitle: 'Communications',
        text: 'We store messages sent through our chat feature, meeting transcripts (if enabled), and any files or content you share during video sessions.',
      },
    ],
  },
  {
    icon: Database,
    title: 'How We Use Your Data',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    content: [
      {
        subtitle: 'Service Delivery',
        text: "Your data is primarily used to provide and improve V-Meet's video collaboration features, including matching you with meeting participants and ensuring call quality.",
      },
      {
        subtitle: 'Security & Fraud Prevention',
        text: 'We analyze usage patterns to detect and prevent abuse, unauthorized access, and other harmful activities on our platform.',
      },
      {
        subtitle: 'Product Improvement',
        text: 'Anonymized and aggregated usage data helps us understand how features are used so we can improve existing features and build new ones.',
      },
    ],
  },
  {
    icon: Share2,
    title: 'Data Sharing',
    color: '#f59e0b',
    bg: '#fffbeb',
    content: [
      {
        subtitle: 'Third-Party Services',
        text: 'We may share data with trusted third-party service providers who assist in operating our platform (e.g., cloud storage, analytics). These partners are contractually bound to protect your data.',
      },
      {
        subtitle: 'Legal Requirements',
        text: 'We may disclose your information if required by law, court order, or governmental authority, or when we believe disclosure is necessary to protect rights or safety.',
      },
      {
        subtitle: 'We Never Sell Your Data',
        text: 'V-Meet does not sell, rent, or trade your personal information to any third party for marketing or advertising purposes — period.',
      },
    ],
  },
  {
    icon: Lock,
    title: 'Data Security',
    color: '#10b981',
    bg: '#f0fdf4',
    content: [
      {
        subtitle: 'Encryption',
        text: 'All data transmitted between your device and our servers is encrypted using TLS 1.3. Video and audio streams use end-to-end encryption when technically feasible.',
      },
      {
        subtitle: 'Access Controls',
        text: 'Access to personal data is strictly limited to authorized personnel with a legitimate need. All access is logged and audited regularly.',
      },
      {
        subtitle: 'Incident Response',
        text: 'In the event of a data breach affecting your personal information, we will notify you within 72 hours as required by applicable regulations.',
      },
    ],
  },
  {
    icon: UserCheck,
    title: 'Your Rights',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    content: [
      {
        subtitle: 'Access & Portability',
        text: 'You have the right to request a copy of all personal data we hold about you in a portable, machine-readable format at any time.',
      },
      {
        subtitle: 'Correction & Deletion',
        text: 'You may update your profile information at any time. You may also request deletion of your account and associated data, subject to legal retention requirements.',
      },
      {
        subtitle: 'Opt-Out',
        text: 'You can opt out of non-essential communications and certain data processing activities through your account settings or by contacting our privacy team.',
      },
    ],
  },
  {
    icon: Bell,
    title: 'Cookies & Tracking',
    color: '#f43f5e',
    bg: '#fff1f2',
    content: [
      {
        subtitle: 'Essential Cookies',
        text: 'We use strictly necessary cookies to keep you logged in and maintain your session preferences. These cannot be disabled as they are required for the platform to function.',
      },
      {
        subtitle: 'Analytics Cookies',
        text: 'With your consent, we use analytics cookies to understand how users navigate V-Meet. You can manage cookie preferences in your browser settings.',
      },
    ],
  },
];

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>

      {/* Top bar */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 24px',
        height: 57,
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', fontSize: 14, fontFamily: 'inherit',
            padding: '6px 10px', borderRadius: 8,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        padding: '72px 24px 80px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative rings */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          borderRadius: '50%',
          border: '1px solid rgba(99,102,241,0.15)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420, height: 420,
          borderRadius: '50%',
          border: '1px solid rgba(99,102,241,0.1)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 72, height: 72, borderRadius: '20px',
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.3)',
          marginBottom: 24,
        }}>
          <Shield size={32} color="#818cf8" />
        </div>

        <h1 style={{
          color: '#f8fafc',
          fontSize: 42,
          fontWeight: 700,
          margin: '0 0 12px',
          letterSpacing: '-0.5px',
        }}>
          Privacy Policy
        </h1>

        <p style={{
          color: '#94a3b8',
          fontSize: 16,
          margin: '0 0 20px',
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6,
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          We believe privacy is a right, not a feature. Here's exactly how V-Meet handles your data.
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 99,
          padding: '6px 16px',
          color: '#6ee7b7',
          fontSize: 12,
          fontFamily: "'Segoe UI', sans-serif",
          letterSpacing: '0.3px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Last updated: March 14, 2026
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Intro card */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 40,
          borderLeft: '4px solid #6366f1',
        }}>
          <p style={{
            color: '#475569',
            fontSize: 15,
            lineHeight: 1.8,
            margin: 0,
            fontFamily: "'Segoe UI', sans-serif",
          }}>
            This Privacy Policy explains how <strong style={{ color: '#1e293b' }}>V-Meet</strong> ("we", "our", or "us") collects, uses, shares, and protects information about you when you use our video collaboration platform. By using V-Meet, you agree to the practices described in this policy. If you have questions, contact us at{' '}
            <a href="mailto:privacy@vmeet.app" style={{ color: '#6366f1', textDecoration: 'none' }}>privacy@vmeet.app</a>.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <div key={i} style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                overflow: 'hidden',
              }}>
                {/* Section header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '20px 28px',
                  background: section.bg,
                  borderBottom: '1px solid #e2e8f0',
                }}>
                  <div style={{
                    width: 40, height: 40,
                    borderRadius: 10,
                    background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 0 1px ${section.color}30`,
                  }}>
                    <Icon size={18} color={section.color} />
                  </div>
                  <h2 style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '-0.2px',
                  }}>
                    {i + 1}. {section.title}
                  </h2>
                </div>

                {/* Section body */}
                <div style={{ padding: '8px 28px 24px' }}>
                  {section.content.map((item, j) => (
                    <div key={j} style={{
                      paddingTop: 20,
                      paddingBottom: j < section.content.length - 1 ? 20 : 0,
                      borderBottom: j < section.content.length - 1 ? '1px solid #f1f5f9' : 'none',
                    }}>
                      <p style={{
                        margin: '0 0 6px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: section.color,
                        fontFamily: "'Segoe UI', sans-serif",
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase',
                      }}>
                        {item.subtitle}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: 14,
                        color: '#475569',
                        lineHeight: 1.75,
                        fontFamily: "'Segoe UI', sans-serif",
                      }}>
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact card */}
        <div style={{
          marginTop: 40,
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          borderRadius: 16,
          padding: '36px 32px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48,
            borderRadius: 12,
            background: 'rgba(99,102,241,0.2)',
            marginBottom: 16,
          }}>
            <Mail size={22} color="#818cf8" />
          </div>
          <h3 style={{
            color: '#f1f5f9', fontSize: 20, fontWeight: 700,
            margin: '0 0 10px', letterSpacing: '-0.2px',
          }}>
            Questions about your privacy?
          </h3>
          <p style={{
            color: '#94a3b8', fontSize: 14, margin: '0 0 20px',
            lineHeight: 1.7, fontFamily: "'Segoe UI', sans-serif",
          }}>
            Our dedicated privacy team is here to help. Reach out and we'll respond within 48 hours.
          </p>
          <a
            href="mailto:privacy@vmeet.app"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#6366f1', color: '#fff',
              padding: '10px 24px', borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
              fontFamily: "'Segoe UI', sans-serif",
              transition: 'background 0.15s',
            }}
          >
            <Mail size={15} />
            privacy@vmeet.app
          </a>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: 12,
          marginTop: 36,
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          © 2026 V-Meet · <a href="#" style={{ color: '#6366f1', textDecoration: 'none' }}>Terms of Service</a> · <a href="#" style={{ color: '#6366f1', textDecoration: 'none' }}>Cookie Policy</a>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;