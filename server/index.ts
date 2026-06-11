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
  answers?: string[];
  choices?: [string, string, string, string];
  correctChoiceIndex?: number;
}

interface Submission {
  clientId: string;
  name: string;
  answerMode: 'text' | 'choice';
  answer: string;
  choiceIndex?: number;
  submittedAt: number;
  result?: 'correct' | 'wrong';
}

interface GameState {
  currentQuestionIndex: number;
  showAnswer: boolean;
  phase: 'answering' | 'reviewing';
  submissions: Record<string, Submission>;
  scores: Record<string, { name: string; score: number }>;
  choices: [string, string, string, string];
}

type ClientRole = 'host' | 'monitor' | 'player';

interface Client {
  ws: WebSocket;
  id: string;
  role: ClientRole | null;
  name: string | null;
}

type C2S =
  | { type: 'register'; role: ClientRole; name?: string }
  | { type: 'submit-answer'; answer: string; answerMode: 'text' | 'choice'; choiceIndex?: number }
  | { type: 'next-question' }
  | { type: 'prev-question' }
  | { type: 'toggle-answer' }
  | { type: 'end-answering' }
  | { type: 'mark-answer'; submissionClientId: string; result: 'correct' | 'wrong' };

const questionsPath = join(__dirname, '../public/questions.json');
const questions: Question[] = JSON.parse(readFileSync(questionsPath, 'utf-8'));

function generateChoices(qIdx: number): [string, string, string, string] {
  const q = questions[qIdx];
  // Use explicitly defined choices if provided
  if (q.choices) return q.choices;

  const total = questions.length;
  const correctTerm = q.term;

  // Pick 3 distinct distractors deterministically based on qIdx
  const usedIdxs = new Set([qIdx]);
  const distractorIdxs: number[] = [];

  const steps = [
    Math.max(1, Math.floor(total / 4)),
    Math.max(1, Math.floor(total / 2)),
    Math.max(1, Math.floor(3 * total / 4)),
  ];

  for (const step of steps) {
    let idx = (qIdx + step) % total;
    while (usedIdxs.has(idx)) {
      idx = (idx + 1) % total;
    }
    usedIdxs.add(idx);
    distractorIdxs.push(idx);
  }

  const distractors = distractorIdxs.map(i => questions[i].term);

  // Correct answer placed at position (qIdx % 4) so it rotates A→B→C→D
  const correctPos = qIdx % 4;
  const choices: string[] = [];
  let d = 0;
  for (let i = 0; i < 4; i++) {
    choices.push(i === correctPos ? correctTerm : distractors[d++]);
  }

  return choices as [string, string, string, string];
}

function getCorrectChoiceIndex(qIdx: number): number {
  const q = questions[qIdx];
  if (q.correctChoiceIndex !== undefined) return q.correctChoiceIndex;
  return qIdx % 4;
}

/** 大文字小文字・全角半角・余分な空白を正規化して比較用文字列を返す */
function normalizeText(s: string): string {
  return s
    .trim()
    // 全角英数字 → 半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // 全角スペース → 半角
    .replace(/　/g, ' ')
    // 連続スペースを1つに
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** テキスト回答が正解かどうかを判定（term + answers[] すべてと照合） */
function isTextAnswerCorrect(submitted: string, q: Question): boolean {
  const norm = normalizeText(submitted);
  const accepted = [q.term, ...(q.answers ?? [])];
  return accepted.some(a => normalizeText(a) === norm);
}

const clients = new Map<string, Client>();

const state: GameState = {
  currentQuestionIndex: 0,
  showAnswer: false,
  phase: 'answering',
  submissions: {},
  scores: {},
  choices: generateChoices(0),
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function isHost(clientId: string): boolean {
  return clients.get(clientId)?.role === 'host';
}

function getPlayerCount(): number {
  let count = 0;
  for (const client of clients.values()) {
    if (client.role === 'player') count++;
  }
  return count;
}

function broadcast() {
  const message = JSON.stringify({
    type: 'state-update',
    state,
    questions,
    totalQuestions: questions.length,
    playerCount: getPlayerCount(),
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

const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*path', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.get('/api/network', (_req, res) => {
  res.json({ localIP: getLocalIP(), port: PORT });
});

wss.on('connection', (ws) => {
  const clientId = generateId();
  const client: Client = { ws, id: clientId, role: null, name: null };
  clients.set(clientId, client);

  ws.send(JSON.stringify({ type: 'hello', clientId }));
  ws.send(JSON.stringify({
    type: 'state-update',
    state,
    questions,
    totalQuestions: questions.length,
    playerCount: getPlayerCount(),
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
    broadcast();
  });
});

function handleMessage(clientId: string, message: C2S) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'register':
      client.role = message.role;
      client.name = message.name ?? null;
      if (message.role === 'player' && message.name) {
        const key = message.name;
        if (!state.scores[key]) {
          state.scores[key] = { name: message.name, score: 0 };
        }
      }
      broadcast();
      break;

    case 'submit-answer':
      if (client.role === 'player' && client.name && state.phase === 'answering') {
        state.submissions[clientId] = {
          clientId,
          name: client.name,
          answerMode: message.answerMode,
          answer: message.answer,
          choiceIndex: message.choiceIndex,
          submittedAt: Date.now(),
        };
        broadcast();
      }
      break;

    case 'end-answering':
      if (isHost(clientId) && state.phase === 'answering') {
        state.phase = 'reviewing';
        const correctIdx = getCorrectChoiceIndex(state.currentQuestionIndex);
        const q = questions[state.currentQuestionIndex];
        for (const sub of Object.values(state.submissions)) {
          if (sub.answerMode === 'choice') {
            // 4択：自動採点 +1点
            sub.result = sub.choiceIndex === correctIdx ? 'correct' : 'wrong';
            if (sub.result === 'correct') {
              const key = sub.name;
              if (!state.scores[key]) state.scores[key] = { name: sub.name, score: 0 };
              state.scores[key].score += 1;
            }
          } else {
            // テキスト：term + answers[] と正規化照合して自動採点 +3点
            // マッチしなければ pending のまま → ホストが手動で ○/× を付ける
            if (isTextAnswerCorrect(sub.answer, q)) {
              sub.result = 'correct';
              const key = sub.name;
              if (!state.scores[key]) state.scores[key] = { name: sub.name, score: 0 };
              state.scores[key].score += 3;
            }
          }
        }
        broadcast();
      }
      break;

    case 'mark-answer': {
      if (isHost(clientId)) {
        const sub = state.submissions[message.submissionClientId];
        if (sub && sub.answerMode === 'text') {
          const prev = sub.result;
          sub.result = message.result;
          const key = sub.name;
          if (!state.scores[key]) state.scores[key] = { name: sub.name, score: 0 };
          if (message.result === 'correct' && prev !== 'correct') {
            state.scores[key].score += 3;
          } else if (message.result === 'wrong' && prev === 'correct') {
            state.scores[key].score = Math.max(0, state.scores[key].score - 3);
          }
          broadcast();
        }
      }
      break;
    }

    case 'next-question':
      if (isHost(clientId)) {
        state.currentQuestionIndex = Math.min(
          state.currentQuestionIndex + 1,
          questions.length - 1
        );
        state.showAnswer = false;
        state.phase = 'answering';
        state.submissions = {};
        state.choices = generateChoices(state.currentQuestionIndex);
        broadcast();
      }
      break;

    case 'prev-question':
      if (isHost(clientId)) {
        state.currentQuestionIndex = Math.max(state.currentQuestionIndex - 1, 0);
        state.showAnswer = false;
        state.phase = 'answering';
        state.submissions = {};
        state.choices = generateChoices(state.currentQuestionIndex);
        broadcast();
      }
      break;

    case 'toggle-answer':
      if (isHost(clientId)) {
        state.showAnswer = !state.showAnswer;
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
  console.log(`  ✏️  回答画面: http://${localIP}:${PORT}/player`);
  console.log('\n');
});
