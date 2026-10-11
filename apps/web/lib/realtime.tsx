'use client';
import {
  SOCKET_PATH,
  type ClientToServerEvents,
  type JoinTarget,
  type ServerToClientEvents,
} from '@glasswork/shared';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RealtimeValue {
  socket: AppSocket | null;
  connected: boolean;
  /** Bumps every time the server reports a change in the joined project; tabs refetch on it. */
  tick: number;
  /** User ids currently online in the joined rooms. */
  online: Set<string>;
}

const Ctx = createContext<RealtimeValue>({ socket: null, connected: false, tick: 0, online: new Set() });
export const useRealtime = () => useContext(Ctx);

/**
 * One authenticated socket for a page. It joins the given project room (the server re-checks membership) and
 * exposes a `tick` that changes whenever something happens in the project, so views refresh without polling.
 */
export function RealtimeProvider({ join, children }: { join?: JoinTarget[]; children: ReactNode }) {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const joinKey = JSON.stringify(join ?? []);
  const joinRef = useRef(join);
  joinRef.current = join;

  useEffect(() => {
    const s: AppSocket = io(API_URL, { path: SOCKET_PATH, withCredentials: true, transports: ['websocket'] });
    const joinAll = () => {
      for (const target of joinRef.current ?? []) {
        s.emit('room:join', target, (res) => {
          if (res.ok && res.online) setOnline((prev) => new Set([...prev, ...res.online!]));
        });
      }
    };
    s.on('session:ready', () => {
      setConnected(true);
      joinAll(); // also after a reconnect: rooms are per-connection
    });
    s.on('disconnect', () => setConnected(false));
    s.on('project:event', () => setTick((t) => t + 1));
    s.on('presence:update', (p) =>
      setOnline((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      }),
    );
    setSocket(s);
    return () => {
      s.close();
      setSocket(null);
      setConnected(false);
    };
    // The socket is recreated only when the set of rooms changes.
  }, [joinKey]);

  const value = useMemo(() => ({ socket, connected, tick, online }), [socket, connected, tick, online]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
