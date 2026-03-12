

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, PhoneOff, Phone, Users, Volume2, VolumeX,
  Maximize2, Minimize2, Circle, Square, ChevronDown, ChevronUp,
  UserPlus, Video, Headphones, Settings, Wifi, WifiOff,
  CheckCircle2, X, GripHorizontal,
} from 'lucide-react';
import { useAudioCall }  from '../../context/AudioCallContext';
import { useSocket }     from '../../context/SocketContext';
import { useAuth }       from '../../context/AuthContext';
import { generateRoomId } from '../../utils/webrtc';

/* ─── helpers ────────────────────────────────────────────────────────────── */
const fmt   = s  => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const clamp = (v,lo,hi) => Math.min(Math.max(v,lo),hi);

const useIsMobile = () => {
  const [m,setM] = useState(()=>typeof window!=='undefined'&&window.innerWidth<=640);
  useEffect(()=>{
    const fn=()=>setM(window.innerWidth<=640);
    window.addEventListener('resize',fn);
    return ()=>window.removeEventListener('resize',fn);
  },[]);
  return m;
};

const useAudioDevices = () => {
  const [devices,setDevices] = useState({mics:[],speakers:[]});
  const refresh = useCallback(async()=>{
    try {
      await navigator.mediaDevices.getUserMedia({audio:true})
        .then(s=>s.getTracks().forEach(t=>t.stop())).catch(()=>{});
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({mics:all.filter(d=>d.kind==='audioinput'),speakers:all.filter(d=>d.kind==='audiooutput')});
    } catch(_){}
  },[]);
  useEffect(()=>{
    refresh();
    navigator.mediaDevices.addEventListener?.('devicechange',refresh);
    return ()=>navigator.mediaDevices.removeEventListener?.('devicechange',refresh);
  },[refresh]);
  return {devices,refresh};
};

const useActiveSpeaker = remoteStreams => {
  const [spk,setSpk]=useState(null);
  const arRef=useRef(new Map()),rafRef=useRef(null),ctxRef=useRef(null);
  useEffect(()=>{
    if(!remoteStreams.size){setSpk(null);return;}
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!ctxRef.current) ctxRef.current=new Ctx();
    remoteStreams.forEach((stream,uid)=>{
      if(arRef.current.has(uid)) return;
      try{
        const src=ctxRef.current.createMediaStreamSource(stream);
        const a=ctxRef.current.createAnalyser();
        a.fftSize=256;src.connect(a);
        arRef.current.set(uid,{a,d:new Uint8Array(a.frequencyBinCount)});
      }catch(_){}
    });
    for(const uid of arRef.current.keys()) if(!remoteStreams.has(uid)) arRef.current.delete(uid);
    const poll=()=>{
      let max=0,loudest=null;
      arRef.current.forEach(({a,d},uid)=>{
        a.getByteTimeDomainData(d);
        let sum=0;for(const v of d)sum+=(v-128)**2;
        const rms=Math.sqrt(sum/d.length);
        if(rms>max){max=rms;loudest=uid;}
      });
      setSpk(max>3?loudest:null);
      rafRef.current=requestAnimationFrame(poll);
    };
    poll();
    return ()=>cancelAnimationFrame(rafRef.current);
  },[remoteStreams]);
  return spk;
};

const useNetworkQuality = remoteStreams => {
  const [q,setQ]=useState('unknown');
  useEffect(()=>{
    if(!remoteStreams.size){setQ('unknown');return;}
    const id=setInterval(()=>{
      const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      if(c){const r=c.rtt??0;setQ(r<150?'good':r<400?'fair':'poor');}
      else setQ('good');
    },3000);
    setQ('good');
    return ()=>clearInterval(id);
  },[remoteStreams]);
  return q;
};

/* ─── Global CSS animations ──────────────────────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @keyframes vm-wave   { from{transform:scaleY(.3);opacity:.55} to{transform:scaleY(1);opacity:1} }
    @keyframes vm-speak  { 0%{opacity:.65;transform:scale(1.1)} 100%{opacity:0;transform:scale(1.6)} }
    @keyframes vm-ring   { 0%{opacity:.88} 100%{opacity:0;transform:scale(1.55)} }
    @keyframes vm-rec    { 0%,100%{opacity:1} 50%{opacity:.18} }
    @keyframes vm-dot    { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(2);opacity:0} }
    @keyframes vm-slideup{ from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:none} }
    @keyframes vm-cardin { from{opacity:0;transform:translateY(20px) scale(.97)} to{opacity:1;transform:none} }
    @keyframes vm-fadein { from{opacity:0} to{opacity:1} }
    @keyframes vm-panelin{ from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:none} }
    @keyframes vm-drawer { from{transform:translateY(100%);opacity:0} to{transform:none;opacity:1} }
    @keyframes vm-glow   { 0%,100%{opacity:.6} 50%{opacity:1} }
    @keyframes vm-ns     { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0)} }
    @keyframes vm-ping   { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.6);opacity:0} }
  `}</style>
);

/* ─── WaveBars ───────────────────────────────────────────────────────────── */
const WaveBars = ({active,color='#10b981',count=5,height=14}) => (
  <div style={{display:'flex',alignItems:'flex-end',gap:2,height,flexShrink:0}}>
    {Array.from({length:count},(_,i)=>{
      const hs=[.4,.75,.55,1,.65];
      return (
        <span key={i} style={{
          width:2.5,height:active?`${hs[i%hs.length]*100}%`:'25%',
          background:color,borderRadius:3,transition:'height .1s',
          animation:active?`vm-wave .7s ease-in-out ${i*.1}s infinite alternate`:'none',
          opacity:active?1:.28,
        }}/>
      );
    })}
  </div>
);

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
const Avatar = ({src,name,size=56,speaking=false,ringing=false}) => (
  <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
    {ringing && [1.9,1.55,1.25].map((sc,i)=>(
      <span key={i} style={{position:'absolute',inset:0,borderRadius:'50%',background:`rgba(16,185,129,${.1-i*.025})`,transform:`scale(${sc})`,animation:`vm-ring 1.75s ease-out ${i*.3}s infinite`,pointerEvents:'none'}}/>
    ))}
    {speaking && !ringing && <>
      <span style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(16,185,129,.18)',animation:'vm-speak 1.1s ease-out infinite',transform:'scale(1.3)',pointerEvents:'none'}}/>
      <span style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(16,185,129,.09)',animation:'vm-speak 1.1s ease-out .35s infinite',transform:'scale(1.55)',pointerEvents:'none'}}/>
    </>}
    <div style={{
      position:'relative',width:'100%',height:'100%',borderRadius:'50%',overflow:'hidden',
      boxShadow: ringing
        ? '0 0 0 3px rgba(16,185,129,.7), 0 0 0 6px rgba(16,185,129,.18), 0 8px 32px rgba(0,0,0,.55)'
        : speaking
          ? '0 0 0 2.5px #10b981, 0 0 18px rgba(16,185,129,.32), 0 6px 24px rgba(0,0,0,.5)'
          : '0 4px 20px rgba(0,0,0,.55)',
      transition:'box-shadow .25s',
    }}>
      {src
        ? <img src={src} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        : <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#0f766e,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:size*.38,userSelect:'none',letterSpacing:'-.02em'}}>
            {name?.[0]?.toUpperCase()??''}
          </div>
      }
    </div>
  </div>
);

/* ─── RemoteAudio ────────────────────────────────────────────────────────── */
const RemoteAudio = ({userId,stream,volume,sinkId}) => {
  const ref=useRef(null);
  useEffect(()=>{const el=ref.current;if(!el||!stream)return;el.srcObject=stream;el.play().catch(()=>{});return()=>{el.srcObject=null;};},[stream]);
  useEffect(()=>{if(ref.current)ref.current.volume=volume;},[volume]);
  useEffect(()=>{if(ref.current&&sinkId&&ref.current.setSinkId)ref.current.setSinkId(sinkId).catch(()=>{});},[sinkId]);
  return <audio ref={ref} autoPlay playsInline key={userId}/>;
};

/* ─── Btn ────────────────────────────────────────────────────────────────── */
const Btn = ({icon:Icon,label,onClick,variant='default',active=false,size='md',stopProp=false,disabled=false,title:ttl}) => {
  const S={lg:{b:60,i:23},md:{b:52,i:20},sm:{b:44,i:17}}[size]||{b:52,i:20};
  const V={
    default: {bg:active?'rgba(16,185,129,.22)':'rgba(255,255,255,.08)',bd:active?'1.5px solid rgba(16,185,129,.5)':'1.5px solid rgba(255,255,255,.1)',ic:active?'#10b981':'#cbd5e1',sh:'none'},
    muted:   {bg:'rgba(239,68,68,.22)',bd:'1.5px solid rgba(239,68,68,.5)',ic:'#fca5a5',sh:'none'},
    end:     {bg:'#dc2626',bd:'none',ic:'#fff',sh:'0 8px 28px rgba(220,38,38,.5)'},
    accept:  {bg:'#10b981',bd:'none',ic:'#fff',sh:'0 8px 28px rgba(16,185,129,.5)'},
    reject:  {bg:'#dc2626',bd:'none',ic:'#fff',sh:'0 8px 28px rgba(220,38,38,.5)'},
    speaker: {bg:active?'rgba(16,185,129,.22)':'rgba(255,255,255,.08)',bd:active?'1.5px solid rgba(16,185,129,.5)':'1.5px solid rgba(255,255,255,.1)',ic:active?'#10b981':'#cbd5e1',sh:'none'},
    record:  {bg:active?'rgba(239,68,68,.22)':'rgba(255,255,255,.08)',bd:active?'1.5px solid rgba(239,68,68,.5)':'1.5px solid rgba(255,255,255,.1)',ic:active?'#f87171':'#cbd5e1',sh:'none'},
    blue:    {bg:'rgba(59,130,246,.18)',bd:'1.5px solid rgba(59,130,246,.42)',ic:'#93c5fd',sh:'none'},
    purple:  {bg:'rgba(139,92,246,.18)',bd:'1.5px solid rgba(139,92,246,.42)',ic:'#c4b5fd',sh:'none'},
    teal:    {bg:active?'rgba(20,184,166,.28)':'rgba(20,184,166,.1)',bd:active?'1.5px solid rgba(20,184,166,.6)':'1.5px solid rgba(20,184,166,.25)',ic:active?'#2dd4bf':'#5eead4',sh:'none'},
  }[variant]||{bg:'rgba(255,255,255,.08)',bd:'1.5px solid rgba(255,255,255,.1)',ic:'#cbd5e1',sh:'none'};
  const isCircle = variant==='end'||variant==='accept'||variant==='reject';
  return (
    <button
      onClick={e=>{if(disabled)return;if(stopProp)e.stopPropagation();onClick();}}
      title={ttl||label}
      disabled={disabled}
      style={{outline:'none',background:'none',border:'none',padding:0,cursor:disabled?'not-allowed':'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:6,userSelect:'none',WebkitTapHighlightColor:'transparent',flexShrink:0,opacity:disabled?.4:1,transition:'opacity .15s'}}
      onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform='scale(.88)';}}
      onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
      onTouchStart={e=>{if(!disabled)e.currentTarget.style.transform='scale(.88)';}}
      onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}
    >
      <div style={{width:S.b,height:S.b,borderRadius:isCircle?'50%':15,background:V.bg,border:V.bd,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(10px)',boxShadow:V.sh,transition:'all .15s',flexShrink:0}}>
        <Icon style={{width:S.i,height:S.i,color:V.ic,flexShrink:0}} strokeWidth={2}/>
      </div>
      {label && <span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,.38)',letterSpacing:'.02em',lineHeight:1}}>{label}</span>}
    </button>
  );
};

/* ─── ParticipantTile ────────────────────────────────────────────────────── */
const ParticipantTile = ({participant,speaking,large=false}) => (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,padding:large?'10px 8px':'5px 5px'}}>
    <Avatar src={participant.avatar} name={participant.username} size={large?66:44} speaking={speaking}/>
    <span style={{fontSize:large?11:9,fontWeight:600,color:'rgba(255,255,255,.78)',maxWidth:large?78:54,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{participant.username}</span>
    {speaking && <WaveBars active color="#10b981" count={5} height={8}/>}
  </div>
);

/* ─── RecBadge ───────────────────────────────────────────────────────────── */
const RecBadge = ({rec,dur}) => rec ? (
  <div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:999,background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.32)',flexShrink:0}}>
    <span style={{width:5,height:5,borderRadius:'50%',background:'#ef4444',animation:'vm-rec 1s ease infinite'}}/>
    <span style={{fontSize:10,fontFamily:'monospace',fontWeight:700,color:'#f87171'}}>{fmt(dur)}</span>
  </div>
) : null;

/* ─── DeviceDrawer ───────────────────────────────────────────────────────── */
const DeviceDrawer = ({onClose,devices,selectedMic,setSelectedMic,selectedSpeaker,setSelectedSpeaker,noiseSuppression,setNoiseSuppression,onSpeakerChange}) => {
  const DeviceRow = ({device,selected,onSelect,Icon:Ic}) => (
    <button onClick={()=>onSelect(device.deviceId)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,background:selected?'rgba(16,185,129,.12)':'rgba(255,255,255,.04)',border:`1px solid ${selected?'rgba(16,185,129,.35)':'rgba(255,255,255,.07)'}`,cursor:'pointer',marginBottom:6,transition:'all .15s',textAlign:'left'}}>
      <div style={{width:32,height:32,borderRadius:10,background:selected?'rgba(16,185,129,.2)':'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Ic style={{width:15,height:15,color:selected?'#10b981':'#94a3b8'}}/></div>
      <span style={{fontSize:12,fontWeight:600,color:selected?'#fff':'rgba(255,255,255,.6)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{device.label||`Device ${device.deviceId.slice(0,8)}`}</span>
      {selected && <CheckCircle2 style={{width:16,height:16,color:'#10b981',flexShrink:0}}/>}
    </button>
  );
  return (
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(6px)'}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',zIndex:1,width:'100%',maxWidth:520,borderRadius:'24px 24px 0 0',background:'linear-gradient(180deg,#0d1b33,#081020)',border:'1px solid rgba(255,255,255,.1)',borderBottom:'none',boxShadow:'0 -20px 60px rgba(0,0,0,.8)',animation:'vm-drawer .28s cubic-bezier(.34,1.2,.64,1)',maxHeight:'82vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 12px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:12,background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.3)',display:'flex',alignItems:'center',justifyContent:'center'}}><Settings style={{width:17,height:17,color:'#10b981'}}/></div>
            <div><h3 style={{color:'#fff',fontWeight:700,fontSize:15,margin:0}}>Audio Settings</h3><p style={{color:'rgba(255,255,255,.4)',fontSize:11,margin:'2px 0 0'}}>Devices & enhancements</p></div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><X style={{width:14,height:14,color:'#94a3b8'}}/></button>
        </div>
        <div style={{height:1,background:'rgba(255,255,255,.08)',margin:'0 20px',flexShrink:0}}/>
        <div style={{overflowY:'auto',padding:'16px 20px 32px',flex:1}}>
          <p style={{color:'rgba(255,255,255,.35)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 10px'}}>Enhancements</p>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius:12,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',marginBottom:20}}>
            <div><p style={{color:'#fff',fontSize:13,fontWeight:600,margin:0}}>Noise Suppression</p><p style={{color:'rgba(255,255,255,.4)',fontSize:11,margin:'2px 0 0'}}>Filters background noise in real-time</p></div>
            <button onClick={()=>setNoiseSuppression(v=>!v)} style={{width:44,height:24,borderRadius:12,background:noiseSuppression?'#10b981':'rgba(255,255,255,.12)',border:'none',cursor:'pointer',position:'relative',transition:'background .2s',padding:0,flexShrink:0}}>
              <span style={{position:'absolute',top:2,left:noiseSuppression?22:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.3)'}}/>
            </button>
          </div>
          <p style={{color:'rgba(255,255,255,.35)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 10px'}}>Microphone</p>
          {devices.mics.length>0
            ? devices.mics.map(d=><DeviceRow key={d.deviceId} device={d} selected={selectedMic===d.deviceId} onSelect={setSelectedMic} Icon={Mic}/>)
            : <p style={{color:'rgba(255,255,255,.3)',fontSize:12,textAlign:'center',padding:'12px 0'}}>No microphones found</p>
          }
          <p style={{color:'rgba(255,255,255,.35)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',margin:'16px 0 10px'}}>Speaker & Headphones</p>
          {devices.speakers.length>0
            ? devices.speakers.map(d=><DeviceRow key={d.deviceId} device={d} selected={selectedSpeaker===d.deviceId} onSelect={id=>{setSelectedSpeaker(id);onSpeakerChange(id);}} Icon={d.label?.toLowerCase().includes('headphone')||d.label?.toLowerCase().includes('earphone')?Headphones:Volume2}/>)
            : <p style={{color:'rgba(255,255,255,.3)',fontSize:12,textAlign:'center',padding:'12px 0'}}>No output devices — browser may not support output selection</p>
          }
        </div>
      </div>
    </div>
  );
};

/* ─── ConferenceModal ────────────────────────────────────────────────────── */
const ConferenceModal = ({ onClose, onInvite, participants = [], peerId = null }) => {
  const [contacts, setContacts] = useState([]);
  const { emit } = useSocket();
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [inviting, setInviting] = useState(null);
const [invited, setInvited] = useState(new Map());

  /*
   * Build a fast lookup Set of ALL userIds already in the call:
   *  - participants  = group call members (from socket events)
   *  - peerId        = the 1:1 call peer (NOT in participants for 1:1 calls)
   * Without including peerId here, the 1:1 peer always shows "Invite".
   */
  const inCallIds = new Set([
    ...participants.map(p => p.userId),
    ...(peerId ? [peerId] : []),
  ]);

useEffect(() => {
  const token = localStorage.getItem('token') || 
                localStorage.getItem('authToken') || 
                sessionStorage.getItem('token');

  fetch('/api/contacts', { 
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    } 
  })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(d => {
      console.log('[ConferenceModal] contacts response:', d);
      if (d.success) setContacts(d.contacts);
      else if (Array.isArray(d)) setContacts(d); // some APIs return array directly
    })
    .catch(err => {
      console.error('[ConferenceModal] contacts fetch failed:', err);
    })
    .finally(() => setLoading(false));
}, []);

  /* Sort: already-in-call contacts float to top */
  const filtered = contacts
    .filter(c => c.username?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aIn = inCallIds.has(a._id);
      const bIn = inCallIds.has(b._id);
      if (aIn && !bIn) return -1;
      if (!aIn && bIn) return  1;
      return 0;
    });

  const handleInvite = async (contact) => {
    if (invited.has(contact._id) || inviting || inCallIds.has(contact._id)) return;
    setInviting(contact._id);
    onInvite(contact._id, contact.username, contact.avatar);
    setTimeout(() => {
    
      setInvited(prev => new Map([...prev, [contact._id, Date.now()]]));
      setInviting(null);
    }, 800);
  };

const handleCancelInvite = (contact) => {
  setInvited(prev => { const n = new Map(prev); n.delete(contact._id); return n; });
  emit('cancel-invite', { inviteeId: contact._id });
};

  return (
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.62)',backdropFilter:'blur(8px)'}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',zIndex:1,width:'100%',maxWidth:420,borderRadius:24,background:'linear-gradient(160deg,#0d1422,#0a1020)',border:'1px solid rgba(255,255,255,.08)',boxShadow:'0 24px 64px rgba(0,0,0,.85)',overflow:'hidden',animation:'vm-cardin .25s cubic-bezier(.34,1.2,.64,1)'}}>

        {/* ── Header ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 20px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:42,height:42,borderRadius:14,background:'rgba(139,92,246,.25)',border:'1px solid rgba(139,92,246,.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <UserPlus style={{width:20,height:20,color:'#c4b5fd'}}/>
            </div>
            <div>
              <h3 style={{color:'#fff',fontWeight:700,fontSize:16,margin:0,letterSpacing:'-.01em'}}>Add to Call</h3>
              <p style={{color:'rgba(255,255,255,.38)',fontSize:12,margin:'2px 0 0'}}>Invite a contact to join</p>
            </div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <X style={{width:14,height:14,color:'#94a3b8'}}/>
          </button>
        </div>

        {/* ── Search ── */}
        <div style={{padding:'0 16px 14px',position:'relative'}}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            style={{width:'100%',padding:'11px 14px 11px 40px',borderRadius:14,background:'rgba(255,255,255,.06)',border:'1.5px solid rgba(255,255,255,.1)',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
          />
          <Users style={{position:'absolute',left:28,top:'50%',transform:'translateY(-50%)',width:16,height:16,color:'rgba(255,255,255,.25)'}}/>
        </div>

        {/* ── Contact list ── */}
        <div style={{maxHeight:340,overflowY:'auto',padding:'0 12px 16px'}}>
          {loading && (
            <div style={{textAlign:'center',padding:'28px 0',color:'rgba(255,255,255,.3)',fontSize:13}}>Loading contacts…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{textAlign:'center',padding:'28px 0',color:'rgba(255,255,255,.3)',fontSize:13}}>No contacts found</div>
          )}
          {!loading && filtered.map(contact => {
            const isInCall  = inCallIds.has(contact._id);
            const isInvited = invited.has(contact._id);
            const isBusy    = inviting === contact._id;

            return (
              <div
                key={contact._id}
                style={{
                  display:'flex',alignItems:'center',gap:14,
                  padding:'10px 12px',borderRadius:16,marginBottom:6,
                  background:'rgba(255,255,255,.04)',
                  border:'1px solid rgba(255,255,255,.06)',
                  transition:'background .15s',
                }}
              >
                {/* Avatar */}
                <div style={{position:'relative',flexShrink:0}}>
                  <img
                    src={contact.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username}`}
                    alt={contact.username}
                    style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',display:'block'}}
                  />
                  {isInCall && (
                    <div style={{position:'absolute',bottom:0,right:0,width:14,height:14,borderRadius:'50%',background:'#10b981',border:'2px solid #0a1020',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <CheckCircle2 style={{width:8,height:8,color:'#fff'}}/>
                    </div>
                  )}
                </div>

                {/* Name + status */}
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:'#fff',fontWeight:600,fontSize:14,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {contact.username}
                  </p>
                  {isInCall && (
                    <p style={{fontSize:11,fontWeight:600,color:'#10b981',margin:'2px 0 0'}}>Already in call</p>
                  )}
                </div>

{/* Action */}
{isInCall ? (
  <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:999,background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.3)',flexShrink:0}}>
    <span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',flexShrink:0}}/>
    <span style={{fontSize:12,fontWeight:700,color:'#10b981'}}>In call</span>
  </div>
) : isInvited ? (
  <button
    onClick={() => handleCancelInvite(contact)}
    style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 16px',borderRadius:999,cursor:'pointer',fontSize:12,fontWeight:700,flexShrink:0,background:'rgba(239,68,68,.15)',color:'#fca5a5',border:'1px solid rgba(239,68,68,.35)',transition:'all .15s'}}
  >
    <X style={{width:12,height:12,flexShrink:0}}/> Cancel
  </button>
) : (
  <button
    onClick={() => handleInvite(contact)}
    disabled={!!inviting}
    style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 18px',borderRadius:999,border:'none',cursor:inviting?'not-allowed':'pointer',fontSize:13,fontWeight:700,flexShrink:0,transition:'all .15s',background:isBusy?'rgba(255,255,255,.07)':'rgba(109,40,217,1)',color:isBusy?'rgba(255,255,255,.4)':'#fff',boxShadow:!isBusy?'0 4px 16px rgba(109,40,217,.45)':'none'}}
  >
    {isBusy ? <span>…</span> : <><Phone style={{width:13,height:13,flexShrink:0}}/> Invite</>}
  </button>
)}



              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AudioCallUI = () => {
  const {
    callState, activeCall, incomingCall, remoteStreams, localStream,
    isMuted, callDuration, participants, callStatus,
    endCall, toggleMute, acceptCall, rejectCall, inviteToCall,
  } = useAudioCall();

  const { emit }    = useSocket();
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [mode,               setMode]               = useState('normal');
  const [speakerOn,          setSpeakerOn]          = useState(true);
  const [isRecording,        setIsRecording]        = useState(false);
  const [recDuration,        setRecDuration]        = useState(0);
  const [pos,                setPos]                = useState({x:0,y:0});
  const [isDragging,         setIsDragging]         = useState(false);
  const [mounted,            setMounted]            = useState(false);
  const [pillPos,            setPillPos]            = useState({x:0,y:0});
  const [isPillDragging,     setIsPillDragging]     = useState(false);
  const pillRef      = useRef(null);
  const pillDragStart= useRef(null);
  const pillHasMoved = useRef(false);
  const [showDeviceDrawer,   setShowDeviceDrawer]   = useState(false);
  const [showConferenceModal,setShowConferenceModal]= useState(false);
  const [noiseSuppression,   setNoiseSuppression]   = useState(true);
  const [selectedMic,        setSelectedMic]        = useState('default');
  const [selectedSpeaker,    setSelectedSpeaker]    = useState('default');
  const [activeSinkId,       setActiveSinkId]       = useState(undefined);
  const [showSecRow,         setShowSecRow]         = useState(false);
  const [countdown, setCountdown] = useState(30);

  const isMobile       = useIsMobile();
  const activeSpeaker  = useActiveSpeaker(remoteStreams);
  const networkQuality = useNetworkQuality(remoteStreams);
  const { devices }    = useAudioDevices();

  const cardRef   = useRef(null);
  const dragStart = useRef(null);
  const recRef    = useRef(null);
  const recTimer  = useRef(null);
  const recChunks = useRef([]);

  /* ── [CHANGE v4.2]  Auto-fullscreen when call connects ─────────────────
   *
   * When callState transitions to 'connected' (i.e. the remote peer has
   * picked up and WebRTC is established), we automatically set mode to
   * 'fullscreen' so the user gets the immersive full-screen call UI
   * without having to tap Maximize manually.
   *
   * The user can still go back to 'normal' (windowed card) or 'minimized'
   * (pill) at any time using the ↓ / ⊡ buttons in the fullscreen header.
   *
   * On idle (call ended / rejected / timeout), mode resets to 'normal' as
   * before so the next call always starts from the card layout.
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const active = ['incoming','calling','connecting','connected'].includes(callState);
    if (active) setMounted(true);

    // ★ Auto-fullscreen as soon as audio is flowing
    if (callState === 'connected') setMode('fullscreen');

    if (callState === 'idle') {
      setMounted(false);
      setMode('normal');          // reset for next call
      setPos({x:0,y:0});
      setPillPos({x:0,y:0});
      pillHasMoved.current = false;
      stopRecording();
      setShowDeviceDrawer(false);
      setShowConferenceModal(false);
      setShowSecRow(false);
    }
  }, [callState]); // eslint-disable-line

  useEffect(()=>{
    if(callState==='incoming') document.body.style.overflow='hidden';
    else document.body.style.overflow='';
    return ()=>{document.body.style.overflow='';};
  },[callState]);

   useEffect(() => {
  if (callState !== 'incoming') { setCountdown(30); return; }
  setCountdown(30);
  const id = setInterval(() => {
    setCountdown(prev => {
      if (prev <= 1) { clearInterval(id); rejectCall(); return 0; }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(id);
}, [callState]); // eslint-disable-line

  /* ── Recording ───────────────────────────────────────────────────────── */
  const startRecording = useCallback(()=>{
    if(!localStream) return;
    try {
      const ctx  = new AudioContext(), dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(localStream).connect(dest);
      remoteStreams.forEach(s=>{try{ctx.createMediaStreamSource(s).connect(dest);}catch(_){}});
      const rec = new MediaRecorder(dest.stream,{mimeType:'audio/webm'});
      recChunks.current=[];
      rec.ondataavailable=e=>{if(e.data.size>0)recChunks.current.push(e.data);};
      rec.onstop=()=>{
        const url=URL.createObjectURL(new Blob(recChunks.current,{type:'audio/webm'}));
        Object.assign(document.createElement('a'),{href:url,download:`call-${Date.now()}.webm`}).click();
        URL.revokeObjectURL(url);
      };
      rec.start(1000);recRef.current=rec;
      setRecDuration(0);recTimer.current=setInterval(()=>setRecDuration(d=>d+1),1000);setIsRecording(true);
    }catch(err){console.error('[AudioCallUI] rec:',err);}
  },[localStream,remoteStreams]);

  const stopRecording = useCallback(()=>{
    try{recRef.current?.stop();}catch(_){}
    recRef.current=null;clearInterval(recTimer.current);setIsRecording(false);setRecDuration(0);
  },[]);

  /* ── Switch to video call ────────────────────────────────────────────── */
  const handleSwitchToVideo = useCallback(()=>{
    if(!activeCall?.peerId) return;
    const roomId = generateRoomId();
    endCall();
    emit('call-user',{callerId:user._id,receiverId:activeCall.peerId,roomId,callerName:user.username,callerAvatar:user.avatar});
    setTimeout(()=>navigate(`/room/${roomId}`),300);
  },[activeCall,endCall,emit,user,navigate]);

  /* ── Drag ────────────────────────────────────────────────────────────── */
  const onDragStart = useCallback(e=>{
    if(mode!=='normal'||isMobile) return;
    e.preventDefault();
    const cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY;
    dragStart.current={mx:cx,my:cy,px:pos.x,py:pos.y};setIsDragging(true);
  },[mode,pos,isMobile]);

  useEffect(()=>{
    if(!isDragging) return;
    const onMove=e=>{
      const cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY;
      const dx=cx-dragStart.current.mx, dy=cy-dragStart.current.my;
      const cW=cardRef.current?.offsetWidth??360, cH=cardRef.current?.offsetHeight??480;
      setPos({x:clamp(dragStart.current.px+dx,-(window.innerWidth-cW-24),0),y:clamp(dragStart.current.py+dy,-(window.innerHeight-cH-24),0)});
    };
    const onUp=()=>setIsDragging(false);
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',onMove,{passive:false});window.addEventListener('touchend',onUp);
    return()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);};
  },[isDragging]);

  /* ── Pill drag ─────────────────────────────────────────────────────────── */
  useEffect(()=>{
    if(!isPillDragging) return;
    const onMove=e=>{
      const cx=e.touches?e.touches[0].clientX:e.clientX;
      const cy=e.touches?e.touches[0].clientY:e.clientY;
      const pW=pillRef.current?.offsetWidth??280;
      const pH=pillRef.current?.offsetHeight??56;
      const nx=clamp(pillDragStart.current.px+(cx-pillDragStart.current.mx), 8, window.innerWidth-pW-8);
      const ny=clamp(pillDragStart.current.py+(cy-pillDragStart.current.my), 8, window.innerHeight-pH-8);
      setPillPos({x:nx,y:ny});
    };
    const onUp=()=>{
      setIsPillDragging(false);
      // Snap to nearest horizontal edge
      if(pillRef.current){
        const pW=pillRef.current.offsetWidth;
        const cx=pillPos.x+pW/2;
        const snapX = cx < window.innerWidth/2 ? 8 : window.innerWidth-pW-8;
        setPillPos(p=>({...p, x:snapX}));
      }
    };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',onMove,{passive:false});
    window.addEventListener('touchend',onUp);
    return()=>{
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('touchend',onUp);
    };
  },[isPillDragging, pillPos.x]);

  /* ── Visibility guard ────────────────────────────────────────────────── */
  const isVisible = ['incoming','calling','connecting','connected'].includes(callState);
  if(!isVisible) return null;
  if(callState==='incoming'&&!incomingCall) return null;
  if(callState!=='incoming'&&!activeCall)   return null;

  /* ── Derived values ──────────────────────────────────────────────────── */
  const isIncoming  = callState==='incoming';
  const isConnected = callState==='connected';
  const isGroup     = activeCall?.isGroup??false;
  const isSpeaking  = isConnected&&remoteStreams.size>0;
  const volume      = speakerOn?1:0;
  const peerName    = isIncoming ? incomingCall.callerName : (activeCall?.peerName||(isGroup?'Group Call':''));
  const peerAvatar  = isIncoming ? incomingCall.callerAvatar : activeCall?.peerAvatar;
  const isOffline   = !!callStatus?.toLowerCase().includes('offline');
  const statusText  = callStatus||(isIncoming?'Incoming audio call':callState==='calling'?'Ringing…':callState==='connecting'?'Connecting…':fmt(callDuration));
  const statusColor = isConnected?'#10b981':isIncoming?'#10b981':isOffline?'#fbbf24':'#f59e0b';
  const accentLine  = isConnected?'linear-gradient(90deg,#10b981,#06b6d4,#10b981)':isIncoming?'linear-gradient(90deg,#10b981,#34d399,#10b981)':'linear-gradient(90deg,#f59e0b,#f97316,#f59e0b)';
  const nqColor     = networkQuality==='good'?'#10b981':networkQuality==='fair'?'#f59e0b':'#ef4444';
  const videoDisabled = isGroup||!activeCall?.peerId;
  const videoTitle  = videoDisabled?'Not available in group calls':'Switch to video call';

  const handleSpeakerChange = deviceId => setActiveSinkId(deviceId==='default'?undefined:deviceId);
  const AudioEls = () => Array.from(remoteStreams.entries()).map(([uid,s])=>(
    <RemoteAudio key={uid} userId={uid} stream={s} volume={volume} sinkId={activeSinkId}/>
  ));



  const CircleTimer = () => {
  const r = 18, circ = 2 * Math.PI * r;
  const progress = (countdown / 30) * circ;
  const color = countdown > 15 ? '#10b981' : countdown > 8 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3"/>
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={circ - progress}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .4s' }}/>
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 13, fontWeight: 800, color, fontFamily: 'monospace' }}>
        {countdown}
      </span>
    </div>
  );
};
  /* ══════════════════════════════════════════════════════════════════════
     MINIMIZED PILL
  ══════════════════════════════════════════════════════════════════════ */
  if(mode==='minimized') {
    // Default position: bottom-right (or bottom-center on mobile)
    const pillStyle = pillHasMoved.current
      ? { position:'fixed', left:pillPos.x, top:pillPos.y, zIndex:210 }
      : isMobile
        ? { position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', zIndex:210 }
        : { position:'fixed', bottom:24, right:24, zIndex:210 };

    const startDrag = (cx, cy) => {
      if(!pillRef.current) return;
      const r = pillRef.current.getBoundingClientRect();
      pillHasMoved.current = true;
      pillDragStart.current = { mx:cx, my:cy, px:r.left, py:r.top };
      setPillPos({ x:r.left, y:r.top });
      setIsPillDragging(true);
    };

    return (
      <><GlobalStyles/><AudioEls/>
        <div
          ref={pillRef}
          style={{
            ...pillStyle,
            cursor: isPillDragging ? 'grabbing' : 'grab',
            userSelect:'none',
            touchAction:'none',
            animation: pillHasMoved.current ? 'none' : 'vm-cardin .22s ease',
            transition: isPillDragging ? 'none' : 'box-shadow .2s',
          }}
          onMouseDown={e=>{
            // Only start drag on the container itself, not on buttons
            if(e.target.closest('button')) return;
            e.preventDefault();
            startDrag(e.clientX, e.clientY);
          }}
          onTouchStart={e=>{
            if(e.target.closest('button')) return;
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
          }}
        >
          <div style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'10px 14px 10px 12px', borderRadius:999,
            background:'rgba(7,14,28,.97)',
            border: isPillDragging ? '1px solid rgba(255,255,255,.22)' : '1px solid rgba(255,255,255,.1)',
            boxShadow: isPillDragging
              ? '0 20px 60px rgba(0,0,0,.85), 0 0 0 1.5px rgba(255,255,255,.15)'
              : '0 8px 32px rgba(0,0,0,.65)',
            backdropFilter:'blur(20px)',
            minWidth:240,
            maxWidth: isMobile ? 'calc(100vw - 32px)' : 320,
            transition: isPillDragging ? 'none' : 'border .2s, box-shadow .2s',
          }}>
            {/* Live indicator */}
            <span style={{position:'relative',display:'flex',width:8,height:8,flexShrink:0}}>
              <span style={{position:'absolute',inset:0,borderRadius:'50%',background:statusColor,opacity:.75,animation:'vm-ping 1.4s ease infinite'}}/>
              <span style={{position:'relative',borderRadius:'50%',width:'100%',height:'100%',background:statusColor}}/>
            </span>

            <Avatar src={peerAvatar} name={peerName} size={32} speaking={isSpeaking}/>

            <div style={{flex:1,minWidth:0}}>
              <p style={{color:'#fff',fontWeight:700,fontSize:12,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{peerName}</p>
              <span style={{fontSize:10,fontFamily:'monospace',fontWeight:700,color:statusColor}}>{statusText}</span>
            </div>

            <RecBadge rec={isRecording} dur={recDuration}/>

            {/* Drag hint — only visible while not dragging */}
            {!isPillDragging && (
              <GripHorizontal style={{width:13,height:13,color:'rgba(255,255,255,.18)',flexShrink:0,pointerEvents:'none'}}/>
            )}

            {/* Buttons — stopPropagation so they don't start a drag */}
            <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}
              onMouseDown={e=>e.stopPropagation()}
              onTouchStart={e=>e.stopPropagation()}
            >
              <Btn icon={isMuted?MicOff:Mic} variant={isMuted?'muted':'default'} size="sm" onClick={toggleMute}/>
              <Btn icon={PhoneOff} variant="end" size="sm" onClick={endCall}/>
              <button
                onClick={()=>setMode('fullscreen')}
                style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}
              >
                <ChevronUp style={{width:13,height:13,color:'#94a3b8'}}/>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     FULLSCREEN
  ══════════════════════════════════════════════════════════════════════ */
  if(mode==='fullscreen') return (
    <><GlobalStyles/><AudioEls/>
      {showDeviceDrawer && <DeviceDrawer onClose={()=>setShowDeviceDrawer(false)} devices={devices} selectedMic={selectedMic} setSelectedMic={setSelectedMic} selectedSpeaker={selectedSpeaker} setSelectedSpeaker={setSelectedSpeaker} noiseSuppression={noiseSuppression} setNoiseSuppression={setNoiseSuppression} onSpeakerChange={handleSpeakerChange}/>}
      {showConferenceModal && <ConferenceModal onClose={()=>setShowConferenceModal(false)} onInvite={inviteToCall} participants={participants} peerId={activeCall?.peerId}/>}
      <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',flexDirection:'column',overflow:'hidden',background:'linear-gradient(160deg,#060e1f 0%,#0a1628 40%,#0d2137 70%,#060e1f 100%)',animation:'vm-fadein .18s ease'}}>
        <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:500,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(16,185,129,.06) 0%,transparent 70%)',filter:'blur(50px)',pointerEvents:'none'}}/>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 8px',position:'relative',zIndex:10,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:999,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.09)'}}>
              {networkQuality==='poor'?<WifiOff style={{width:12,height:12,color:'#ef4444'}}/>:<Wifi style={{width:12,height:12,color:nqColor}}/>}
              <span style={{fontSize:10,fontWeight:700,color:nqColor}}>{networkQuality==='good'?'HD':networkQuality==='fair'?'SD':'Weak'}</span>
            </div>
            {noiseSuppression && <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:999,background:'rgba(20,184,166,.1)',border:'1px solid rgba(20,184,166,.3)'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#14b8a6',animation:'vm-ns 2s ease infinite',flexShrink:0}}/>
              <span style={{fontSize:10,fontWeight:700,color:'#2dd4bf'}}>Noise Filter</span>
            </div>}
            <RecBadge rec={isRecording} dur={recDuration}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setMode('minimized')} style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} title="Minimize">
              <ChevronDown style={{width:15,height:15,color:'#94a3b8'}}/>
            </button>
            <button onClick={()=>setMode('normal')} style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} title="Windowed">
              <Minimize2 style={{width:15,height:15,color:'#94a3b8'}}/>
            </button>
          </div>
        </div>

        {/* Centre content */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,padding:'0 24px',position:'relative',zIndex:10,overflow:'hidden'}}>
          {!isGroup ? (<>
            <Avatar src={peerAvatar} name={peerName} size={Math.min(120,window.innerWidth*.22)} speaking={isSpeaking}/>
            <div style={{textAlign:'center'}}>
              <h2 style={{color:'#fff',fontWeight:800,margin:'0 0 10px',fontSize:'clamp(20px,4vw,30px)',letterSpacing:'-.02em'}}>{peerName}</h2>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                {isSpeaking && <WaveBars active color="#10b981" count={7} height={18}/>}
                <span style={{fontFamily:'monospace',fontWeight:700,color:statusColor,fontSize:16}}>{statusText}</span>
                {isSpeaking && <WaveBars active color="#06b6d4" count={7} height={18}/>}
              </div>
              {isOffline && <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:12,padding:'5px 14px',borderRadius:999,background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.3)'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#fbbf24',flexShrink:0,animation:'vm-rec 1.5s ease infinite'}}/>
                <span style={{fontSize:11,fontWeight:700,color:'#fbbf24'}}>User offline — ringing when they connect</span>
              </div>}
            </div>
          </>) : (<>
            <div style={{textAlign:'center'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:6}}>
                <Users style={{width:18,height:18,color:'#10b981'}}/>
                <h2 style={{color:'#fff',fontWeight:700,fontSize:20,margin:0}}>{peerName}</h2>
              </div>
              <span style={{fontFamily:'monospace',fontWeight:600,fontSize:13,color:statusColor}}>{statusText}</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:4,maxWidth:480}}>
              {participants.length>0
                ? participants.map(p=><ParticipantTile key={p.userId} participant={p} speaking={activeSpeaker===p.userId} large/>)
                : <p style={{color:'#475569',fontSize:14}}>Waiting for others to join…</p>
              }
            </div>
          </>)}
        </div>

        {/* Controls */}
        <div style={{flexShrink:0,padding:'8px 16px',paddingBottom:'max(24px,env(safe-area-inset-bottom,24px))',position:'relative',zIndex:10}}>
          <div style={{borderRadius:22,padding:'14px 24px',margin:'0 auto 10px',display:'flex',alignItems:'center',justifyContent:'center',gap:'clamp(10px,3vw,28px)',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',backdropFilter:'blur(20px)',maxWidth:500,flexWrap:'wrap'}}>
            <Btn icon={isMuted?MicOff:Mic}         label={isMuted?'Unmute':'Mute'}           variant={isMuted?'muted':'default'} onClick={toggleMute}           size="lg"/>
            <Btn icon={speakerOn?Volume2:VolumeX}  label={speakerOn?'Speaker':'Off'}          variant="speaker" active={speakerOn} onClick={()=>setSpeakerOn(v=>!v)} size="lg"/>
            <Btn icon={isRecording?Square:Circle}  label={isRecording?fmt(recDuration):'Record'} variant="record" active={isRecording} onClick={isRecording?stopRecording:startRecording} size="lg"/>
            <Btn icon={PhoneOff}                   label={isGroup?'Leave':'End'}              variant="end"     onClick={endCall}      size="lg"/>
          </div>
          <div style={{borderRadius:18,padding:'10px 20px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center',gap:'clamp(8px,2.5vw,22px)',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',backdropFilter:'blur(16px)',maxWidth:480,flexWrap:'wrap'}}>
            <Btn icon={UserPlus}  label="Add"              variant="purple" onClick={()=>setShowConferenceModal(true)}     size="md"/>
            <Btn icon={Video}     label="Video"            variant="blue"   onClick={handleSwitchToVideo} disabled={videoDisabled} title={videoTitle} size="md"/>
            <Btn icon={Mic}       label={noiseSuppression?'NS: On':'NS: Off'} variant="teal" active={noiseSuppression} onClick={()=>setNoiseSuppression(v=>!v)} size="md"/>
            <Btn icon={Settings}  label="Devices"          variant="default" active={showDeviceDrawer} onClick={()=>setShowDeviceDrawer(v=>!v)} size="md"/>
          </div>
          {(selectedMic!=='default'||activeSinkId) && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,marginTop:10}}>
              {selectedMic!=='default' && <div style={{display:'flex',alignItems:'center',gap:5}}><Mic style={{width:10,height:10,color:'rgba(255,255,255,.35)'}}/><span style={{fontSize:10,color:'rgba(255,255,255,.35)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{devices.mics.find(d=>d.deviceId===selectedMic)?.label?.split('(')[0]||'Custom mic'}</span></div>}
              {activeSinkId && <div style={{display:'flex',alignItems:'center',gap:5}}><Headphones style={{width:10,height:10,color:'rgba(255,255,255,.35)'}}/><span style={{fontSize:10,color:'rgba(255,255,255,.35)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{devices.speakers.find(d=>d.deviceId===activeSinkId)?.label?.split('(')[0]||'Custom output'}</span></div>}
            </div>
          )}
        </div>
      </div>
    </>
  );

  /* ══════════════════════════════════════════════════════════════════════
     NORMAL CARD  (incoming ring + pre-connect states)
  ══════════════════════════════════════════════════════════════════════ */
  const cardPos = isMobile
    ? {position:'fixed',left:0,right:0,bottom:0,zIndex:200}
    : {position:'fixed',right:Math.max(24,24-pos.x),bottom:Math.max(24,24-pos.y),zIndex:200,width:360};

  return (
    <><GlobalStyles/><AudioEls/>
      {showDeviceDrawer && <DeviceDrawer onClose={()=>setShowDeviceDrawer(false)} devices={devices} selectedMic={selectedMic} setSelectedMic={setSelectedMic} selectedSpeaker={selectedSpeaker} setSelectedSpeaker={setSelectedSpeaker} noiseSuppression={noiseSuppression} setNoiseSuppression={setNoiseSuppression} onSpeakerChange={handleSpeakerChange}/>}
      {showConferenceModal && <ConferenceModal onClose={()=>setShowConferenceModal(false)} onInvite={inviteToCall} participants={participants} peerId={activeCall?.peerId}/>}

      <div ref={cardRef} style={{...cardPos,cursor:isDragging?'grabbing':'auto',animation:mounted?'none':isMobile?'vm-slideup .34s cubic-bezier(.3,1.08,.6,1)':'vm-cardin .3s cubic-bezier(.3,1.1,.6,1)'}}>
        <div style={{borderRadius:isMobile?'24px 24px 0 0':20,overflow:'hidden',background:'linear-gradient(162deg,#07101f 0%,#0b1929 52%,#071422 100%)',border:'1px solid rgba(255,255,255,.09)',borderBottom:isMobile?'none':undefined,boxShadow:isDragging?'0 32px 80px rgba(0,0,0,.9),0 0 0 1.5px rgba(255,255,255,.1)':'0 24px 64px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.06)',transition:isDragging?'none':'box-shadow .2s'}}>
          <div style={{height:2.5,background:accentLine,animation:'vm-glow 2.8s ease infinite'}}/>

          {/* Mobile handle bar */}
          {isMobile && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 14px 2px',gap:8}}>
              <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,.2)'}}/>
              {!isIncoming && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{position:'relative',display:'flex',width:7,height:7}}><span style={{position:'absolute',inset:0,borderRadius:'50%',background:statusColor,opacity:.75,animation:'vm-dot 1.4s ease infinite'}}/><span style={{position:'relative',borderRadius:'50%',width:'100%',height:'100%',background:statusColor}}/></span>
                    <RecBadge rec={isRecording} dur={recDuration}/>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <button onClick={()=>setMode('minimized')} style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} title="Minimize"><ChevronDown style={{width:14,height:14,color:'#94a3b8'}}/></button>
                    <button onClick={()=>setMode('fullscreen')} style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} title="Fullscreen"><Maximize2 style={{width:13,height:13,color:'#94a3b8'}}/></button>
                    <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',justifyContent:'center'}}><GripHorizontal style={{width:13,height:13,color:'rgba(255,255,255,.2)'}}/></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop drag handle */}
          {!isMobile && (
            <div onMouseDown={onDragStart} onTouchStart={onDragStart} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px 2px',cursor:'grab',userSelect:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{position:'relative',display:'flex',width:8,height:8}}><span style={{position:'absolute',inset:0,borderRadius:'50%',background:statusColor,opacity:.75,animation:'vm-dot 1.4s ease infinite'}}/><span style={{position:'relative',borderRadius:'50%',width:'100%',height:'100%',background:statusColor}}/></span>
                <RecBadge rec={isRecording} dur={recDuration}/>
                {isConnected && networkQuality!=='unknown' && (
                  <div style={{display:'flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:999,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)'}}>
                    {networkQuality==='poor'?<WifiOff style={{width:9,height:9,color:nqColor}}/>:<Wifi style={{width:9,height:9,color:nqColor}}/>}
                    <span style={{fontSize:9,fontWeight:700,color:nqColor}}>{networkQuality==='good'?'HD':networkQuality==='fair'?'SD':'Weak'}</span>
                  </div>
                )}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:2}}>
                {!isIncoming && <>
                  <button onClick={()=>setMode('minimized')} onMouseDown={e=>e.stopPropagation()} style={{width:22,height:22,borderRadius:'50%',background:'none',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} title="Minimize"><ChevronDown style={{width:12,height:12,color:'#475569'}}/></button>
                  <button onClick={()=>setMode('fullscreen')} onMouseDown={e=>e.stopPropagation()} style={{width:22,height:22,borderRadius:'50%',background:'none',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} title="Fullscreen"><Maximize2 style={{width:11,height:11,color:'#475569'}}/></button>
                </>}
                <GripHorizontal style={{width:13,height:13,color:'rgba(255,255,255,.14)',marginLeft:4}}/>
              </div>
            </div>
          )}

          {/* Body */}
          <div style={{padding:isMobile?'16px 22px 6px':'12px 20px 6px'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,marginBottom:isIncoming?20:14}}>
              <Avatar src={peerAvatar} name={peerName} size={isIncoming?90:72} speaking={isSpeaking&&!isIncoming} ringing={isIncoming}/>
              <div style={{textAlign:'center',width:'100%'}}>
                {isIncoming && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:7}}>
                    <WaveBars active color="#10b981" count={5} height={12}/>
                    <span style={{fontSize:10,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',color:'#10b981'}}>Incoming audio call</span>
                    <WaveBars active color="#10b981" count={5} height={12}/>
                  </div>
                )}
                <h2 style={{color:'#fff',fontWeight:800,fontSize:isMobile?(isIncoming?21:18):(isIncoming?19:16),margin:'0 0 6px',letterSpacing:'-.025em',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
                  {isGroup && <Users style={{width:15,height:15,color:'#10b981',flexShrink:0}}/>}
                  {peerName}
                </h2>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  {isSpeaking && <WaveBars active color="#10b981" count={5} height={12}/>}
                  <span style={{fontSize:12,fontFamily:'monospace',fontWeight:700,color:statusColor}}>{statusText}</span>
                  {isSpeaking && <WaveBars active color="#06b6d4" count={5} height={12}/>}
                </div>
                {isOffline && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:8,padding:'3px 10px',borderRadius:999,background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.3)'}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:'#fbbf24',animation:'vm-rec 1.5s ease infinite'}}/>
                    <span style={{fontSize:10,fontWeight:700,color:'#fbbf24'}}>Ringing when they reconnect</span>
                  </div>
                )}
                {isIncoming && <p style={{color:'rgba(100,116,139,.9)',fontSize:12,margin:'6px 0 0'}}>V-Meet · Audio call</p>}
              </div>
            </div>

            {/* Group participant tiles */}
            {isGroup && participants.length>0 && !isIncoming && (
              <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:2,marginBottom:14,padding:'6px',borderRadius:14,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)'}}>
                {participants.map(p=><ParticipantTile key={p.userId} participant={p} speaking={activeSpeaker===p.userId}/>)}
              </div>
            )}

            {/* Incoming: accept / decline */}
 {isIncoming && (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,paddingBottom:4}}>
    <CircleTimer/>
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:isMobile?56:48}}>
      <Btn icon={PhoneOff} label="Decline" variant="reject"  onClick={rejectCall} size="lg"/>
      <Btn icon={Phone}    label="Accept"  variant="accept"  onClick={acceptCall} size="lg"/>
    </div>
  </div>
)}
            {/* Active call controls */}
            {!isIncoming && (
              <>
                <div style={{borderRadius:18,background:'rgba(255,255,255,.045)',border:'1px solid rgba(255,255,255,.09)',overflow:'hidden',marginBottom:7}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:isMobile?16:12,padding:isMobile?'15px 18px':'13px 16px'}}>
                    <Btn icon={isMuted?MicOff:Mic}        label={isMuted?'Unmute':'Mute'}             variant={isMuted?'muted':'default'} onClick={toggleMute}           size={isMobile?'lg':'md'}/>
                    <Btn icon={speakerOn?Volume2:VolumeX} label={speakerOn?'Speaker':'Off'}            variant="speaker" active={speakerOn} onClick={()=>setSpeakerOn(v=>!v)} size={isMobile?'lg':'md'}/>
                    <Btn icon={isRecording?Square:Circle} label={isRecording?fmt(recDuration):'Record'} variant="record" active={isRecording} onClick={isRecording?stopRecording:startRecording} size={isMobile?'lg':'md'}/>
                    <Btn icon={PhoneOff}                  label={isGroup?'Leave':'End'}                variant="end"     onClick={endCall}      size={isMobile?'lg':'md'}/>
                  </div>
                  <div style={{height:1,background:'rgba(255,255,255,.07)',margin:'0 14px'}}/>
                  {(!isMobile||showSecRow) && (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:isMobile?16:12,padding:isMobile?'13px 18px':'11px 16px',animation:'vm-panelin .18s ease'}}>
                      <Btn icon={UserPlus} label="Add"     variant="purple" onClick={()=>setShowConferenceModal(true)} size="sm"/>
                      <Btn icon={Video}    label="Video"   variant="blue"   onClick={handleSwitchToVideo} disabled={videoDisabled} title={videoTitle} size="sm"/>
                      <Btn icon={Mic}      label={noiseSuppression?'NS: On':'NS: Off'} variant="teal" active={noiseSuppression} onClick={()=>setNoiseSuppression(v=>!v)} size="sm"/>
                      <Btn icon={Settings} label="Devices" variant="default" active={showDeviceDrawer} onClick={()=>setShowDeviceDrawer(v=>!v)} size="sm"/>
                    </div>
                  )}
                  {isMobile && (
                    <button onClick={()=>setShowSecRow(v=>!v)} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%',padding:'8px 0',background:'rgba(255,255,255,.025)',border:'none',borderTop:'1px solid rgba(255,255,255,.065)',cursor:'pointer'}}>
                      {showSecRow?<ChevronUp style={{width:12,height:12,color:'rgba(255,255,255,.32)'}}/>:<ChevronDown style={{width:12,height:12,color:'rgba(255,255,255,.32)'}}/>}
                      <span style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,.32)'}}>{showSecRow?'Less':'More options'}</span>
                    </button>
                  )}
                </div>
                {(noiseSuppression||activeSinkId) && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,marginBottom:4}}>
                    {noiseSuppression && <div style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:5,height:5,borderRadius:'50%',background:'#14b8a6'}}/><span style={{fontSize:9,color:'rgba(255,255,255,.3)',fontWeight:600}}>Noise Filter</span></div>}
                    {activeSinkId && <div style={{display:'flex',alignItems:'center',gap:4}}><Headphones style={{width:9,height:9,color:'rgba(255,255,255,.3)'}}/><span style={{fontSize:9,color:'rgba(255,255,255,.3)',fontWeight:600,maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{devices.speakers.find(d=>d.deviceId===activeSinkId)?.label?.split('(')[0]||'Custom output'}</span></div>}
                  </div>
                )}
              </>
            )}
          </div>
          {isMobile && <div style={{height:'max(14px,env(safe-area-inset-bottom,14px))'}}/>}
        </div>
      </div>
    </>
  );
};

export default AudioCallUI;