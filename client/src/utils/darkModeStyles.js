/**
 * darkModeStyles.js
 * Dynamic <style> injection for .mh-root and .ch-root internals
 * that can't be handled by inline style overrides.
 * Import and call getDarkStyles(isDark) to get the style string.
 */

export const getMHStyles = (isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
  .mh-root * { box-sizing: border-box; font-family: 'DM Sans', sans-serif; }
  .mh-mono   { font-family: 'JetBrains Mono', monospace !important; }
  @keyframes mh-in     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes mh-fade   { from{opacity:0} to{opacity:1} }
  @keyframes mh-slide  { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
  @keyframes mh-pop    { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
  @keyframes mh-expand { from{opacity:0;transform:scaleY(.88)} to{opacity:1;transform:scaleY(1)} }
  @keyframes mh-pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
  .mh-row { animation: mh-in .22s ease both; }
  .mh-row:hover .mh-actions { opacity: 1 !important; }
  .mh-row:hover { background: ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} !important; }
  .mh-btn-ghost { transition: all .15s; }
  .mh-btn-ghost:hover { transform: translateY(-1px); }
  .mh-btn-ghost:active { transform: scale(.92); }
  .mh-tab { transition: all .18s; }
  .mh-row-action { transition: all .12s; }
  .mh-row-action:hover { transform: scale(1.08); }
  .mh-row-action:active { transform: scale(.92); }
  .mh-participant-chip:hover { background: ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} !important; }
  .mh-live-dot { animation: mh-pulse 1.4s ease-in-out infinite; }
  .mh-skeleton { animation: mh-pulse 1.6s ease-in-out infinite; background: ${isDark ? '#1a2535' : '#e2e8f0'}; border-radius: 12px; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${isDark ? '#1a2940' : '#cbd5e1'}; border-radius: 2px; }
`;

export const getCHStyles = (isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
  .ch-root * { box-sizing: border-box; font-family: 'DM Sans', sans-serif; }
  .ch-mono   { font-family: 'JetBrains Mono', monospace !important; }
  @keyframes ch-in    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes ch-fade  { from{opacity:0} to{opacity:1} }
  @keyframes ch-slide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
  @keyframes ch-pop   { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
  @keyframes ch-expand{ from{opacity:0;transform:scaleY(.88)} to{opacity:1;transform:scaleY(1)} }
  .ch-row { animation: ch-in .22s ease both; }
  .ch-row:hover .ch-actions { opacity: 1 !important; }
  .ch-row:hover { background: ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} !important; }
  .ch-btn-ghost { transition: all .15s; }
  .ch-btn-ghost:hover { transform: translateY(-1px); }
  .ch-btn-ghost:active { transform: scale(.92); }
  .ch-tab { transition: all .18s; }
  .ch-row-action { transition: all .12s; }
  .ch-row-action:hover { transform: scale(1.08); }
  .ch-row-action:active { transform: scale(.92); }
  .ch-participant-chip:hover { background: ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${isDark ? '#1a2940' : '#cbd5e1'}; border-radius: 2px; }
`;