/**
 * AudioCallUI.jsx  —  Professional Call Interface (upgraded)
 * ────────────────────────────────────────────────────────────
 * All existing logic (endCall, toggleMute, WebRTC, context) is untouched.
 * Only the UI layer is upgraded. New features added via local state only.
 *
 * New features (zero context changes):
 *  • Full-screen mode            • Minimized pill mode
 *  • Drag-to-reposition          • Speaker volume toggle
 *  • Call recording (MediaRecorder) • Network quality indicator
 *  • Participant speaking detection • Animated waveform
 *  • Mobile-responsive layout    • Smooth mode transitions
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, MicOff, PhoneOff, Users, Volume2, VolumeX,
  Maximize2, Minimize2, Circle, Square,
  ChevronDown,
} from 'lucide-react';
import { useAudioCall } from '../../context/AudioCallContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// ─── Waveform bars ─────────────────────────────────────────────────────────────
const WaveBars = ({ active, color = '#10b981', count = 7, height = 16 }) => (
  <div className="flex items-end gap-[2px]" style={{ height }}>
    {Array.from({ length: count }, (_, i) => {
      const heights = [0.4, 0.7, 0.55, 1, 0.65, 0.85, 0.5];
      return (
        <span
          key={i}
          style={{
            width: 2.5,
            height: active ? `${heights[i % heights.length] * 100}%` : '25%',
            background: color,
            borderRadius: 3,
            transition: 'height 0.1s ease',
            animation: active
              ? `waveBar 0.75s ease-in-out ${i * 0.09}s infinite alternate`
              : 'none',
            opacity: active ? 1 : 0.35,
          }}
        />
      );
    })}
  </div>
);

// ─── Network quality dot ───────────────────────────────────────────────────────
const NetDot = ({ quality }) => {
  const cfg = {
    good:    { color: '#10b981', label: 'Good connection' },
    fair:    { color: '#f59e0b', label: 'Fair connection' },
    poor:    { color: '#ef4444', label: 'Poor connection' },
    unknown: { color: '#64748b', label: 'Checking...' },
  }[quality] ?? { color: '#64748b', label: 'Unknown' };

  return (
    <div className="flex items-center gap-1.5" title={cfg.label}>
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
      />
      <span className="text-[10px] font-semibold hidden sm:inline" style={{ color: cfg.color }}>
        {quality === 'good' ? 'HD' : quality === 'fair' ? 'SD' : quality === 'poor' ? 'Weak' : '...'}
      </span>
    </div>
  );
};

// ─── Avatar with speaking glow ─────────────────────────────────────────────────
const Avatar = ({ src, name, size = 80, speaking = false, ring = false }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    {speaking && (
      <>
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'rgba(16,185,129,0.15)',
            animation: 'speakPulse 1.1s ease-out infinite',
            transform: 'scale(1.25)',
          }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'rgba(16,185,129,0.08)',
            animation: 'speakPulse 1.1s ease-out 0.35s infinite',
            transform: 'scale(1.45)',
          }}
        />
      </>
    )}
    <div
      className="relative w-full h-full rounded-full overflow-hidden"
      style={{
        boxShadow: speaking
          ? '0 0 0 3px #10b981, 0 0 20px rgba(16,185,129,0.4)'
          : ring
          ? '0 0 0 2px rgba(255,255,255,0.15)'
          : '0 4px 16px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-white select-none"
          style={{
            background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
            fontSize: size * 0.38,
          }}
        >
          {name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
    </div>
  </div>
);

// ─── Group participant tile ────────────────────────────────────────────────────
const ParticipantTile = ({ participant, speaking, fullscreen }) => (
  <div className={`flex flex-col items-center gap-1.5 ${fullscreen ? 'p-4' : 'p-2'}`}>
    <Avatar
      src={participant.avatar}
      name={participant.username}
      size={fullscreen ? 72 : 52}
      speaking={speaking}
      ring
    />
    <span
      className="font-semibold text-white truncate"
      style={{ fontSize: fullscreen ? 12 : 10, maxWidth: fullscreen ? 80 : 60 }}
    >
      {participant.username}
    </span>
    {speaking && <WaveBars active color="#10b981" count={5} height={10} />}
  </div>
);

// ─── Remote audio player ───────────────────────────────────────────────────────
const RemoteAudio = ({ userId, stream, volume }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [stream]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);
  return <audio ref={ref} autoPlay playsInline key={userId} />;
};

// ─── Active speaker hook ───────────────────────────────────────────────────────
const useActiveSpeaker = (remoteStreams) => {
  const [speaker, setSpeaker] = useState(null);
  const analysersRef = useRef(new Map());
  const rafRef       = useRef(null);
  const ctxRef       = useRef(null);

  useEffect(() => {
    if (!remoteStreams.size) { setSpeaker(null); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!ctxRef.current) ctxRef.current = new Ctx();

    remoteStreams.forEach((stream, uid) => {
      if (analysersRef.current.has(uid)) return;
      try {
        const src      = ctxRef.current.createMediaStreamSource(stream);
        const analyser = ctxRef.current.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analysersRef.current.set(uid, { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
      } catch (_) {}
    });

    for (const uid of analysersRef.current.keys()) {
      if (!remoteStreams.has(uid)) analysersRef.current.delete(uid);
    }

    const poll = () => {
      let maxRms = 0, loudest = null;
      analysersRef.current.forEach(({ analyser, data }, uid) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        if (rms > maxRms) { maxRms = rms; loudest = uid; }
      });
      setSpeaker(maxRms > 3 ? loudest : null);
      rafRef.current = requestAnimationFrame(poll);
    };
    poll();

    return () => cancelAnimationFrame(rafRef.current);
  }, [remoteStreams]);

  return speaker;
};

// ─── Network quality hook ──────────────────────────────────────────────────────
const useNetworkQuality = (remoteStreams) => {
  const [quality, setQuality] = useState('unknown');
  useEffect(() => {
    if (!remoteStreams.size) { setQuality('unknown'); return; }
    const interval = setInterval(() => {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        const rtt = conn.rtt ?? 0;
        if (rtt === 0 || rtt < 150) setQuality('good');
        else if (rtt < 400)         setQuality('fair');
        else                        setQuality('poor');
      } else {
        setQuality(remoteStreams.size > 0 ? 'good' : 'unknown');
      }
    }, 3000);
    setQuality('good');
    return () => clearInterval(interval);
  }, [remoteStreams]);
  return quality;
};

// ─── Control button ────────────────────────────────────────────────────────────
const CtrlBtn = ({ icon: Icon, label, onClick, variant = 'default', size = 'md', active = false }) => {
  const sz = size === 'lg' ? { btn: 64, icon: 26 } : size === 'sm' ? { btn: 44, icon: 18 } : { btn: 56, icon: 22 };
  const bg = {
    default: active ? 'rgba(16,185,129,0.2)'  : 'rgba(255,255,255,0.08)',
    muted:   'rgba(239,68,68,0.18)',
    end:     '#ef4444',
    record:  active ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)',
  }[variant];
  const border = {
    default: active ? '1.5px solid rgba(16,185,129,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
    muted:   '1.5px solid rgba(239,68,68,0.4)',
    end:     '1.5px solid rgba(239,68,68,0.6)',
    record:  active ? '1.5px solid rgba(239,68,68,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
  }[variant];
  const iconColor = variant === 'end' ? '#fff' : variant === 'muted' ? '#f87171' : active ? '#10b981' : '#e2e8f0';

  return (
    <button
      onClick={onClick}
      title={label}
      style={{ outline: 'none' }}
      className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform duration-100 select-none"
    >
      <div
        style={{
          width: sz.btn, height: sz.btn,
          background: bg, border,
          borderRadius: variant === 'end' ? '50%' : 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
          boxShadow: variant === 'end' ? '0 6px 24px rgba(239,68,68,0.4)' : 'none',
          transition: 'background 0.15s, box-shadow 0.15s',
        }}
        className="group-hover:brightness-125"
      >
        <Icon style={{ width: sz.icon, height: sz.icon, color: iconColor, flexShrink: 0 }} strokeWidth={2} />
      </div>
      <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors hidden sm:block">
        {label}
      </span>
    </button>
  );
};

// ─── CSS keyframes ─────────────────────────────────────────────────────────────
const AudioStyles = () => (
  <style>{`
    @keyframes waveBar {
      from { transform: scaleY(0.35); opacity: 0.65; }
      to   { transform: scaleY(1);    opacity: 1;    }
    }
    @keyframes speakPulse {
      0%   { opacity: 0.7; transform: scale(1.15); }
      100% { opacity: 0;   transform: scale(1.55); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(18px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes recPulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.25; }
    }
  `}</style>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════
const AudioCallUI = () => {
  // ── Context (ALL original values, untouched) ──────────────────────────────
  const {
    callState, activeCall, remoteStreams, localStream,
    isMuted, callDuration, participants, callStatus,
    endCall, toggleMute,
  } = useAudioCall();

  // ── Local UI state (new features) ─────────────────────────────────────────
  const [mode, setMode]               = useState('normal'); // 'normal' | 'fullscreen' | 'minimized'
  const [speakerOn, setSpeakerOn]     = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [pos, setPos]                 = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging]   = useState(false);
  const [mounted, setMounted]         = useState(false);

  const activeSpeaker  = useActiveSpeaker(remoteStreams);
  const networkQuality = useNetworkQuality(remoteStreams);

  const dragRef     = useRef(null);
  const dragStart   = useRef(null);
  const recorderRef = useRef(null);
  const recTimerRef = useRef(null);
  const recChunks   = useRef([]);

  // ── Mount animation trigger ────────────────────────────────────────────────
  useEffect(() => {
    if (['calling', 'connecting', 'connected'].includes(callState)) {
      setMounted(true);
    }
    if (callState === 'idle') {
      setMounted(false);
      setMode('normal');
      setPos({ x: 0, y: 0 });
      stopRecording();
    }
  }, [callState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!localStream) return;
    try {
      const ctx  = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(localStream).connect(dest);
      remoteStreams.forEach((s) => {
        try { ctx.createMediaStreamSource(s).connect(dest); } catch (_) {}
      });
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      recChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recChunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(recChunks.current, { type: 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `call-${Date.now()}.webm`; a.click();
        URL.revokeObjectURL(url);
      };
      rec.start(1000);
      recorderRef.current = rec;
      setRecDuration(0);
      recTimerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000);
      setIsRecording(true);
    } catch (err) { console.error('[AudioCallUI] Recording error:', err); }
  }, [localStream, remoteStreams]);

  const stopRecording = useCallback(() => {
    try { recorderRef.current?.stop(); } catch (_) {}
    recorderRef.current = null;
    clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    setIsRecording(false);
    setRecDuration(0);
  }, []);

  // ── Drag ───────────────────────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    if (mode !== 'normal') return;
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { mx: cx, my: cy, px: pos.x, py: pos.y };
    setIsDragging(true);
  }, [mode, pos]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const cx  = e.touches ? e.touches[0].clientX : e.clientX;
      const cy  = e.touches ? e.touches[0].clientY : e.clientY;
      const dx  = cx - dragStart.current.mx;
      const dy  = cy - dragStart.current.my;
      const cW  = dragRef.current?.offsetWidth  ?? 280;
      const cH  = dragRef.current?.offsetHeight ?? 320;
      setPos({
        x: clamp(dragStart.current.px + dx, -(window.innerWidth  - cW  - 24), 0),
        y: clamp(dragStart.current.py + dy, -(window.innerHeight - cH  - 24), 0),
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onUp);
    };
  }, [isDragging]);

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!['calling', 'connecting', 'connected'].includes(callState) || !activeCall) return null;

  const isConnected = callState === 'connected';
  const isGroup     = activeCall.isGroup;
  const isSpeaking  = isConnected && remoteStreams.size > 0;
  const volume      = speakerOn ? 1 : 0;
  const statusText  = callStatus || (
    callState === 'calling'    ? 'Calling…'    :
    callState === 'connecting' ? 'Connecting…' :
    fmt(callDuration)
  );
  const statusColor = isConnected ? '#10b981' : '#f59e0b';

  // ── Shared controls ────────────────────────────────────────────────────────
  const Controls = ({ btnSize = 'md' }) => (
    <div className="flex items-end justify-center gap-3 sm:gap-5 flex-wrap">
      <CtrlBtn
        icon={isMuted ? MicOff : Mic}
        label={isMuted ? 'Unmute' : 'Mute'}
        variant={isMuted ? 'muted' : 'default'}
        onClick={toggleMute}
        size={btnSize}
      />
      <CtrlBtn
        icon={speakerOn ? Volume2 : VolumeX}
        label={speakerOn ? 'Speaker' : 'Spkr Off'}
        onClick={() => setSpeakerOn((v) => !v)}
        active={speakerOn}
        size={btnSize}
      />
      <CtrlBtn
        icon={isRecording ? Square : Circle}
        label={isRecording ? fmt(recDuration) : 'Record'}
        variant="record"
        active={isRecording}
        onClick={isRecording ? stopRecording : startRecording}
        size={btnSize}
      />
      <CtrlBtn
        icon={PhoneOff}
        label={isGroup ? 'Leave' : 'End'}
        variant="end"
        onClick={endCall}
        size={btnSize}
      />
    </div>
  );

  // ── Recording badge (shared) ───────────────────────────────────────────────
  const RecBadge = () => isRecording ? (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ animation: 'recPulse 1s ease infinite' }} />
      <span className="text-red-400 text-[10px] font-bold">{fmt(recDuration)}</span>
    </div>
  ) : null;

  // ════════════════════════════════════════════════════════════════════════════
  // MINIMIZED PILL
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'minimized') {
    return (
      <>
        <AudioStyles />
        {Array.from(remoteStreams.entries()).map(([uid, stream]) => (
          <RemoteAudio key={uid} userId={uid} stream={stream} volume={volume} />
        ))}
        <div
          className="fixed bottom-4 left-1/2 z-[190] select-none"
          style={{ transform: 'translateX(-50%)', animation: 'slideUp 0.22s ease forwards' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-full"
            style={{
              background: 'rgba(10,22,40,0.96)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
              backdropFilter: 'blur(20px)',
              minWidth: 230,
            }}
          >
            <Avatar src={activeCall.peerAvatar} name={activeCall.peerName} size={34} speaking={isSpeaking} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold truncate leading-none mb-0.5">
                {activeCall.peerName || 'Group Call'}
              </p>
              <span className="text-[10px] font-mono font-semibold" style={{ color: statusColor }}>
                {statusText}
              </span>
            </div>
            <RecBadge />
            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)' }}
            >
              {isMuted
                ? <MicOff style={{ width: 14, height: 14, color: '#f87171' }} />
                : <Mic    style={{ width: 14, height: 14, color: '#e2e8f0' }} />}
            </button>
            <button
              onClick={endCall}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: '#ef4444', boxShadow: '0 4px 14px rgba(239,68,68,0.4)' }}
            >
              <PhoneOff style={{ width: 14, height: 14, color: '#fff' }} />
            </button>
            <button
              onClick={() => setMode('normal')}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <Maximize2 style={{ width: 13, height: 13, color: '#94a3b8' }} />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FULL SCREEN MODE
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'fullscreen') {
    return (
      <>
        <AudioStyles />
        {Array.from(remoteStreams.entries()).map(([uid, stream]) => (
          <RemoteAudio key={uid} userId={uid} stream={stream} volume={volume} />
        ))}
        <div
          className="fixed inset-0 z-[190] flex flex-col select-none"
          style={{
            background: 'linear-gradient(160deg, #060e1f 0%, #0a1628 40%, #0d2137 70%, #060e1f 100%)',
            animation: 'fadeIn 0.18s ease forwards',
          }}
        >
          {/* ── Decorative blobs ─────────────────────────────────────────── */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }}
          />

          {/* ── Top bar ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 sm:px-8 pt-5 pb-2 relative z-10">
            <div className="flex items-center gap-3">
              <NetDot quality={networkQuality} />
              <RecBadge />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('minimized')}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                title="Minimize"
              >
                <ChevronDown style={{ width: 16, height: 16, color: '#94a3b8' }} />
              </button>
              <button
                onClick={() => setMode('normal')}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                title="Windowed"
              >
                <Minimize2 style={{ width: 16, height: 16, color: '#94a3b8' }} />
              </button>
            </div>
          </div>

          {/* ── Main content ─────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 relative z-10">
            {!isGroup ? (
              <>
                <Avatar
                  src={activeCall.peerAvatar}
                  name={activeCall.peerName}
                  size={120}
                  speaking={isSpeaking}
                />
                <div className="text-center">
                  <h2 className="text-white font-bold text-2xl sm:text-3xl tracking-tight mb-2">
                    {activeCall.peerName}
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    {isSpeaking && <WaveBars active color="#10b981" count={7} height={18} />}
                    <span className="text-lg sm:text-xl font-mono font-semibold" style={{ color: statusColor }}>
                      {statusText}
                    </span>
                    {isSpeaking && <WaveBars active color="#10b981" count={7} height={18} />}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Users style={{ width: 20, height: 20, color: '#10b981' }} />
                    <h2 className="text-white font-bold text-xl">{activeCall.peerName || 'Group Call'}</h2>
                  </div>
                  <span className="font-mono font-semibold text-sm" style={{ color: statusColor }}>
                    {statusText}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-1 max-w-lg">
                  {participants.length > 0 ? participants.map((p) => (
                    <ParticipantTile key={p.userId} participant={p} speaking={activeSpeaker === p.userId} fullscreen />
                  )) : (
                    <p className="text-slate-500 text-sm">Waiting for others to join…</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Bottom controls bar ──────────────────────────────────────── */}
          <div className="px-4 sm:px-8 pb-8 sm:pb-12 pt-4 relative z-10">
            <div
              className="rounded-[24px] p-4 sm:p-6 mx-auto"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(16px)',
                maxWidth: 480,
              }}
            >
              <Controls btnSize="lg" />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NORMAL FLOATING CARD
  // ════════════════════════════════════════════════════════════════════════════
  const cardW = isGroup ? 300 : 268;

  return (
    <>
      <AudioStyles />
      {Array.from(remoteStreams.entries()).map(([uid, stream]) => (
        <RemoteAudio key={uid} userId={uid} stream={stream} volume={volume} />
      ))}

      <div
        ref={dragRef}
        className="fixed z-[190] select-none"
        style={{
          bottom: Math.max(24, 24 + pos.y),
          right:  Math.max(24, 24 + pos.x),
          width: cardW,
          animation: mounted ? 'none' : 'slideUp 0.28s cubic-bezier(0.34,1.4,0.64,1) forwards',
          cursor: isDragging ? 'grabbing' : 'auto',
          // Mobile: full width at bottom
        }}
      >
        {/* Mobile full-width override */}
        <style>{`
          @media (max-width: 480px) {
            .audio-call-card { width: calc(100vw - 24px) !important; right: 12px !important; left: 12px !important; bottom: 12px !important; }
          }
        `}</style>

        <div
          className="audio-call-card rounded-[22px] overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #0a1628 0%, #0d2137 55%, #0f172a 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: isDragging
              ? '0 32px 80px rgba(0,0,0,0.85), 0 0 0 1.5px rgba(255,255,255,0.1)'
              : '0 20px 56px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.05)',
            transition: isDragging ? 'none' : 'box-shadow 0.2s',
          }}
        >
          {/* ── Accent line ─────────────────────────────────────────────── */}
          <div
            className="h-[2px]"
            style={{
              background: isConnected
                ? 'linear-gradient(90deg, #10b981, #06b6d4, #10b981)'
                : 'linear-gradient(90deg, #f59e0b, #f97316)',
            }}
          />

          {/* ── Drag handle + window chrome ──────────────────────────────── */}
          <div
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
            className="flex items-center justify-between px-4 pt-3 pb-0"
            style={{ cursor: 'grab' }}
          >
            <div className="flex items-center gap-2">
              <NetDot quality={networkQuality} />
              <RecBadge />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                title="Minimize"
                onClick={() => setMode('minimized')}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
              >
                <ChevronDown style={{ width: 12, height: 12, color: '#475569' }} />
              </button>
              <button
                title="Full screen"
                onClick={() => setMode('fullscreen')}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
              >
                <Maximize2 style={{ width: 11, height: 11, color: '#475569' }} />
              </button>
            </div>
          </div>

          <div className="px-5 pb-5 pt-3">
            {/* ── 1:1 ──────────────────────────────────────────────────── */}
            {!isGroup && (
              <div className="flex flex-col items-center gap-4">
                <Avatar
                  src={activeCall.peerAvatar}
                  name={activeCall.peerName}
                  size={78}
                  speaking={isSpeaking}
                />
                <div className="text-center">
                  <p className="text-white font-bold text-[15px] leading-tight mb-1 tracking-tight">
                    {activeCall.peerName}
                  </p>
                  <div className="flex items-center justify-center gap-1.5">
                    {isSpeaking && <WaveBars active color="#10b981" count={5} height={13} />}
                    <span className="text-xs font-mono font-semibold" style={{ color: statusColor }}>
                      {statusText}
                    </span>
                    {isSpeaking && <WaveBars active color="#10b981" count={5} height={13} />}
                  </div>
                </div>
                <Controls btnSize="md" />
              </div>
            )}

            {/* ── Group ────────────────────────────────────────────────── */}
            {isGroup && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users style={{ width: 13, height: 13, color: '#10b981' }} />
                    <span className="text-white font-bold text-sm truncate" style={{ maxWidth: 130 }}>
                      {activeCall.peerName || 'Group Call'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold" style={{ color: statusColor }}>
                    {statusText}
                  </span>
                </div>
                {participants.length > 0 ? (
                  <div className="flex flex-wrap justify-center">
                    {participants.map((p) => (
                      <ParticipantTile key={p.userId} participant={p} speaking={activeSpeaker === p.userId} fullscreen={false} />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs text-center py-2">Waiting for others…</p>
                )}
                <Controls btnSize="md" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AudioCallUI;