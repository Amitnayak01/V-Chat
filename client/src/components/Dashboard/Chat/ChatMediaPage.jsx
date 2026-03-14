import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Download, X, ZoomIn, ZoomOut, RotateCw,
  FileText, File, Film, Image as ImageIcon, Link as LinkIcon,
  ExternalLink, Play, Music,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { directMessageAPI } from '../../../utils/api';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmtSize = (n) => {
  if (!n) return '';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
};

const getMediaType = (att) => {
  const mime = att?.mimeType || '';
  const url  = att?.url      || '';
  const name = att?.name     || '';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url))               return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|ogg|wav|m4a)(\?|$)/i.test(url))               return 'audio';
  if (mime === 'application/pdf' || /\.pdf(\?|$)/i.test(url))                              return 'pdf';
  return 'file';
};

const extractLinks = (text) => {
  if (!text) return [];
  const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;
  return text.match(urlRegex) || [];
};

const getDomain = (url) => {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
};

/* ─── Full-screen image/video lightbox ───────────────────────────────────── */
const Lightbox = ({ items, startIndex, onClose }) => {
  const [idx,    setIdx]    = useState(startIndex);
  const [zoom,   setZoom]   = useState(1);
  const [rotate, setRotate] = useState(0);

  const cur   = items[idx];
  const isVid = cur?.type === 'video';
  const total = items.length;

  useEffect(() => { setZoom(1); setRotate(0); }, [idx]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % total);
      if (e.key === 'ArrowLeft')  setIdx((i) => (i - 1 + total) % total);
    };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose, total]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: '#000' }}>
      {/* blurred bg */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {!isVid
          ? <img src={cur.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.18) saturate(1.3)', transform: 'scale(1.1)' }} />
          : <video src={cur.src} muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.18)', transform: 'scale(1.1)' }} preload="metadata" />
        }
      </div>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)' }} className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="min-w-0">
          <p className="text-white/90 text-sm font-semibold truncate max-w-[50vw]">{cur.senderName}</p>
          <p className="text-white/45 text-xs">{cur.time} {total > 1 ? `· ${idx + 1}/${total}` : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          {!isVid && (
            <>
              <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => setRotate(r => (r + 90) % 360)} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"><RotateCw className="w-5 h-5" /></button>
            </>
          )}
          <a href={cur.src} download={cur.name} target="_blank" rel="noreferrer" className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"><Download className="w-5 h-5" /></a>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-1"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ zIndex: 1 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {total > 1 && (
          <button onClick={() => setIdx(i => (i - 1 + total) % total)}
            className="absolute left-3 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        <div className="w-full h-full flex items-center justify-center" style={{ padding: total > 1 ? '16px 64px' : '16px 24px' }}>
          {isVid
            ? <video key={cur.src} src={cur.src} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
            : <img key={cur.src} src={cur.src} alt={cur.name || ''} draggable={false}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${zoom}) rotate(${rotate}deg)`, transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', userSelect: 'none', borderRadius: zoom > 1 ? 0 : 10, boxShadow: '0 8px 48px rgba(0,0,0,0.5)' }} />
          }
        </div>
        {!isVid && zoom !== 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs text-white/80" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
            {Math.round(zoom * 100)}%
          </div>
        )}
        {total > 1 && (
          <button onClick={() => setIdx(i => (i + 1) % total)}
            className="absolute right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M7.5 5L12.5 10L7.5 15" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

/* ─── Video thumbnail cell ────────────────────────────────────────────────── */
const VideoThumbCell = ({ url, onClick }) => {
  const ref = useRef(null);
  const [dur, setDur] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const fn = () => { if (v.duration > 0 && isFinite(v.duration)) setDur(v.duration); setLoaded(true); };
    v.addEventListener('loadedmetadata', fn);
    v.addEventListener('loadeddata', () => setLoaded(true));
    if (v.readyState >= 1) fn();
    return () => v.removeEventListener('loadedmetadata', fn);
  }, [url]);

  const fmtDur = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

  return (
    <div onClick={onClick} className="relative w-full h-full bg-black cursor-pointer group overflow-hidden">
      <video ref={ref} src={url} preload="metadata" muted playsInline
        style={{ width:'100%', height:'100%', objectFit:'cover', opacity: loaded ? 0.8 : 0.3, transition:'opacity 0.2s' }} />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
        <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.4)' }} className="group-hover:scale-110 transition-transform">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ marginLeft:2 }}><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      {dur > 0 && (
        <div style={{ position:'absolute', bottom:5, left:5, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:10, fontWeight:600, fontFamily:'monospace', padding:'2px 5px', borderRadius:4, backdropFilter:'blur(4px)' }}>
          {fmtDur(dur)}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ChatMediaPage
═══════════════════════════════════════════════════════════════════════════ */
export default function ChatMediaPage() {
  const { chatId }  = useParams();
  const navigate    = useNavigate();

  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('media'); // 'media' | 'files' | 'links'
  const [lightbox,  setLightbox]  = useState(null);    // { items, index }

  /* ── Fetch all messages ────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await directMessageAPI.getMessages(chatId, undefined, 500);
        if (res.data.success) setMessages(res.data.messages || []);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, [chatId]);

  /* ── Derived lists ──────────────────────────────────────────────────── */
  const { mediaItems, fileItems, linkItems } = (() => {
    const media = [], files = [], links = [];

    for (const msg of messages) {
      const sender   = msg.sender?.username || 'Unknown';
      const time     = msg.createdAt ? format(new Date(msg.createdAt), 'MMM d, yyyy · h:mm a') : '';
      const timeAgo  = msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : '';

      // attachments
      for (const att of msg.attachments || []) {
        const t = getMediaType(att);
        if (t === 'image' || t === 'video') {
          media.push({ src: att.url, name: att.name, type: t, senderName: sender, time, timeAgo, msgId: msg._id });
        } else if (t !== 'audio') {
          files.push({ url: att.url, name: att.name || 'File', size: att.size, type: t, mimeType: att.mimeType, senderName: sender, time, timeAgo, msgId: msg._id });
        }
      }

      // message type shortcuts
      if (msg.type === 'image' && msg.attachments?.length === 0) {
        // skip — already covered above
      }

      // extract links from text
      const extracted = extractLinks(msg.content);
      for (const url of extracted) {
        links.push({ url, senderName: sender, time, timeAgo, msgId: msg._id });
      }
    }

    // sort newest first
    const rev = (arr) => [...arr].reverse();
    return { mediaItems: rev(media), fileItems: rev(files), linkItems: rev(links) };
  })();

  /* ── Month grouping for media grid ─────────────────────────────────── */
  const groupedMedia = (() => {
    const groups = new Map();
    for (const item of mediaItems) {
      const key = item.time.split('·')[0].trim(); // "Jan 1, 2025"
      const month = (() => {
        try { return format(new Date(item.time.split('·')[0].trim()), 'MMMM yyyy'); }
        catch { return 'Earlier'; }
      })();
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push(item);
    }
    return [...groups.entries()].map(([month, items]) => ({ month, items }));
  })();

  const tabCounts = { media: mediaItems.length, files: fileItems.length, links: linkItems.length };

  const fileIcon = (type, mime) => {
    if (type === 'pdf') return <FileText className="w-5 h-5" />;
    if (mime?.startsWith('audio/')) return <Music className="w-5 h-5" />;
    if (type === 'video') return <Film className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50" style={{ minHeight: '100dvh' }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-[#075e54] text-white px-4 pt-10 pb-0 shrink-0" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold tracking-tight">Media, links and docs</h1>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(['media', 'files', 'links']).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-3 text-sm font-semibold transition-all relative capitalize"
              style={{ color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.55)' }}
            >
              {tab}
              {tabCounts[tab] > 0 && (
                <span className="ml-1.5 text-[10px] opacity-75">({tabCounts[tab]})</span>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full"
                  style={{ animation: 'tabUnderline 0.18s ease' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <LoadingSkeleton activeTab={activeTab} />
        ) : (

          /* ════════ MEDIA TAB ════════ */
          activeTab === 'media' ? (
            mediaItems.length === 0 ? (
              <EmptyState icon={<ImageIcon className="w-10 h-10 text-slate-300" />} label="No media shared yet" />
            ) : (
              <div className="pb-6">
                {groupedMedia.map(({ month, items }) => (
                  <div key={month}>
                    <div className="px-4 py-2.5 sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{month}</p>
                    </div>
                    <div className="grid px-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                      {items.map((item, i) => (
                        <div
                          key={`${item.msgId}-${i}`}
                          className="relative bg-slate-200 overflow-hidden cursor-pointer group"
                          style={{ paddingBottom: '100%', animation: `fadeIn 0.25s ease ${i * 0.02}s both` }}
                          onClick={() => {
                            const startIdx = mediaItems.findIndex((x) => x.src === item.src && x.msgId === item.msgId);
                            setLightbox({ items: mediaItems, index: startIdx >= 0 ? startIdx : 0 });
                          }}
                        >
                          <div className="absolute inset-0">
                            {item.type === 'video'
                              ? <VideoThumbCell url={item.src} />
                              : (
                                <div className="relative w-full h-full group">
                                  <img src={item.src} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" onError={(e) => { e.target.style.display = 'none'; }} />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                  </div>
                                </div>
                              )
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )

          /* ════════ FILES TAB ════════ */
          : activeTab === 'files' ? (
            fileItems.length === 0 ? (
              <EmptyState icon={<FileText className="w-10 h-10 text-slate-300" />} label="No files shared yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {fileItems.map((f, i) => (
                  <div key={`${f.msgId}-${i}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white transition-colors" style={{ animation: `fadeIn 0.2s ease ${i * 0.03}s both` }}>
                    {/* Icon */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: f.type === 'pdf' ? '#fff1f0' : '#f0f4ff', color: f.type === 'pdf' ? '#ef4444' : '#3b82f6' }}>
                      {fileIcon(f.type, f.mimeType)}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{f.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[f.size ? fmtSize(f.size) : null, f.senderName, f.timeAgo].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {/* Download */}
                    <a href={f.url} download={f.name} target="_blank" rel="noreferrer"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-[#075e54] hover:bg-[#075e54]/8 transition-colors shrink-0">
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )
          )

          /* ════════ LINKS TAB ════════ */
          : (
            linkItems.length === 0 ? (
              <EmptyState icon={<LinkIcon className="w-10 h-10 text-slate-300" />} label="No links shared yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {linkItems.map((l, i) => (
                  <div key={`${l.msgId}-${i}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white transition-colors" style={{ animation: `fadeIn 0.2s ease ${i * 0.03}s both` }}>
                    {/* Favicon / domain icon */}
                    <div className="w-11 h-11 rounded-xl bg-blue-50 flex flex-col items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={`https://www.google.com/s2/favicons?sz=32&domain=${getDomain(l.url)}`}
                        alt=""
                        className="w-6 h-6"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#075e54] truncate">{getDomain(l.url)}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{l.url}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{l.senderName} · {l.timeAgo}</p>
                    </div>
                    {/* Open */}
                    <a href={l.url} target="_blank" rel="noreferrer"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-[#075e54] hover:bg-[#075e54]/8 transition-colors shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )
          )
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes tabUnderline {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */
const EmptyState = ({ icon, label }) => (
  <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      {icon}
    </div>
    <p className="text-slate-400 text-sm font-medium">{label}</p>
  </div>
);

/* ─── Loading skeleton ────────────────────────────────────────────────────── */
const LoadingSkeleton = ({ activeTab }) => (
  <div className="animate-pulse p-2">
    {activeTab === 'media' ? (
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-slate-200" style={{ paddingBottom: '100%' }} />
        ))}
      </div>
    ) : (
      <div className="divide-y divide-slate-100">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-11 h-11 bg-slate-200 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);