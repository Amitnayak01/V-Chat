import { useState, useEffect, useRef, useCallback } from 'react';

const useActiveSpeaker = (localUserId, localStream, remoteStreams, enabled = false) => {
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const analysersRef = useRef(new Map());
  const rafRef       = useRef(null);
  const tickRef      = useRef(0);

  const createAnalyser = useCallback((userId, stream) => {
    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize               = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analysersRef.current.set(userId, { analyser, dataArray, source, ctx });
    } catch (_) {}
  }, []);

  const destroyAnalyser = useCallback((userId) => {
    const entry = analysersRef.current.get(userId);
    if (entry) {
      try { entry.source.disconnect(); } catch (_) {}
      try { entry.ctx.close(); }         catch (_) {}
      analysersRef.current.delete(userId);
    }
  }, []);

  // Keep analysers in sync — but only when enabled
  useEffect(() => {
    if (!enabled) {
      for (const id of [...analysersRef.current.keys()]) destroyAnalyser(id);
      setActiveSpeaker(null);
      return;
    }

    const currentIds = new Set();

    if (localStream && localUserId) {
      currentIds.add(localUserId);
      if (!analysersRef.current.has(localUserId)) {
        createAnalyser(localUserId, localStream);
      }
    }

    if (remoteStreams) {
      remoteStreams.forEach((stream, userId) => {
        currentIds.add(userId);
        if (!analysersRef.current.has(userId)) {
          createAnalyser(userId, stream);
        }
      });
    }

    for (const id of analysersRef.current.keys()) {
      if (!currentIds.has(id)) destroyAnalyser(id);
    }
  }, [enabled, localStream, remoteStreams, localUserId, createAnalyser, destroyAnalyser]);

  // Polling loop — only runs when enabled
  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const POLL_EVERY = 5;

    const poll = () => {
      rafRef.current = requestAnimationFrame(poll);
      if (++tickRef.current % POLL_EVERY !== 0) return;

      let maxVol  = 0.02;
      let loudest = null;

      for (const [userId, { analyser, dataArray }] of analysersRef.current) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length / 255;
        if (avg > maxVol) { maxVol = avg; loudest = userId; }
      }

      setActiveSpeaker(prev => (prev !== loudest ? loudest : prev));
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafRef.current);
      for (const id of [...analysersRef.current.keys()]) destroyAnalyser(id);
    };
  }, [enabled, destroyAnalyser]);

  return activeSpeaker;
};

export default useActiveSpeaker;