// context/PiPContext.jsx
// Manages the Picture-in-Picture floating mini-video state globally.
// VideoRoom activates PiP when user navigates away mid-call.
// VideoRoom deactivates PiP when the call ends intentionally.

import { createContext, useContext, useState, useCallback } from 'react';

const PiPContext = createContext(null);

export const usePiP = () => {
  const ctx = useContext(PiPContext);
  if (!ctx) throw new Error('usePiP must be used within PiPProvider');
  return ctx;
};

export const PiPProvider = ({ children }) => {
  // null = no active PiP
  // { roomId, localStream, remoteStreams } = active PiP
  const [pipState, setPipState] = useState(null);

  // Call this from VideoRoom's cleanup when navigating away WITHOUT ending call
  const activatePiP = useCallback((roomId, localStream, remoteStreams) => {
    setPipState({ roomId, localStream, remoteStreams });
  }, []);

  // Call this when the call ends intentionally (end button, other party left, etc.)
  const deactivatePiP = useCallback(() => {
    setPipState(null);
  }, []);

  // Call this when VideoRoom mounts again (user clicked the PiP to return)
  // Just hides the overlay — doesn't touch the call
  const hidePiP = useCallback(() => {
    setPipState(null);
  }, []);

  return (
    <PiPContext.Provider value={{ pipState, activatePiP, deactivatePiP, hidePiP }}>
      {children}
    </PiPContext.Provider>
  );
};