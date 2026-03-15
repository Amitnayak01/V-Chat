/**
 * useThemeTokens.js
 * Returns the correct design token set based on current [data-theme] attribute.
 * Reactively updates when Appearance.jsx calls applySettings() and changes the theme.
 */
import { useState, useEffect } from 'react';

const LIGHT = {
  bg:            '#f0f4f8',
  card:          '#ffffff',
  cardHover:     '#f1f5f9',
  dark:          '#0a1220',
  header:        '#ffffff',
  headerBd:      '#e8edf2',
  input:         '#f8fafc',
  inputBd:       '#e2e8f0',
  divider:       '#f1f5f9',
  slate1:        '#1e293b',
  slate2:        '#475569',
  slate3:        '#94a3b8',
  slate4:        '#e2e8f0',
  slate5:        '#f8fafc',
  tabActiveBg:   '#1e293b',   // ← ADD
  tabActiveText: '#ffffff',   // ← ADD
  tabText:       '#94a3b8',   // ← ADD
  teal:     '#0fe6c0',
  tealBg:   'rgba(15,230,192,0.10)',
  tealBd:   'rgba(15,230,192,0.25)',
  red:      '#ef4444',
  gold:     '#f0a83e',
  blue:     '#3b82f6',
  blueBg:   'rgba(59,130,246,0.10)',
  blueBd:   'rgba(59,130,246,0.28)',
  green:    '#22c55e',
  greenBg:  'rgba(34,197,94,0.12)',
  greenBd:  'rgba(34,197,94,0.28)',
  violet:   '#8b5cf6',
  violetBg: 'rgba(139,92,246,0.12)',
  violetBd: 'rgba(139,92,246,0.28)',
  orange:   '#f97316',
  orangeBg: 'rgba(249,115,22,0.12)',
};

const DARK = {
  ...LIGHT,
  bg:            '#080e17',
  card:          '#0d1526',
  cardHover:     'rgba(255,255,255,0.05)',
  dark:          '#f0f4f8',
  header:        '#0d1526',
  headerBd:      '#1a2940',
  input:         '#1a2535',
  inputBd:       '#1a2940',
  divider:       '#131f30',
  slate1:        '#e8edf5',
  slate2:        '#b8c4d8',
  slate3:        '#4a6080',
  slate4:        '#1a2940',
  slate5:        '#111d2e',
  tabActiveBg:   '#1a2d42',   // ← ADD — visible pill on dark bg
  tabActiveText: '#ffffff',   // ← ADD — white text
  tabText:       '#8aa4c8',   // ← ADD — readable inactive text
};


const getTokens = () => {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'dark' ? DARK : LIGHT;
};

export const useThemeTokens = () => {
  const [T, setT] = useState(getTokens);

  useEffect(() => {
    // Watch for data-theme attribute changes on <html>
    const observer = new MutationObserver(() => setT(getTokens()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return T;
};