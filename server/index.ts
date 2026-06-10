import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Question {
  id: number;
  category: string;
  term: string;
  explanation: string;
  contributor: string;
}

interface BuzzerEntry {
  id: string;
  name: string;
  pressedAt: number;
}

interface GameState {
  currentQuestionIndex: number;
  showAnswer: boolean;
  buzzerQueue: BuzzerEntry[];
  currentAnswerIndex: number;
  scores: Record<string, { name: string; score: number }>;
}

type ClientRole = 'host' | 'monitor' | 'buzzer';

interface Client {
  ws: WebSocket;
  id: string;
  role: ClientRole | null;
  name: string | null;
}

type C2S =
  | { type: 'register'; role: ClientRole; name?: string }
  | { type: 'buzz' }
  | { type: 'next-question' }
  | { type: 'prev-question' }
  | { type: 'toggle-answer' }
  | { type: 'correct' }
  | { type: 'wrong' }
  | { type: 'undo-wrong' }
  | { type: 'reset-buzzer' };

// Load questions
const questionsPath = join(__dirname, '../public/questions.json');
const questions: Question[] = JSON.parse(readFileSync(questionsPath, 'utf-8'));

const clients = new Map<string, Client>();

const state: GameState = {
  currentQuestionIndex: 0,
  showAnswer: false,
  buzzerQueue: [],
  currentAnswerIndex: 0,
  scores: {},
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function isHost(clientId: string): boolean {
  return clients.get(clientId)?.role === 'host';
}

function broadcast() {
  const message = JSON.stringify({
    type: 'state-update',
    state,
    questions,
    totalQuestions: questions.length,
  });
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return 'localhost';
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Serve static files in production
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*path', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// Network info endpoint
app.get('/api/network', (_req, res) => {
  res.json({ localIP: getLocalIP(), port: PORT });
});

wss.on('connection', (ws) => {
  const clientId = generateId();
  const client: Client = { ws, id: clientId, role: null, name: null };
  clients.set(clientId, client);

  // Tell client its own ID
  ws.send(JSON.stringify({ type: 'hello', clientId }));
  // Send current state
  ws.send(JSON.stringify({
    type: 'state-update',
    state,
    questions,
    totalQuestions: questions.length,
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as C2S;
      handleMessage(clientId, message);
    } catch (e) {
      console.error('Message parse error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    // Remove from buzzer queue if disconnected mid-round
    const idx = state.buzzerQueue.findIndex(b => b.id === clientId);
    if (idx !== -1) {
      state.buzzerQueue.splice(idx, 1);
      if (state.currentAnswerIndex > idx) {
        state.currentAnswerIndex = Math.max(0, state.currentAnswerIndex - 1);
      }
      broadcast();
    }
  });
});

function handleMessage(clientId: string, message: C2S) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'register':
      client.role = message.role;
      client.name = message.name ?? null;
      if (message.role === 'buzzer' && message.name) {
        // Key scores by name so reconnects preserve score
        const key = message.name;
        if (!state.scores[key]) {
          state.scores[key] = { name: message.name, score: 0 };
        }
      }
      broadcast();
      break;

    case 'buzz':
      if (client.role === 'buzzer' && client.name) {
        if (!state.buzzerQueue.find(b => b.id === clientId)) {
          state.buzzerQueue.push({
            id: clientId,
            name: client.name,
            pressedAt: Date.now(),
          });
        }
        broadcast();
      }
      break;

    case 'next-question':
      if (isHost(clientId)) {
        state.currentQuestionIndex = Math.min(
          state.currentQuestionIndex + 1,
          questions.length - 1
        );
        state.showAnswer = false;
        state.buzzerQueue = [];
        state.currentAnswerIndex = 0;
        broadcast();
      }
      break;

    case 'prev-question':
      if (isHost(clientId)) {
        state.currentQuestionIndex = Math.max(state.currentQuestionIndex - 1, 0);
        state.showAnswer = false;
        state.buzzerQueue = [];
        state.currentAnswerIndex = 0;
        broadcast();
      }
      break;

    case 'toggle-answer':
      if (isHost(clientId)) {
        state.showAnswer = !state.showAnswer;
        broadcast();
      }
      break;

    case 'correct': {
      if (isHost(clientId) && state.buzzerQueue.length > 0) {
        const winner = state.buzzerQueue[state.currentAnswerIndex];
        if (winner) {
          const key = winner.name;
          if (!state.scores[key]) {
            state.scores[key] = { name: winner.name, score: 0 };
          }
          state.scores[key].score++;
        }
        broadcast();
      }
      break;
    }

    case 'wrong':
      if (isHost(clientId) && state.buzzerQueue.length > 0) {
        state.currentAnswerIndex = Math.min(
          state.currentAnswerIndex + 1,
          state.buzzerQueue.length
        );
        broadcast();
      }
      break;

    case 'undo-wrong':
      if (isHost(clientId)) {
        state.currentAnswerIndex = Math.max(state.currentAnswerIndex - 1, 0);
        broadcast();
      }
      break;

    case 'reset-buzzer':
      if (isHost(clientId)) {
        state.buzzerQueue = [];
        state.currentAnswerIndex = 0;
        broadcast();
      }
      break;
  }
}

const PORT = Number(process.env.PORT ?? 3001);
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n🎮 IT用語クイズ サーバー起動中');
  console.log(`\n  📡 ローカル: http://localhost:${PORT}`);
  console.log(`  📱 ネットワーク: http://${localIP}:${PORT}`);
  console.log(`\n  🎤 出題者画面: http://${localIP}:${PORT}/host`);
  console.log(`  📺 モニター画面: http://${localIP}:${PORT}/monitor`);
  console.log(`  🔔 早押しボタン: http://${localIP}:${PORT}/buzzer`);
  console.log('\n');
});
