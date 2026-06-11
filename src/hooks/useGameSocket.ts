import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Question, ClientMessage } from '../types';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/ws`;

export interface GameSocketData {
  state: GameState | null;
  questions: Question[];
  totalQuestions: number;
  playerCount: number;
  players: { name: string }[];
  connected: boolean;
  myClientId: string | null;
  send: (message: ClientMessage) => void;
}

export function useGameSocket(): GameSocketData {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [players, setPlayers] = useState<{ name: string }[]>([]);
  const [connected, setConnected] = useState(false);
  const [myClientId, setMyClientId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'hello') {
          setMyClientId(msg.clientId as string);
        } else if (msg.type === 'state-update') {
          setGameState(msg.state as GameState);
          setQuestions(msg.questions as Question[]);
          setTotalQuestions(msg.totalQuestions as number);
          setPlayerCount(msg.playerCount as number);
          setPlayers((msg.players as { name: string }[]) ?? []);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { state: gameState, questions, totalQuestions, playerCount, players, connected, myClientId, send };
}
