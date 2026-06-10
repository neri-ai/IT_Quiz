import { useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';

export default function MonitorPage() {
  const { state, questions, totalQuestions, connected, send } = useGameSocket();

  useEffect(() => {
    if (connected) {
      send({ type: 'register', role: 'monitor' });
    }
  }, [connected, send]);

  if (!state || questions.length === 0) {
    return <div className="loading">接続中...</div>;
  }

  const question = questions[state.currentQuestionIndex];
  const currentAnswerer = state.currentAnswerIndex < state.buzzerQueue.length
    ? state.buzzerQueue[state.currentAnswerIndex]
    : null;

  return (
    <div className="monitor-layout">
      {/* Question Number */}
      <div className="monitor-counter">
        第 {state.currentQuestionIndex + 1} 問 / {totalQuestions}問
        <span className="monitor-category">{question.category}</span>
      </div>

      {/* Current Answer Right Highlight */}
      {currentAnswerer && (
        <div className="monitor-answerer-banner">
          <span className="answerer-label">回答権</span>
          <span className="answerer-name">{currentAnswerer.name}</span>
        </div>
      )}

      {/* Question Display */}
      <div className="monitor-question">
        <div className="monitor-term">{question.term}</div>
        {state.showAnswer && (
          <div className="monitor-explanation">{question.explanation}</div>
        )}
      </div>

      {/* Buzzer Queue */}
      {state.buzzerQueue.length > 0 && (
        <div className="monitor-buzzer-list">
          {state.buzzerQueue.map((entry, idx) => (
            <div
              key={entry.id}
              className={`monitor-buzzer-entry ${
                idx === state.currentAnswerIndex ? 'has-right' : ''
              } ${idx < state.currentAnswerIndex ? 'passed' : ''}`}
            >
              <span className="mb-rank">{idx + 1}位</span>
              <span className="mb-name">{entry.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Score Board */}
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
