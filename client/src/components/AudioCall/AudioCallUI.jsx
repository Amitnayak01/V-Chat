/**
 * AudioCallUI.jsx  —  Professional Call Interface (mobile-first)
 * ────────────────────────────────────────────────────────────────
 * All existing context logic (endCall, toggleMute, WebRTC) is 100% untouched.
 *
 * Mobile (≤ 640px):
 *   • Compact horizontal bottom bar — sits flush above the chat input
 *   • Minimised pill centred, above the message bar (bottom: 76px)
 *   • Tap avatar or name to open full-screen
 *
 * Desktop (> 640px):
 *   • Draggable floating card bottom-right
 *   • Minimised pill bottom-right
 *   • Full-screen mode
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, MicOff, PhoneOff, Users, Volume2, VolumeX,
  Maximize2, Minimize2, Circle, Square, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAudioCall } from '../../context/AudioCallContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
};

// ─── CSS keyframes ─────────────────────────────────────────────────────────────
const AudioStyles = () => (
  <style>{`
    @keyframes waveBar    { from{transform:scaleY(.3);opacity:.6} to{transform:scaleY(1);opacity:1} }
    @keyframes speakPulse { 0%{opacity:.65;transform:scale(1.15)} 100%{opacity:0;transform:scale(1.55)} }
    @keyframes callSlideUp{ from{opacity:0;transform:translateY(18px) scale(.96)} to{opacity:1;transform:none} }
    @keyframes callBarUp  { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:none} }
    @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
    @keyframes recPulse   { 0%,100%{opacity:1} 50%{opacity:.25} }
    @keyframes pingDot    { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.6);opacity:0} }
  `}</style>
);

// ─── Waveform bars ─────────────────────────────────────────────────────────────
const WaveBars = ({ active, color = '#10b981', count = 5, height = 14 }) => (
  <div style={{ display:'flex', alignItems:'flex-end', gap:2, height, flexShrink:0 }}>
    {Array.from({ length: count }, (_, i) => {
      const hs = [.4,.75,.55,1,.65];
      return (
        <span key={i} style={{
          width:2.5,
          height: active ? `${hs[i%hs.length]*100}%` : '25%',
          background:color, borderRadius:3,
          transition:'height .1s ease',
          animation: active ? `waveBar .7s ease-in-out ${i*.1}s infinite alternate` : 'none',
          opacity: active ? 1 : 0.3,
        }} />
      );
    })}
  </div>
);

// ─── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = 48, speaking = false }) => (
  <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
    {speaking && <>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(16,185,129,.18)', animation:'speakPulse 1.1s ease-out infinite', transform:'scale(1.3)' }} />
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(16,185,129,.09)', animation:'speakPulse 1.1s ease-out .35s infinite', transform:'scale(1.55)' }} />
    </>}
    <div style={{
      position:'relative', width:'100%', height:'100%',
      borderRadius:'50%', overflow:'hidden',
      boxShadow: speaking ? '0 0 0 2.5px #10b981, 0 0 14px rgba(16,185,129,.35)' : '0 3px 12px rgba(0,0,0,.45)',
      transition:'box-shadow .2s ease',
    }}>
      {src
        ? <img src={src} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#0f766e,#0891b2)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', fontSize:size*.38, userSelect:'none' }}>
            {name?.[0]?.toUpperCase() ?? '?'}
          </div>
      }
    </div>
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
  useEffect(() => { if (ref.current) ref.current.volume = volume; }, [volume]);
  return <audio ref={ref} autoPlay playsInline key={userId} />;
};

// ─── Active speaker hook ───────────────────────────────────────────────────────
const useActiveSpeaker = (remoteStreams) => {
  const [speaker, setSpeaker] = useState(null);
  const arRef  = useRef(new Map());
  const rafRef = useRef(null);
  const ctxRef = useRef(null);
  useEffect(() => {
    if (!remoteStreams.size) { setSpeaker(null); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!ctxRef.current) ctxRef.current = new Ctx();
    remoteStreams.forEach((stream, uid) => {
      if (arRef.current.has(uid)) return;
      try {
        const src = ctxRef.current.createMediaStreamSource(stream);
        const a   = ctxRef.current.createAnalyser();
        a.fftSize = 256; src.connect(a);
        arRef.current.set(uid, { a, d: new Uint8Array(a.frequencyBinCount) });
      } catch (_) {}
    });
    for (const uid of arRef.current.keys()) { if (!remoteStreams.has(uid)) arRef.current.delete(uid); }
    const poll = () => {
      let max = 0, loudest = null;
      arRef.current.forEach(({ a, d }, uid) => {
        a.getByteTimeDomainData(d);
        let sum = 0; for (const v of d) sum += (v-128)**2;
        const rms = Math.sqrt(sum/d.length);
        if (rms > max) { max = rms; loudest = uid; }
      });
      setSpeaker(max > 3 ? loudest : null);
      rafRef.current = requestAnimationFrame(poll);
    };
    poll();
    return () => cancelAnimationFrame(rafRef.current);
  }, [remoteStreams]);
  return speaker;
};

// ─── Network quality hook ──────────────────────────────────────────────────────
const useNetworkQuality = (remoteStreams) => {
  const [q, setQ] = useState('unknown');
  useEffect(() => {
    if (!remoteStreams.size) { setQ('unknown'); return; }
    const id = setInterval(() => {
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c) { const r = c.rtt??0; setQ(r<150?'good':r<400?'fair':'poor'); }
      else setQ('good');
    }, 3000);
    setQ('good');
    return () => clearInterval(id);
  }, [remoteStreams]);
  return q;
};

// ─── Round icon button ─────────────────────────────────────────────────────────
const RoundBtn = ({ icon: Icon, onClick, variant = 'default', size = 48, active = false, label, stopProp = false }) => {
  const bg = {
    default: active ? 'rgba(16,185,129,.22)' : 'rgba(255,255,255,.1)',
    muted:   'rgba(239,68,68,.22)',
    end:     '#ef4444',
    speaker: active ? 'rgba(16,185,129,.22)' : 'rgba(255,255,255,.1)',
  }[variant] || 'rgba(255,255,255,.1)';
  const border = {
    default: active ? '1.5px solid rgba(16,185,129,.5)' : '1.5px solid rgba(255,255,255,.12)',
    muted:   '1.5px solid rgba(239,68,68,.45)',
    end:     'none',
    speaker: active ? '1.5px solid rgba(16,185,129,.5)' : '1.5px solid rgba(255,255,255,.12)',
  }[variant] || '1.5px solid rgba(255,255,255,.12)';
  const col = variant==='end'?'#fff':variant==='muted'?'#f87171':active?'#10b981':'#e2e8f0';
  const iconSz = size < 42 ? 14 : size < 50 ? 18 : 22;
  return (
    <button onClick={(e) => { if (stopProp) e.stopPropagation(); onClick(); }}
      title={label}
      style={{ outline:'none', background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0, userSelect:'none' }}
      onMouseDown={(e) => { e.currentTarget.style.transform='scale(.9)'; }}
      onMouseUp={(e)   => { e.currentTarget.style.transform='scale(1)'; }}
      onTouchStart={(e)=> { e.currentTarget.style.transform='scale(.9)'; }}
      onTouchEnd={(e)  => { e.currentTarget.style.transform='scale(1)'; }}
    >
      <div style={{ width:size, height:size, borderRadius:'50%', background:bg, border, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', boxShadow:variant==='end'?'0 6px 20px rgba(239,68,68,.45)':'none', transition:'background .15s' }}>
        <Icon style={{ width:iconSz, height:iconSz, color:col, flexShrink:0 }} strokeWidth={2} />
      </div>
    </button>
  );
};

// ─── Square button (desktop card) ─────────────────────────────────────────────
const SquareBtn = ({ icon: Icon, label, onClick, variant = 'default', size = 'md', active = false }) => {
  const sz = size==='lg'?{btn:60,icon:24}:size==='sm'?{btn:44,icon:17}:{btn:54,icon:21};
  const bg = { default:active?'rgba(16,185,129,.2)':'rgba(255,255,255,.08)', muted:'rgba(239,68,68,.18)', end:'#ef4444', record:active?'rgba(239,68,68,.25)':'rgba(255,255,255,.08)' }[variant];
  const border = { default:active?'1.5px solid rgba(16,185,129,.5)':'1.5px solid rgba(255,255,255,.1)', muted:'1.5px solid rgba(239,68,68,.4)', end:'1.5px solid rgba(239,68,68,.6)', record:active?'1.5px solid rgba(239,68,68,.5)':'1.5px solid rgba(255,255,255,.1)' }[variant];
  const col = variant==='end'?'#fff':variant==='muted'?'#f87171':active?'#10b981':'#e2e8f0';
  return (
    <button onClick={onClick} title={label}
      style={{ outline:'none', background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, userSelect:'none' }}
      onMouseDown={(e)=>{e.currentTarget.style.transform='scale(.92)'}}
      onMouseUp={(e)=>{e.currentTarget.style.transform='scale(1)'}}
      onTouchStart={(e)=>{e.currentTarget.style.transform='scale(.92)'}}
      onTouchEnd={(e)=>{e.currentTarget.style.transform='scale(1)'}}
    >
      <div style={{ width:sz.btn, height:sz.btn, background:bg, border, borderRadius:variant==='end'?'50%':14, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(6px)', boxShadow:variant==='end'?'0 6px 24px rgba(239,68,68,.4)':'none', transition:'background .15s' }}>
        <Icon style={{ width:sz.icon, height:sz.icon, color:col }} strokeWidth={2} />
      </div>
      <span style={{ fontSize:10, fontWeight:700, color:'#64748b' }}>{label}</span>
    </button>
  );
};

// ─── Group participant tile ────────────────────────────────────────────────────
const ParticipantTile = ({ participant, speaking, large = false }) => (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:large?'12px 10px':'6px 6px' }}>
    <Avatar src={participant.avatar} name={participant.username} size={large?68:46} speaking={speaking} />
    <span style={{ fontSize:large?11:9, fontWeight:600, color:'rgba(255,255,255,.8)', maxWidth:large?80:56, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
      {participant.username}
    </span>
    {speaking && <WaveBars active color="#10b981" count={5} height={9} />}
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const AudioCallUI = () => {
  const {
    callState, activeCall, remoteStreams, localStream,
    isMuted, callDuration, participants, callStatus,
    endCall, toggleMute,
  } = useAudioCall();

  const [mode,        setMode]        = useState('normal');
  const [speakerOn,   setSpeakerOn]   = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [pos,         setPos]         = useState({ x:0, y:0 });
  const [isDragging,  setIsDragging]  = useState(false);
  const [mounted,     setMounted]     = useState(false);

  const isMobile       = useIsMobile();
  const activeSpeaker  = useActiveSpeaker(remoteStreams);
  const networkQuality = useNetworkQuality(remoteStreams);

  const dragRef     = useRef(null);
  const dragStart   = useRef(null);
  const recorderRef = useRef(null);
  const recTimerRef = useRef(null);
  const recChunks   = useRef([]);

  useEffect(() => {
    if (['calling','connecting','connected'].includes(callState)) setMounted(true);
    if (callState === 'idle') {
      setMounted(false); setMode('normal'); setPos({x:0,y:0}); stopRecording();
    }
  }, [callState]); // eslint-disable-line

  const startRecording = useCallback(() => {
    if (!localStream) return;
    try {
      const ctx  = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(localStream).connect(dest);
      remoteStreams.forEach((s) => { try { ctx.createMediaStreamSource(s).connect(dest); } catch(_){} });
      const rec = new MediaRecorder(dest.stream, { mimeType:'audio/webm' });
      recChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size>0) recChunks.current.push(e.data); };
      rec.onstop = () => {
        const url = URL.createObjectURL(new Blob(recChunks.current,{type:'audio/webm'}));
        Object.assign(document.createElement('a'),{href:url,download:`call-${Date.now()}.webm`}).click();
        URL.revokeObjectURL(url);
      };
      rec.start(1000); recorderRef.current = rec;
      setRecDuration(0);
      recTimerRef.current = setInterval(() => setRecDuration((d)=>d+1), 1000);
      setIsRecording(true);
    } catch(err){ console.error('[AudioCallUI] rec:',err); }
  }, [localStream, remoteStreams]);

  const stopRecording = useCallback(() => {
    try { recorderRef.current?.stop(); } catch(_){}
    recorderRef.current = null;
    clearInterval(recTimerRef.current);
    setIsRecording(false); setRecDuration(0);
  }, []);

  const onDragStart = useCallback((e) => {
    if (mode !== 'normal' || isMobile) return;
    e.preventDefault();
    const cx = e.touches?e.touches[0].clientX:e.clientX;
    const cy = e.touches?e.touches[0].clientY:e.clientY;
    dragStart.current = { mx:cx, my:cy, px:pos.x, py:pos.y };
    setIsDragging(true);
  }, [mode, pos, isMobile]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const cx = e.touches?e.touches[0].clientX:e.clientX;
      const cy = e.touches?e.touches[0].clientY:e.clientY;
      const dx = cx-dragStart.current.mx, dy = cy-dragStart.current.my;
      const cW = dragRef.current?.offsetWidth??280, cH = dragRef.current?.offsetHeight??320;
      setPos({
        x: clamp(dragStart.current.px+dx, -(window.innerWidth-cW-24), 0),
        y: clamp(dragStart.current.py+dy, -(window.innerHeight-cH-24), 0),
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',onMove,{passive:false});
    window.addEventListener('touchend',onUp);
    return () => {
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('touchend',onUp);
    };
  }, [isDragging]);

  if (!['calling','connecting','connected'].includes(callState)||!activeCall) return null;

  const isConnected = callState==='connected';
  const isGroup     = activeCall.isGroup;
  const isSpeaking  = isConnected && remoteStreams.size>0;
  const volume      = speakerOn?1:0;
  const statusText  = callStatus||(callState==='calling'?'Calling…':callState==='connecting'?'Connecting…':fmt(callDuration));
  const statusColor = isConnected?'#10b981':'#f59e0b';
  const peerName    = activeCall.peerName||(isGroup?'Group Call':'');

  const AudioEls = () => Array.from(remoteStreams.entries()).map(([uid,stream]) => (
    <RemoteAudio key={uid} userId={uid} stream={stream} volume={volume} />
  ));

  const RecBadge = () => isRecording ? (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:999, background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)', flexShrink:0 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', animation:'recPulse 1s ease infinite', flexShrink:0 }} />
      <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:700, color:'#f87171' }}>{fmt(recDuration)}</span>
    </div>
  ) : null;

  // ── MINIMIZED PILL ─────────────────────────────────────────────────────────
  if (mode === 'minimized') {
    return (
      <>
        <AudioStyles /><AudioEls />
        <div style={{
          position:'fixed', zIndex:190,
          bottom: isMobile ? 76 : 24,
          left:   isMobile ? '50%' : 'auto',
          right:  isMobile ? 'auto' : 24,
          transform: isMobile ? 'translateX(-50%)' : 'none',
          animation: 'callSlideUp .22s ease forwards',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px 9px 12px', borderRadius:999, background:'rgba(8,18,36,.97)', border:'1px solid rgba(255,255,255,.1)', boxShadow:'0 8px 32px rgba(0,0,0,.65)', backdropFilter:'blur(20px)', minWidth:220, maxWidth:isMobile?'calc(100vw - 48px)':300 }}>
            <span style={{ position:'relative', display:'flex', width:8, height:8, flexShrink:0 }}>
              <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:statusColor, opacity:.75, animation:'pingDot 1.4s ease infinite' }} />
              <span style={{ position:'relative', borderRadius:'50%', width:'100%', height:'100%', background:statusColor }} />
            </span>
            <Avatar src={activeCall.peerAvatar} name={peerName} size={32} speaking={isSpeaking} />
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'#fff', fontWeight:700, fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{peerName}</p>
              <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:700, color:statusColor }}>{statusText}</span>
            </div>
            <RecBadge />
            <RoundBtn icon={isMuted?MicOff:Mic} variant={isMuted?'muted':'default'} size={34} onClick={toggleMute} stopProp label="Mute" />
            <RoundBtn icon={PhoneOff} variant="end" size={34} onClick={endCall} stopProp label="End" />
            <button onClick={() => setMode('normal')}
              style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}
            >
              <ChevronUp style={{ width:13, height:13, color:'#94a3b8' }} />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── FULL SCREEN ────────────────────────────────────────────────────────────
  if (mode === 'fullscreen') {
    return (
      <>
        <AudioStyles /><AudioEls />
        <div style={{ position:'fixed', inset:0, zIndex:190, display:'flex', flexDirection:'column', overflow:'hidden', background:'linear-gradient(160deg,#060e1f 0%,#0a1628 40%,#0d2137 70%,#060e1f 100%)', animation:'fadeIn .18s ease forwards' }}>
          <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:384, height:384, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,.07) 0%,transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }} />

          {/* Top chrome */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 20px 8px', position:'relative', zIndex:10, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:networkQuality==='good'?'#10b981':networkQuality==='fair'?'#f59e0b':'#ef4444', flexShrink:0 }} />
              <RecBadge />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setMode('minimized')} style={{ width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }} title="Minimize">
                <ChevronDown style={{ width:16,height:16,color:'#94a3b8' }} />
              </button>
              <button onClick={() => setMode('normal')} style={{ width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }} title="Windowed">
                <Minimize2 style={{ width:16,height:16,color:'#94a3b8' }} />
              </button>
            </div>
          </div>

          {/* Centre */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:'0 24px', position:'relative', zIndex:10, overflow:'hidden' }}>
            {!isGroup ? (
              <>
                <Avatar src={activeCall.peerAvatar} name={peerName} size={Math.min(120,window.innerWidth*.28)} speaking={isSpeaking} />
                <div style={{ textAlign:'center' }}>
                  <h2 style={{ color:'#fff', fontWeight:800, margin:'0 0 10px', fontSize:'clamp(20px,5vw,30px)', letterSpacing:'-.02em' }}>{peerName}</h2>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                    {isSpeaking && <WaveBars active color="#10b981" count={7} height={18} />}
                    <span style={{ fontFamily:'monospace', fontWeight:700, color:statusColor, fontSize:15 }}>{statusText}</span>
                    {isSpeaking && <WaveBars active color="#06b6d4" count={7} height={18} />}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:6 }}>
                    <Users style={{ width:18,height:18,color:'#10b981' }} />
                    <h2 style={{ color:'#fff', fontWeight:700, fontSize:20, margin:0 }}>{peerName}</h2>
                  </div>
                  <span style={{ fontFamily:'monospace', fontWeight:600, fontSize:13, color:statusColor }}>{statusText}</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:4, maxWidth:480 }}>
                  {participants.length > 0
                    ? participants.map((p) => <ParticipantTile key={p.userId} participant={p} speaking={activeSpeaker===p.userId} large />)
                    : <p style={{ color:'#475569', fontSize:14 }}>Waiting for others…</p>}
                </div>
              </>
            )}
          </div>

          {/* Controls */}
          <div style={{ flexShrink:0, padding:'12px 16px', paddingBottom:'max(28px,env(safe-area-inset-bottom,28px))', position:'relative', zIndex:10 }}>
            <div style={{ borderRadius:24, padding:'14px 20px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', gap:'clamp(12px,4vw,24px)', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', backdropFilter:'blur(16px)', maxWidth:420, flexWrap:'wrap' }}>
              <SquareBtn icon={isMuted?MicOff:Mic} label={isMuted?'Unmute':'Mute'} variant={isMuted?'muted':'default'} onClick={toggleMute} size="lg" />
              <SquareBtn icon={speakerOn?Volume2:VolumeX} label={speakerOn?'Speaker':'Off'} onClick={()=>setSpeakerOn(v=>!v)} active={speakerOn} size="lg" />
              <SquareBtn icon={isRecording?Square:Circle} label={isRecording?fmt(recDuration):'Record'} variant="record" active={isRecording} onClick={isRecording?stopRecording:startRecording} size="lg" />
              <SquareBtn icon={PhoneOff} label={isGroup?'Leave':'End'} variant="end" onClick={endCall} size="lg" />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE — COMPACT BOTTOM BAR
  // ══════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        <AudioStyles /><AudioEls />
        <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:190, animation:'callBarUp .28s ease forwards' }}>
          {/* Accent line */}
          <div style={{ height:2, background:isConnected?'linear-gradient(90deg,#10b981,#06b6d4,#10b981)':'linear-gradient(90deg,#f59e0b,#f97316)' }} />

          {/* Bar */}
          <div style={{ background:'rgba(7,14,28,.98)', borderTop:'1px solid rgba(255,255,255,.09)', backdropFilter:'blur(24px)', padding:`10px 14px max(10px,env(safe-area-inset-bottom,10px)) 14px` }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>

              {/* Avatar — tap to fullscreen */}
              <div style={{ cursor:'pointer', flexShrink:0 }} onClick={() => setMode('fullscreen')}>
                <Avatar src={activeCall.peerAvatar} name={peerName} size={42} speaking={isSpeaking} />
              </div>

              {/* Info — tap to fullscreen */}
              <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => setMode('fullscreen')}>
                <p style={{ color:'#fff', fontWeight:700, fontSize:13, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {isGroup
                    ? <span style={{ display:'flex', alignItems:'center', gap:4 }}><Users style={{ width:11,height:11,color:'#10b981',flexShrink:0 }} />{peerName}</span>
                    : peerName
                  }
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                  {isSpeaking && <WaveBars active color="#10b981" count={5} height={11} />}
                  <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, color:statusColor }}>{statusText}</span>
                </div>
              </div>

              <RecBadge />

              {/* Controls */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <RoundBtn icon={isMuted?MicOff:Mic}     variant={isMuted?'muted':'default'} size={44} onClick={toggleMute}              label="Mute"    />
                <RoundBtn icon={speakerOn?Volume2:VolumeX} variant="speaker" active={speakerOn} size={44} onClick={()=>setSpeakerOn(v=>!v)} label="Speaker" />
                <RoundBtn icon={PhoneOff}                variant="end"     size={44} onClick={endCall}               label="End"     />
                <button onClick={() => setMode('fullscreen')}
                  style={{ width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}
                  title="Full screen">
                  <Maximize2 style={{ width:14,height:14,color:'#64748b' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESKTOP — FLOATING CARD
  // ══════════════════════════════════════════════════════════════════════════
  const cardW = isGroup ? 296 : 264;
  return (
    <>
      <AudioStyles /><AudioEls />
      <div ref={dragRef} style={{ position:'fixed', zIndex:190, bottom:Math.max(24,24-pos.y), right:Math.max(24,24-pos.x), width:cardW, animation:mounted?'none':'callSlideUp .28s cubic-bezier(.34,1.4,.64,1) forwards', cursor:isDragging?'grabbing':'auto' }}>
        <div style={{ borderRadius:22, overflow:'hidden', background:'linear-gradient(160deg,#0a1628 0%,#0d2137 55%,#0f172a 100%)', border:'1px solid rgba(255,255,255,.07)', boxShadow:isDragging?'0 32px 80px rgba(0,0,0,.85),0 0 0 1.5px rgba(255,255,255,.1)':'0 20px 56px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.05)', transition:isDragging?'none':'box-shadow .2s' }}>

          <div style={{ height:2, background:isConnected?'linear-gradient(90deg,#10b981,#06b6d4,#10b981)':'linear-gradient(90deg,#f59e0b,#f97316)' }} />

          {/* Drag handle */}
          <div onMouseDown={onDragStart} onTouchStart={onDragStart}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px 0', cursor:'grab' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:statusColor, boxShadow:`0 0 6px ${statusColor}`, flexShrink:0 }} />
              <RecBadge />
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setMode('minimized')} onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} style={{ width:24,height:24,borderRadius:'50%',background:'none',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#475569' }} title="Minimize">
                <ChevronDown style={{ width:13,height:13 }} />
              </button>
              <button onClick={()=>setMode('fullscreen')} onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} style={{ width:24,height:24,borderRadius:'50%',background:'none',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#475569' }} title="Full screen">
                <Maximize2 style={{ width:12,height:12 }} />
              </button>
            </div>
          </div>

          <div style={{ padding:'10px 18px 18px' }}>
            {!isGroup ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
                <Avatar src={activeCall.peerAvatar} name={peerName} size={76} speaking={isSpeaking} />
                <div style={{ textAlign:'center' }}>
                  <p style={{ color:'#fff', fontWeight:700, fontSize:15, margin:'0 0 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>{peerName}</p>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {isSpeaking && <WaveBars active color="#10b981" count={5} height={13} />}
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:12, color:statusColor }}>{statusText}</span>
                    {isSpeaking && <WaveBars active color="#10b981" count={5} height={13} />}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:12 }}>
                  <SquareBtn icon={isMuted?MicOff:Mic}  label={isMuted?'Unmute':'Mute'}  variant={isMuted?'muted':'default'} onClick={toggleMute} />
                  <SquareBtn icon={speakerOn?Volume2:VolumeX} label={speakerOn?'Speaker':'Off'} onClick={()=>setSpeakerOn(v=>!v)} active={speakerOn} />
                  <SquareBtn icon={isRecording?Square:Circle} label={isRecording?fmt(recDuration):'Rec'} variant="record" active={isRecording} onClick={isRecording?stopRecording:startRecording} />
                  <SquareBtn icon={PhoneOff} label="End" variant="end" onClick={endCall} />
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Users style={{ width:13,height:13,color:'#10b981' }} />
                    <span style={{ color:'#fff', fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>{peerName}</span>
                  </div>
                  <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:11, color:statusColor }}>{statusText}</span>
                </div>
                {participants.length > 0
                  ? <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center' }}>{participants.map((p) => <ParticipantTile key={p.userId} participant={p} speaking={activeSpeaker===p.userId} />)}</div>
                  : <p style={{ textAlign:'center', color:'#475569', fontSize:11, padding:'6px 0' }}>Waiting for others…</p>}
                <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:10 }}>
                  <SquareBtn icon={isMuted?MicOff:Mic} label={isMuted?'Unmute':'Mute'} variant={isMuted?'muted':'default'} onClick={toggleMute} />
                  <SquareBtn icon={speakerOn?Volume2:VolumeX} label="Speaker" onClick={()=>setSpeakerOn(v=>!v)} active={speakerOn} />
                  <SquareBtn icon={isRecording?Square:Circle} label={isRecording?fmt(recDuration):'Rec'} variant="record" active={isRecording} onClick={isRecording?stopRecording:startRecording} />
                  <SquareBtn icon={PhoneOff} label="Leave" variant="end" onClick={endCall} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AudioCallUI;