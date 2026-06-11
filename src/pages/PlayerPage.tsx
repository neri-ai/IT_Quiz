import { useState, useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { CHOICE_LABELS } from '../types';

export default function PlayerPage() {
  const { state, questions, players, playerCount, connected, myClientId, send } = useGameSocket();

  const [name, setName] = useState(() => localStorage.getItem('player-name') ?? '');
  const [joined, setJoined] = useState(false);
  // セッション内のみ有効。テキスト→4択の一方通行（localStorage には保存しない）
  const [answerMode, setAnswerMode] = useState<'text' | 'choice'>('text');
  const [textInput, setTextInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  // 問題側に choices が定義されていれば強制4択（プレイヤーのモード設定を上書き）
  const currentQuestion = state && questions.length > 0 ? questions[state.currentQuestionIndex] : null;
  const isForced4Choice = !!currentQuestion?.choices;
  const effectiveMode: 'text' | 'choice' = isForced4Choice ? 'choice' : answerMode;

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
    setName(trimmed);
    setJoined(true);
  };

  const handleConfirmSwitch = () => {
    setAnswerMode('choice');
    setConfirmSwitch(false);
    setTextInput('');
    setSelectedChoice(null);
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (!state || state.phase !== 'answering') return;
    if (effectiveMode === 'text') {
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

  if (!state || !currentQuestion) {
    return <div className="loading">サーバーに接続中...</div>;
  }

  // 待機画面：ホストがゲームを開始するまで
  if (state.phase === 'waiting') {
    return (
      <div className="player-page">
        <div className="player-topbar">
          <span className="player-myname">{name}</span>
          <span className={`conn-dot ${connected ? 'online' : 'offline'}`} />
          <button className="logout-btn" onClick={() => { setJoined(false); setAnswerMode('text'); }}>退出</button>
        </div>
        <div className="player-waiting">
          <div className="waiting-title">IT用語クイズ</div>
          <div className="waiting-message">ゲーム開始をお待ちください</div>
          <div className="waiting-player-count">{playerCount}人 が参加中</div>
          <div className="waiting-player-list">
            {players.map((p, i) => (
              <span key={i} className={`waiting-player-name ${p.name === name ? 'me' : ''}`}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const question = currentQuestion;
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
        {!isForced4Choice && answerMode === 'text' && state.phase === 'answering' && (
          <button className="switch-mode-btn" onClick={() => setConfirmSwitch(true)}>
            4択に変更
          </button>
        )}
        {effectiveMode === 'choice' && (
          <span className="mode-badge">{isForced4Choice ? '4択問題' : '4択モード'}</span>
        )}
        <button className="logout-btn" onClick={() => { setJoined(false); setSubmitted(false); setAnswerMode('text'); }}>
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

      {/* Question: show explanation as the problem */}
      <div className="player-question">
        <div className="player-q-number">第 {state.currentQuestionIndex + 1} 問 — {question.category}</div>
        <div className="player-question-body">{question.explanation}</div>
      </div>

      {/* Answering phase */}
      {state.phase === 'answering' && (
        <div className="player-answer-area">
          {effectiveMode === 'text' ? (
            <>
              <input
                className="text-answer-input"
                type="text"
                placeholder="IT用語名を入力してください..."
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && textInput.trim()) {
                    handleSubmit();
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
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
              <div className="answer-reveal-label">正解</div>
              <div className="answer-reveal-text">{question.term}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
