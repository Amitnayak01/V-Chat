import { useEffect } from 'react';
import { PhoneOff }  from 'lucide-react';
import { SoundEngine } from '../../utils/SoundEngine';
import { readSoundSettings } from '../../hooks/useSoundSettings';

// Circumference of r=46 circle = 2π×46 ≈ 289
const CIRCUMFERENCE = 2 * Math.PI * 46;

const OutgoingCall = ({ receiver, onCancel, countdown = 30 }) => {
  
  useEffect(() => {
  const s = readSoundSettings();
  SoundEngine.playVideoCallTone(
    s.videoCall.ringtone,
    s.videoCall.volume,
    s.videoCall.vibration    // ← looping vibration for outgoing too
  );
  return () => SoundEngine.stopVideoCallTone();
}, []);

  if (!receiver) return null;

  const progress   = countdown / 30;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const ringColor  = countdown <= 10 ? '#ef4444' : '#3b82f6'; // blue → red

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl">

        {/* Receiver Info */}
        <div className="text-center mb-6">

          {/* Avatar with SVG countdown ring */}
          <div className="relative mb-4 mx-auto" style={{ width: 112, height: 112 }}>
            {/* SVG ring */}
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

            {/* Avatar image — centred */}
            <img
              src={receiver.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiver.username}`}
              alt={receiver.username}
              className="rounded-full object-cover absolute"
              style={{
                width: 80, height: 80,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
              }}
              onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiver.username}`; }}
            />

            {/* Countdown badge — top-right corner of the 112px box */}
            <div
              className="absolute z-20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
              style={{
                top: 2, right: 2,
                background: ringColor,
                transition: 'background 0.3s ease',
              }}
            >
              {countdown}
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
            {receiver.username}
          </h2>
          <p className="text-slate-500 text-sm">Calling…</p>
          {countdown <= 10 && (
            <p className="text-red-500 text-xs mt-1 font-medium animate-pulse">
              Auto-cancelling in {countdown}s
            </p>
          )}
        </div>

        {/* Ringing dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms'   }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2 py-3 sm:py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-red-200"
        >
          <PhoneOff className="w-5 h-5" />
          Cancel
        </button>

      </div>
    </div>
  );
};

export default OutgoingCall;