import { useState, useEffect, useRef } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';

export default function BuzzerPage() {
  const { state, connected, myClientId, send } = useGameSocket();
  const [inputName, setInputName] = useState(
    () => localStorage.getItem('quiz-buzzer-name') ?? ''
  );
  const [registeredName, setRegisteredName] = useState<string | null>(
    () => localStorage.getItem('quiz-buzzer-name')
  );
  const prevQuestionRef = useRef<number>(-1);

  // Re-register on reconnect
  useEffect(() => {
    if (connected && registeredName) {
      send({ type: 'register', role: 'buzzer', name: registeredName });
    }
  }, [connected, registeredName, send]);

  // Vibrate on question change (mobile feedback)
  useEffect(() => {
    if (state && state.currentQuestionIndex !== prevQuestionRef.current) {
      prevQuestionRef.current = state.currentQuestionIndex;
      if ('vibrate' in navigator) navigator.vibrate(50);
    }
  }, [state?.currentQuestionIndex]);

  const handleRegister = () => {
    const name = inputName.trim();
    if (!name) return;
    localStorage.setItem('quiz-buzzer-name', name);
    setRegisteredName(name);
    send({ type: 'register', role: 'buzzer', name });
  };

  const handleLogout = () => {
    localStorage.removeItem('quiz-buzzer-name');
    setRegisteredName(null);
    setInputName('');
  };

  // Name input screen
  if (!registeredName) {
    return (
      <div className="buzzer-login">
        <h1>IT用語クイズ</h1>
        <h2>早押しボタン</h2>
        <div className="login-form">
          <input
            className="name-input"
            type="text"
            placeholder="名前を入力してください"
            value={inputName}
            maxLength={20}
            onChange={e => setInputName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            autoFocus
          />
          <button
            className="join-btn"
            onClick={handleRegister}
            disabled={!inputName.trim()}
          >
            参加する
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return <div className="loading">接続中...</div>;
  }

  const myPosition = state.buzzerQueue.findIndex(b => b.id === myClientId);
  const hasPressed = myPosition !== -1;
  const hasAnswerRight = hasPressed && myPosition === state.currentAnswerIndex;
  const myScore = state.scores[registeredName]?.score ?? 0;

  const handleBuzz = () => {
    if (!hasPressed) {
      send({ type: 'buzz' });
      if ('vibrate' in navigator) navigator.vibrate([100, 30, 100]);
    }
  };

  return (
    <div className={`buzzer-page ${hasAnswerRight ? 'has-right-bg' : ''}`}>
      {/* Top bar */}
      <div className="buzzer-topbar">
        <span className="buzzer-myname">{registeredName}</span>
        <span className="buzzer-myscore">{myScore}点</span>
        <button className="logout-btn" onClick={handleLogout}>退出</button>
      </div>

      {/* Answer right banner */}
      {hasAnswerRight && (
        <div className="answer-right-banner">
          回答権あり！
        </div>
      )}

      {/* Buzzer button */}
      <div className="buzzer-center">
        <button
          className={`buzzer-btn ${hasPressed ? 'pressed' : 'ready'} ${!connected ? 'disconnected' : ''}`}
          onClick={handleBuzz}
          disabled={hasPressed || !connected}
        >
          {!connected ? '接続中...' : hasPressed ? `${myPosition + 1}位` : '早押し！'}
        </button>
      </div>

      {/* Press order list */}
      {state.buzzerQueue.length > 0 && (
        <div className="buzzer-order-list">
          {state.buzzerQueue.map((entry, idx) => (
            <div
              key={entry.id}
              className={`buzzer-order-entry ${
                entry.id === myClientId ? 'me' : ''
              } ${idx === state.currentAnswerIndex ? 'has-right' : ''} ${
                idx < state.currentAnswerIndex ? 'passed' : ''
              }`}
            >
              <span className="order-rank">{idx + 1}位</span>
              <span className="order-name">{entry.name}</span>
              {idx === state.currentAnswerIndex && (
                <span className="order-badge">回答権</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mini scoreboard */}
      {Object.keys(state.scores).length > 0 && (
        <div className="buzzer-scores">
          {Object.entries(state.scores)
            .sort(([, a], [, b]) => b.score - a.score)
            .map(([key, { name, score }]) => (
              <span
                key={key}
                className={`buzzer-score-item ${key === registeredName ? 'me' : ''}`}
              >
                {name}: {score}点
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
