import { useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { CHOICE_LABELS } from '../types';

export default function HostPage() {
  const { state, questions, totalQuestions, playerCount, players, connected, send } = useGameSocket();

  useEffect(() => {
    if (connected) {
      send({ type: 'register', role: 'host' });
    }
  }, [connected, send]);

  if (!state || questions.length === 0) {
    return <div className="loading">サーバーに接続中...</div>;
  }

  // 待機画面：ゲーム開始前
  if (state.phase === 'waiting') {
    return (
      <div className="host-layout">
        <header className="host-header">
          <div className="header-left">
            <span className="q-counter">IT用語クイズ</span>
          </div>
          <div className="header-right">
            <span className="player-count-badge">参加 {playerCount}人</span>
            <div className={`conn-status ${connected ? 'online' : 'offline'}`}>
              {connected ? '● 接続中' : '○ 切断'}
            </div>
          </div>
        </header>
        <div className="host-start-screen">
          <div className="start-player-list">
            {players.length === 0
              ? <span className="empty-msg">参加者を待っています...</span>
              : players.map((p, i) => (
                  <span key={i} className="start-player-chip">{p.name}</span>
                ))
            }
          </div>
          <button
            className="start-game-btn"
            onClick={() => send({ type: 'start-game' })}
          >
            ゲームを開始
          </button>
        </div>
      </div>
    );
  }

  const question = questions[state.currentQuestionIndex];
  const submissions = Object.values(state.submissions).sort((a, b) => a.submittedAt - b.submittedAt);
  const textSubs = submissions.filter(s => s.answerMode === 'text');
  const choiceSubs = submissions.filter(s => s.answerMode === 'choice');

  return (
    <div className="host-layout">
      <header className="host-header">
        <div className="header-left">
          <span className="q-counter">第 {state.currentQuestionIndex + 1} 問 / {totalQuestions}問</span>
        </div>
        <div className="header-nav">
          <button
            className="nav-btn"
            onClick={() => send({ type: 'prev-question' })}
            disabled={state.currentQuestionIndex === 0}
          >
            ← 前
          </button>
          <button
            className="nav-btn"
            onClick={() => send({ type: 'next-question' })}
            disabled={state.currentQuestionIndex === totalQuestions - 1}
          >
            次 →
          </button>
        </div>
        <div className="header-right">
          <span className="player-count-badge">参加 {playerCount}人</span>
          <div className={`conn-status ${connected ? 'online' : 'offline'}`}>
            {connected ? '● 接続中' : '○ 切断'}
          </div>
        </div>
      </header>

      <div className="host-body">
        <main className="host-main">
          {/* Question card: explanation = problem, term = answer */}
          <div className="question-card">
            <div className="category-tag">{question.category}</div>
            <div className="question-body-display">{question.explanation}</div>
            {state.showAnswer
              ? <div className="answer-term-display">{question.term}</div>
              : <div className="explanation-hidden">（答えは非表示）</div>
            }
            <div className="contributor-label">出題者: {question.contributor}</div>
            <div className="host-question-actions">
              <button
                className={`toggle-answer-btn ${state.showAnswer ? 'hide-mode' : 'show-mode'}`}
                onClick={() => send({ type: 'toggle-answer' })}
              >
                {state.showAnswer ? '答えを隠す' : '答えを表示'}
              </button>
              {state.phase === 'answering' && (
                <button
                  className="end-answering-btn"
                  onClick={() => send({ type: 'end-answering' })}
                >
                  回答終了
                </button>
              )}
            </div>
          </div>

          {/* Phase status */}
          <div className={`phase-badge ${state.phase}`}>
            {state.phase === 'answering'
              ? `回答受付中 — ${submissions.length} / ${playerCount}人 回答済み`
              : state.phase === 'reviewing'
              ? '採点フェーズ'
              : '待機中'}
          </div>

          {/* Answering: submitted names */}
          {state.phase === 'answering' && submissions.length > 0 && (
            <div className="submitted-names-card">
              <div className="submitted-names">
                {submissions.map(s => (
                  <span key={s.clientId} className="submitted-name-tag">{s.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Reviewing: mark answers */}
          {state.phase === 'reviewing' && (
            <div className="review-section">
              {textSubs.length > 0 && (
                <div className="review-group">
                  <div className="review-group-header">
                    テキスト回答
                    <span className="pts-badge">正解 +3点</span>
                  </div>
                  {textSubs.map(sub => (
                    <div key={sub.clientId} className={`review-row ${sub.result ?? 'pending'}`}>
                      <span className="review-name">{sub.name}</span>
                      <span className="review-answer">{sub.answer}</span>
                      <div className="review-btns">
                        {sub.result === 'correct' && (
                          <span className="auto-graded-badge">自動◯</span>
                        )}
                        <button
                          className={`mark-btn correct-mark ${sub.result === 'correct' ? 'active' : ''}`}
                          onClick={() => send({ type: 'mark-answer', submissionClientId: sub.clientId, result: 'correct' })}
                        >◯</button>
                        <button
                          className={`mark-btn wrong-mark ${sub.result === 'wrong' ? 'active' : ''}`}
                          onClick={() => send({ type: 'mark-answer', submissionClientId: sub.clientId, result: 'wrong' })}
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {choiceSubs.length > 0 && (
                <div className="review-group">
                  <div className="review-group-header">
                    4択回答
                    <span className="pts-badge">正解 +1点（自動採点済み）</span>
                  </div>
                  {choiceSubs.map(sub => (
                    <div key={sub.clientId} className={`review-row ${sub.result ?? ''}`}>
                      <span className="review-name">{sub.name}</span>
                      <span className="review-answer">
                        {sub.choiceIndex !== undefined ? CHOICE_LABELS[sub.choiceIndex] : '?'}. {sub.answer}
                      </span>
                      <span className={`auto-result ${sub.result}`}>
                        {sub.result === 'correct' ? '◯' : '×'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {submissions.length === 0 && (
                <p className="empty-msg">この問題の回答者はいませんでした</p>
              )}
            </div>
          )}
        </main>

        <aside className="host-sidebar">
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
