import { createContext, useContext, useState, useCallback } from 'react';

const MinimizedCallContext = createContext(null);

export const useMinimizedCall = () => {
  const ctx = useContext(MinimizedCallContext);
  if (!ctx) throw new Error('useMinimizedCall must be used within MinimizedCallProvider');
  return ctx;
};

export const MinimizedCallProvider = ({ children }) => {
  // shape: { roomId, userId, localUsername, participants } | null
  const [minimizedCall, setMinimizedCall] = useState(null);

  const minimizeCall      = useCallback((data) => setMinimizedCall(data), []);
  const clearMinimizedCall = useCallback(() => setMinimizedCall(null), []);

  return (
    <MinimizedCallContext.Provider value={{ minimizedCall, minimizeCall, clearMinimizedCall }}>
      {children}
    </MinimizedCallContext.Provider>
  );
};