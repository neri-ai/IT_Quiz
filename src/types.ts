export interface Question {
  id: number;
  category: string;
  term: string;
  explanation: string;
  contributor: string;
}

export interface BuzzerEntry {
  id: string;
  name: string;
  pressedAt: number;
}

export interface GameState {
  currentQuestionIndex: number;
  showAnswer: boolean;
  buzzerQueue: BuzzerEntry[];
  currentAnswerIndex: number;
  scores: Record<string, { name: string; score: number }>;
}

export type ClientRole = 'host' | 'monitor' | 'buzzer';

export type ClientMessage =
  | { type: 'register'; role: ClientRole; name?: string }
  | { type: 'buzz' }
  | { type: 'next-question' }
  | { type: 'prev-question' }
  | { type: 'toggle-answer' }
  | { type: 'correct' }
  | { type: 'wrong' }
  | { type: 'undo-wrong' }
  | { type: 'reset-buzzer' };
