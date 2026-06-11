import { useState, useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { CHOICE_LABELS } from '../types';

export default function PlayerPage() {
  const { state, questions, connected, myClientId, send } = useGameSocket();

  const [name, setName] = useState(() => localStorage.getItem('player-name') ?? '');
  const [joined, setJoined] = useState(false);
  const [answerMode, setAnswerMode] = useState<'text' | 'choice'>(
    () => (localStorage.getItem('player-answer-mode') as 'text' | 'choice') ?? 'text'
  );
  const [textInput, setTextInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  useEffect(() => {
    if (connected && joined) {
      send({ type: 'register', role: 'player', name });
    }
  }, [connected, joined, send, name]);

  // Reset answer state when question changes
  useEffect(() => {
    setTextInput('');
    setSelectedChoice(null);
    setSubmitted(false);
  }, [state?.currentQuestionIndex]);

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('player-name', trimmed);
    setJoined(true);
  };

  const handleConfirmSwitch = () => {
    setAnswerMode('choice');
    localStorage.setItem('player-answer-mode', 'choice');
    setConfirmSwitch(false);
    setTextInput('');
    setSelectedChoice(null);
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (!state || state.phase !== 'answering') return;
    if (answerMode === 'text') {
      if (!textInput.trim()) return;
      send({ type: 'submit-answer', answer: textInput.trim(), answerMode: 'text' });
    } else {
      if (selectedChoice === null) return;
      send({
        type: 'submit-answer',
        answer: state.choices[selectedChoice],
        answerMode: 'choice',
        choiceIndex: selectedChoice,
      });
    }
    setSubmitted(true);
  };

  if (!joined) {
    return (
      <div className="player-login">
        <h1>IT用語クイズ</h1>
        <h2>参加者ログイン</h2>
        <div className="login-form">
          <input
            className="name-input"
            type="text"
            placeholder="あなたの名前を入力"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          <button className="join-btn" onClick={handleJoin} disabled={!name.trim()}>
            参加する
          </button>
        </div>
      </div>
    );
  }

  if (!state || questions.length === 0) {
    return <div className="loading">サーバーに接続中...</div>;
  }

  const question = questions[state.currentQuestionIndex];
  const mySubmission = myClientId ? state.submissions[myClientId] : null;
  const myScore = state.scores[name]?.score ?? 0;
  const submittedCount = Object.keys(state.submissions).length;

  return (
    <div className="player-page">
      {/* Top bar */}
      <div className="player-topbar">
        <span className="player-myname">{name}</span>
        <span className="player-myscore">{myScore}点</span>
        <span className={`conn-dot ${connected ? 'online' : 'offline'}`} />
        {answerMode === 'text' && state.phase === 'answering' && (
          <button className="switch-mode-btn" onClick={() => setConfirmSwitch(true)}>
            4択に変更
          </button>
        )}
        {answerMode === 'choice' && (
          <span className="mode-badge">4択モード</span>
        )}
        <button className="logout-btn" onClick={() => { setJoined(false); setSubmitted(false); }}>
          退出
        </button>
      </div>

      {/* Confirm switch modal */}
      {confirmSwitch && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <p className="confirm-title">4択モードに変更しますか？</p>
            <p className="confirm-body">一度4択モードに変更すると、テキスト入力に戻すことはできません。</p>
            <div className="confirm-btns">
              <button className="confirm-cancel" onClick={() => setConfirmSwitch(false)}>キャンセル</button>
              <button className="confirm-ok" onClick={handleConfirmSwitch}>変更する</button>
            </div>
          </div>
        </div>
      )}

      {/* Question */}
      <div className="player-question">
        <div className="player-q-number">第 {state.currentQuestionIndex + 1} 問</div>
        <div className="player-term">{question.term}</div>
        <div className="player-category-tag">{question.category}</div>
      </div>

      {/* Answering phase */}
      {state.phase === 'answering' && (
        <div className="player-answer-area">
          {answerMode === 'text' ? (
            <>
              <textarea
                className="text-answer-input"
                placeholder="この用語の意味や説明を入力してください..."
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                rows={4}
              />
              <div className="player-submit-row">
                <button
                  className="submit-answer-btn"
                  onClick={handleSubmit}
                  disabled={!textInput.trim()}
                >
                  {submitted ? '再送信' : '送信'}
                </button>
                {submitted && <span className="submitted-label">✓ 回答済み</span>}
              </div>
            </>
          ) : (
            <>
              <div className="choice-grid">
                {state.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    className={`choice-btn ${selectedChoice === idx ? 'selected' : ''}`}
                    onClick={() => setSelectedChoice(idx)}
                  >
                    <span className="choice-label">{CHOICE_LABELS[idx]}</span>
                    <span className="choice-text">{choice}</span>
                  </button>
                ))}
              </div>
              <div className="player-submit-row">
                <button
                  className="submit-answer-btn"
                  onClick={handleSubmit}
                  disabled={selectedChoice === null}
                >
                  {submitted ? '再送信' : '送信'}
                </button>
                {submitted && <span className="submitted-label">✓ 回答済み</span>}
              </div>
            </>
          )}
          <div className="answer-count-hint">{submittedCount}人が回答済み</div>
        </div>
      )}

      {/* Reviewing phase */}
      {state.phase === 'reviewing' && (
        <div className="player-review">
          {mySubmission ? (
            <div className={`my-submission ${mySubmission.result ?? 'pending'}`}>
              <div className="my-answer-label">あなたの回答</div>
              <div className="my-answer-text">
                {mySubmission.answerMode === 'choice' && mySubmission.choiceIndex !== undefined
                  ? `${CHOICE_LABELS[mySubmission.choiceIndex]}. ${mySubmission.answer}`
                  : mySubmission.answer}
              </div>
              {mySubmission.result === 'correct' && (
                <div className="result-icon correct">
                  ◯ 正解！
                  <span className="pts-earned">+{mySubmission.answerMode === 'text' ? 3 : 1}点</span>
                </div>
              )}
              {mySubmission.result === 'wrong' && (
                <div className="result-icon wrong">× 不正解</div>
              )}
              {!mySubmission.result && (
                <div className="result-icon pending">採点中...</div>
              )}
            </div>
          ) : (
            <div className="no-submission">回答がありませんでした</div>
          )}
          {state.showAnswer && (
            <div className="answer-reveal">
              <div className="answer-reveal-label">解説</div>
              <div className="answer-reveal-text">{question.explanation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
