import { useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { SoundEngine } from '../../utils/SoundEngine';
import { readSoundSettings } from '../../hooks/useSoundSettings';

// Circumference of r=46 circle = 2π×46 ≈ 289
const CIRCUMFERENCE = 2 * Math.PI * 46;

const IncomingCall = ({ caller, onAccept, onReject, countdown = 30 }) => {




  useEffect(() => {
  const s = readSoundSettings();
  SoundEngine.playVideoCallTone(
    s.videoCall.ringtone,
    s.videoCall.volume,
    s.videoCall.vibration   // ← pass vibration flag — now loops until stopped
  );
  return () => SoundEngine.stopVideoCallTone(); // ← stops BOTH audio + vibration
}, []);
  if (!caller) return null;

  const progress   = countdown / 30;                          // 1 → 0
  const dashOffset = CIRCUMFERENCE * (1 - progress);         // fills as time passes
  const ringColor  = countdown <= 10 ? '#ef4444' : '#22c55e'; // red when urgent

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade-in p-0 sm:p-4">
      <div className="card p-6 sm:p-8 w-full sm:max-w-md rounded-t-2xl sm:rounded-xl animate-slide-up max-h-[90vh] overflow-y-auto">

        {/* Caller Info */}
        <div className="text-center mb-6">

          {/* Avatar with SVG countdown ring */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <svg
              width="112" height="112"
              viewBox="0 0 112 112"
              className="absolute inset-0"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Track */}
              <circle
                cx="56" cy="56" r="46"
                fill="none"
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="4"
              />
              {/* Animated progress arc */}
              <circle
                cx="56" cy="56" r="46"
                fill="none"
                stroke={ringColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
              />
            </svg>

            {/* Avatar image */}
            <img
              src={caller.callerAvatar}
              alt={caller.callerName}
              className="w-20 h-20 sm:w-24 sm:h-24 avatar relative z-10"
            />

            {/* Countdown badge — top-right of avatar */}
            <div
              className="absolute -top-1 -right-1 z-20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
              style={{ background: ringColor, transition: 'background 0.3s ease' }}
            >
              {countdown}
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 mb-2">
            {caller.callerName}
          </h2>
          <p className="text-slate-500 text-sm sm:text-base">
            Incoming video call…
          </p>
          {countdown <= 10 && (
            <p className="text-red-500 text-xs mt-1 font-medium animate-pulse">
              Auto-declining in {countdown}s
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 sm:gap-4">
          <button
            onClick={onReject}
            className="flex-1 btn btn-danger flex items-center justify-center space-x-2 py-3 sm:py-4 text-sm sm:text-base"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Decline</span>
          </button>

          <button
            onClick={onAccept}
            className="flex-1 btn btn-success flex items-center justify-center space-x-2 py-3 sm:py-4 text-sm sm:text-base"
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Accept</span>
          </button>
        </div>

        {/* Ringing dots */}
        <div className="mt-4 flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>

      </div>
    </div>
  );
};

export default IncomingCall;