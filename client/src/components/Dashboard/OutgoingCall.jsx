import { useEffect } from 'react';
import { PhoneOff }  from 'lucide-react';
import { SoundEngine } from '../../utils/SoundEngine';
import { readSoundSettings } from '../../hooks/useSoundSettings';

const OutgoingCall = ({ receiver, onCancel }) => {

  useEffect(() => {
    // Play outgoing ringtone
    const s = readSoundSettings();
    SoundEngine.playVideoCallTone(s.videoCall.ringtone, s.videoCall.volume);
    return () => SoundEngine.stopVideoCallTone();
  }, []);

  if (!receiver) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl">

        {/* Receiver Info */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <img
              src={receiver.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiver.username}`}
              alt={receiver.username}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-blue-100"
              onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiver.username}`; }}
            />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping opacity-60" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
            {receiver.username}
          </h2>
          <p className="text-slate-500 text-sm">Calling...</p>
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