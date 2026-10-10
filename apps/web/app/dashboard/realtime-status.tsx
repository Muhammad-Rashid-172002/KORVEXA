'use client';
import { SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';

type Status = 'connecting' | 'connected' | 'disconnected' | 'unauthorized';

export function RealtimeStatus() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.on('session:ready', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', (err) => setStatus(err.message === 'unauthorized' ? 'unauthorized' : 'disconnected'));
    return () => {
      socket.close();
    };
  }, []);

  const ping = () => {
    const started = performance.now();
    socketRef.current?.emit('ping', { echo: 'dashboard' }, () => setLatency(Math.round(performance.now() - started)));
  };

  const label: Record<Status, string> = {
    connecting: 'Connecting…',
    connected: 'Connected',
    disconnected: 'Disconnected',
    unauthorized: 'Not authorised',
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm" data-testid="realtime-status" data-status={status}>
        <span
          aria-hidden
          className={`size-2 rounded-full ${status === 'connected' ? 'bg-success' : status === 'connecting' ? 'bg-warning' : 'bg-danger'}`}
        />
        {label[status]}
        {latency !== null && <span className="text-muted">· {latency} ms</span>}
      </p>
      <Button size="sm" variant="secondary" onClick={ping} disabled={status !== 'connected'}>
        Ping
      </Button>
    </div>
  );
}
