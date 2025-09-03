import React, { createContext, useContext, useEffect, useState } from "react";

export const TickContext = createContext<number>(Date.now());

export function TickProvider({ children, intervalMs = 1000 }: { children: React.ReactNode; intervalMs?: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return <TickContext.Provider value={now}>{children}</TickContext.Provider>;
}

export function useTick() {
  return useContext(TickContext);
}
