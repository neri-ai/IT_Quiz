import { useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { CHOICE_LABELS } from '../types';

export default function MonitorPage() {
  const { state, questions, totalQuestions, playerCount, players, connected, send } = useGameSocket();

  useEffect(() => {
    if (connected) {
      send({ type: 'register', role: 'monitor' });
    }
  }, [connected, send]);

  if (!state || questions.length === 0) {
    return <div className="loading">接続中...</div>;
  }

  // 待機画面
  if (state.phase === 'waiting') {
    return (
      <div className="monitor-waiting">
        <div className="monitor-waiting-title">IT用語クイズ</div>
        <div className="monitor-waiting-subtitle">開始をお待ちください</div>
        {players.length > 0 && (
          <div className="monitor-waiting-players">
            <div className="monitor-waiting-label">参加者 {playerCount}人</div>
            <div className="monitor-waiting-names">
              {players.map((p, i) => (
                <div key={i} className="monitor-waiting-name">{p.name}</div>
              ))}
            </div>
          </div>
        )}
        {!connected && (
          <div className="monitor-disconnected">接続が切れました。再接続中...</div>
        )}
      </div>
    );
  }

  const question = questions[state.currentQuestionIndex];
  const submissions = Object.values(state.submissions).sort((a, b) => a.submittedAt - b.submittedAt);

  return (
    <div className="monitor-layout">
      {/* Header */}
      <div className="monitor-counter">
        第 {state.currentQuestionIndex + 1} 問 / {totalQuestions}問
        <span className="monitor-category">{question.category}</span>
        <span className={`monitor-phase-badge ${state.phase}`}>
          {state.phase === 'answering' ? '回答中' : '採点中'}
        </span>
      </div>

      {/* Question: explanation shown as problem, term revealed as answer */}
      <div className="monitor-question">
        <div className="monitor-question-body">{question.explanation}</div>
        {state.showAnswer && (
          <div className="monitor-answer-term">{question.term}</div>
        )}
      </div>

      {/* Answering: who submitted (not what) */}
      {state.phase === 'answering' && (
        <div className="monitor-answering-status">
          <div className="monitor-answered-count">
            {submissions.length} / {playerCount}人 回答済み
          </div>
          {submissions.length > 0 && (
            <div className="monitor-answered-names">
              {submissions.map(s => (
                <span key={s.clientId} className="monitor-answered-name">
                  {s.name} ✓
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reviewing: show all answers with results */}
      {state.phase === 'reviewing' && submissions.length > 0 && (
        <div className="monitor-review-list">
          {submissions.map(sub => (
            <div
              key={sub.clientId}
              className={`monitor-review-row ${sub.result ?? 'pending'}`}
            >
              <span className="monitor-review-result">
                {sub.result === 'correct' && '◯'}
                {sub.result === 'wrong' && '×'}
                {!sub.result && '…'}
              </span>
              <span className="monitor-review-name">{sub.name}</span>
              <span className={`monitor-review-mode ${sub.answerMode}`}>
                {sub.answerMode === 'text' ? 'テキスト' : '4択'}
              </span>
              <span className="monitor-review-answer">
                {sub.answerMode === 'choice' && sub.choiceIndex !== undefined
                  ? `${CHOICE_LABELS[sub.choiceIndex]}. ${sub.answer}`
                  : sub.answer}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scoreboard */}
      {Object.keys(state.scores).length > 0 && (
        <div className="monitor-scoreboard">
          {Object.entries(state.scores)
            .sort(([, a], [, b]) => b.score - a.score)
            .map(([key, { name, score }]) => (
              <div key={key} className="monitor-score-row">
                <span>{name}</span>
                <span className="monitor-score-pts">{score}点</span>
              </div>
            ))}
        </div>
      )}

      {!connected && (
        <div className="monitor-disconnected">接続が切れました。再接続中...</div>
      )}
    </div>
  );
}
