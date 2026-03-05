/**
 * IncomingAudioCall.jsx  —  Professional incoming call screen (upgraded)
 * ────────────────────────────────────────────────────────────────────────
 * All existing logic (acceptCall, rejectCall, callState) is untouched.
 * Upgraded: glassmorphism card, better pulse rings, swipe hint on mobile,
 * animated status bars, richer typography.
 */

import { useEffect, useRef } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useAudioCall } from '../../context/AudioCallContext';

// ─── Animated waveform bars ────────────────────────────────────────────────────
const RingWave = ({ color = '#10b981' }) => (
  <div className="flex items-end justify-center gap-[3px]" style={{ height: 18 }}>
    {[0.45, 0.75, 1, 0.75, 0.45].map((h, i) => (
      <span
        key={i}
        style={{
          width: 3,
          height: `${h * 100}%`,
          background: color,
          borderRadius: 4,
          animation: `ringBar 0.85s ease-in-out ${i * 0.11}s infinite alternate`,
        }}
      />
    ))}
  </div>
);

// ─── Caller avatar with concentric pulse rings ─────────────────────────────────
const CallerAvatar = ({ avatar, name }) => (
  <div className="relative flex items-center justify-center" style={{ width: 128, height: 128, marginBottom: 24 }}>
    {/* Three concentric pulse rings */}
    {[1.8, 1.5, 1.25].map((scale, i) => (
      <span
        key={i}
        className="absolute rounded-full"
        style={{
          inset: 0,
          transform: `scale(${scale})`,
          background: `rgba(16,185,129,${0.07 - i * 0.02})`,
          animation: `ringPulse 1.6s ease-out ${i * 0.28}s infinite`,
        }}
      />
    ))}
    {/* Avatar */}
    <div
      className="relative z-10 rounded-full overflow-hidden"
      style={{
        width: 88, height: 88,
        boxShadow: '0 0 0 3px rgba(16,185,129,0.55), 0 8px 32px rgba(16,185,129,0.2), 0 16px 48px rgba(0,0,0,0.5)',
      }}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-bold select-none"
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)',
            fontSize: 32,
          }}
        >
          {name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
    </div>
  </div>
);

// ─── Accept / Decline button ──────────────────────────────────────────────────
const ActionBtn = ({ icon: Icon, label, variant, onClick }) => {
  const isAccept = variant === 'accept';
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 group transition-all duration-150 active:scale-90"
      style={{ outline: 'none' }}
    >
      <div
        className="flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: 68, height: 68,
          background: isAccept ? '#10b981' : '#ef4444',
          boxShadow: isAccept
            ? '0 6px 28px rgba(16,185,129,0.5), 0 2px 8px rgba(0,0,0,0.3)'
            : '0 6px 28px rgba(239,68,68,0.5),  0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <Icon style={{ width: 28, height: 28, color: '#fff' }} strokeWidth={2.2} />
      </div>
      <span className="text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
        {label}
      </span>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const IncomingAudioCall = () => {
  const { callState, incomingCall, acceptCall, rejectCall } = useAudioCall();

  // Prevent background scroll
  useEffect(() => {
    if (callState === 'incoming') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [callState]);

  if (callState !== 'incoming' || !incomingCall) return null;

  return (
    <>
      <style>{`
        @keyframes ringBar {
          from { transform: scaleY(0.3); opacity: 0.55; }
          to   { transform: scaleY(1);   opacity: 1;    }
        }
        @keyframes ringPulse {
          0%   { opacity: 0.8; transform: scale(var(--s, 1)); }
          100% { opacity: 0;   transform: scale(calc(var(--s, 1) + 0.3)); }
        }
        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6"
        style={{
          background: 'rgba(2,8,20,0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animation: 'backdropIn 0.2s ease forwards',
        }}
      >
        {/* ── Card ─────────────────────────────────────────────────────── */}
        <div
          className="w-full sm:max-w-[360px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden"
          style={{
            background: 'linear-gradient(165deg, #0c1829 0%, #111e36 50%, #0a1525 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.4), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
            animation: 'cardSlideUp 0.3s cubic-bezier(0.34, 1.35, 0.64, 1) forwards',
          }}
        >
          {/* Top accent */}
          <div
            className="h-[3px]"
            style={{ background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 50%, #10b981 100%)' }}
          />

          {/* Mobile drag pill */}
          <div className="flex justify-center pt-3 pb-0 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <div className="px-8 pt-8 pb-10 flex flex-col items-center text-center">
            {/* Avatar */}
            <CallerAvatar avatar={incomingCall.callerAvatar} name={incomingCall.callerName} />

            {/* Incoming call label */}
            <div className="flex items-center gap-2 mb-2">
              <RingWave />
              <span
                className="text-[11px] font-bold tracking-[0.15em] uppercase"
                style={{ color: '#10b981' }}
              >
                Incoming audio call
              </span>
              <RingWave />
            </div>

            {/* Caller name */}
            <h2 className="text-white text-2xl font-bold tracking-tight mb-1">
              {incomingCall.callerName}
            </h2>
            <p className="text-slate-500 text-sm mb-8">
              V-Meet · Audio call
            </p>

            {/* Buttons */}
            <div className="flex items-start justify-center gap-20 w-full">
              <ActionBtn icon={PhoneOff} label="Decline" variant="reject" onClick={rejectCall} />
              <ActionBtn icon={Phone}    label="Accept"  variant="accept" onClick={acceptCall} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IncomingAudioCall;