import { createContext, useContext, type ReactNode } from 'react';
import { useLiveStream, type LiveConnectionState } from '../hooks/useLiveStream';

const LiveContext = createContext<LiveConnectionState>('connecting');

/** One SSE connection per guest tab, shared by every component. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const state = useLiveStream();
  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export const useLiveConnection = () => useContext(LiveContext);
