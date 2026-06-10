import { useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';

export default function HostPage() {
  const { state, questions, totalQuestions, connected, send } = useGameSocket();

  useEffect(() => {
    if (connected) {
      send({ type: 'register', role: 'host' });
    }
  }, [connected, send]);

  if (!state || questions.length === 0) {
    return <div className="loading">サーバーに接続中...</div>;
  }

  const question = questions[state.currentQuestionIndex];
  const currentAnswerer = state.currentAnswerIndex < state.buzzerQueue.length
    ? state.buzzerQueue[state.currentAnswerIndex]
    : null;

  return (
    <div className="host-layout">
      {/* Header */}
      <header className="host-header">
        <div className="header-left">
          <span className="q-counter">
            第 {state.currentQuestionIndex + 1} 問 / {totalQuestions}問
          </span>
        </div>
        <div className="header-nav">
          <button
            className="nav-btn"
            onClick={() => send({ type: 'prev-question' })}
            disabled={state.currentQuestionIndex === 0}
          >
            ← 前の問題
          </button>
          <button
            className="nav-btn"
            onClick={() => send({ type: 'next-question' })}
            disabled={state.currentQuestionIndex === totalQuestions - 1}
          >
            次の問題 →
          </button>
        </div>
        <div className={`conn-status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● 接続中' : '○ 切断'}
        </div>
      </header>

      <div className="host-body">
        {/* Question Card */}
        <main className="host-main">
          <div className="question-card host-question">
            <div className="category-tag">{question.category}</div>
            <div className="term-display">{question.term}</div>
            {state.showAnswer ? (
              <div className="explanation-display">{question.explanation}</div>
            ) : (
              <div className="explanation-hidden">（答えを隠しています）</div>
            )}
            <div className="contributor-label">出題者: {question.contributor}</div>
            <button
              className={`toggle-answer-btn ${state.showAnswer ? 'hide-mode' : 'show-mode'}`}
              onClick={() => send({ type: 'toggle-answer' })}
            >
              {state.showAnswer ? '答えを隠す' : '答えを表示する'}
            </button>
          </div>

          {/* Answer Right Controls */}
          <div className="answer-controls-card">
            <div className="answer-controls-header">
              <span>回答権</span>
              {currentAnswerer ? (
                <span className="current-answerer">{currentAnswerer.name}</span>
              ) : (
                <span className="no-answerer">
                  {state.buzzerQueue.length === 0 ? '（早押し待ち）' : '（全員終了）'}
                </span>
              )}
            </div>
            <div className="answer-buttons">
              <button
                className="undo-btn"
                onClick={() => send({ type: 'undo-wrong' })}
                disabled={state.currentAnswerIndex === 0}
                title="前の人に回答権を戻す"
              >
                ↩ 戻す
              </button>
              <button
                className="correct-btn"
                onClick={() => send({ type: 'correct' })}
                disabled={!currentAnswerer}
              >
                ◯ 正解
              </button>
              <button
                className="wrong-btn"
                onClick={() => send({ type: 'wrong' })}
                disabled={state.buzzerQueue.length === 0 || !currentAnswerer}
              >
                × 不正解
              </button>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="host-sidebar">
          {/* Buzzer Queue */}
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <h3>早押し状況</h3>
              <button
                className="reset-buzzer-btn"
                onClick={() => send({ type: 'reset-buzzer' })}
              >
                リセット
              </button>
            </div>
            {state.buzzerQueue.length === 0 ? (
              <p className="empty-msg">まだ誰も押していません</p>
            ) : (
              <div className="buzzer-queue">
                {state.buzzerQueue.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`buzzer-entry ${
                      idx === state.currentAnswerIndex ? 'has-right' : ''
                    } ${idx < state.currentAnswerIndex ? 'passed' : ''}`}
                  >
                    <span className="entry-rank">{idx + 1}</span>
                    <span className="entry-name">{entry.name}</span>
                    {idx === state.currentAnswerIndex && (
                      <span className="right-badge">回答権</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Score Board */}
          <div className="sidebar-card">
            <h3>スコア</h3>
            {Object.keys(state.scores).length === 0 ? (
              <p className="empty-msg">まだ得点なし</p>
            ) : (
              <div className="score-list">
                {Object.entries(state.scores)
                  .sort(([, a], [, b]) => b.score - a.score)
                  .map(([key, { name, score }]) => (
                    <div key={key} className="score-row">
                      <span className="score-name">{name}</span>
                      <span className="score-pts">{score}点</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
