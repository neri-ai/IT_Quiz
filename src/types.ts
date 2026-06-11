export interface Question {
  id: number;
  category: string;
  term: string;
  explanation: string;
  contributor: string;
  answers?: string[];
  /** 問題に4択の選択肢を直接定義する場合に指定 */
  choices?: [string, string, string, string];
  /** choices と併用。正解の選択肢インデックス (0-3) */
  correctChoiceIndex?: number;
}

export interface Submission {
  clientId: string;
  name: string;
  answerMode: 'text' | 'choice';
  answer: string;
  choiceIndex?: number;
  submittedAt: number;
  result?: 'correct' | 'wrong';
}

export interface GameState {
  currentQuestionIndex: number;
  showAnswer: boolean;
  phase: 'answering' | 'reviewing';
  submissions: Record<string, Submission>;
  scores: Record<string, { name: string; score: number }>;
  choices: [string, string, string, string];
}

export type ClientRole = 'host' | 'monitor' | 'player';

export const CHOICE_LABELS = ['A', 'B', 'C', 'D'] as const;

export type ClientMessage =
  | { type: 'register'; role: ClientRole; name?: string }
  | { type: 'submit-answer'; answer: string; answerMode: 'text' | 'choice'; choiceIndex?: number }
  | { type: 'next-question' }
  | { type: 'prev-question' }
  | { type: 'toggle-answer' }
  | { type: 'end-answering' }
  | { type: 'mark-answer'; submissionClientId: string; result: 'correct' | 'wrong' };
