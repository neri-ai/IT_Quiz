import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const [networkIP, setNetworkIP] = useState<string>('');
  const [port, setPort] = useState<string>('3001');

  useEffect(() => {
    fetch('/api/network')
      .then(r => r.json())
      .then((d: { localIP: string; port: number }) => {
        setNetworkIP(d.localIP);
        setPort(String(d.port));
      })
      .catch(() => {
        setNetworkIP(window.location.hostname);
        setPort(window.location.port || '3001');
      });
  }, []);

  return (
    <div className="home-page">
      <div className="home-header">
        <h1 className="home-title">IT用語クイズ</h1>
        <p className="home-subtitle">勉強会2026</p>
      </div>

      <div className="home-cards">
        <Link to="/host" className="home-card host-card">
          <div className="card-icon">🎤</div>
          <div className="card-body">
            <h2>出題者画面</h2>
            <p>問題操作・○×判定・得点管理</p>
          </div>
        </Link>

        <Link to="/monitor" className="home-card monitor-card">
          <div className="card-icon">📺</div>
          <div className="card-body">
            <h2>モニター画面</h2>
            <p>プロジェクター・大画面向け</p>
          </div>
        </Link>

        <Link to="/buzzer" className="home-card buzzer-card">
          <div className="card-icon">🔔</div>
          <div className="card-body">
            <h2>早押しボタン</h2>
            <p>スマホ・タブレットから参加</p>
          </div>
        </Link>
      </div>

      {networkIP && (
        <div className="network-info">
          <h3>スマホから接続するには</h3>
          <p>同じWi-Fiに接続して以下のURLにアクセス</p>
          <div className="url-box">
            <code>http://{networkIP}:{port}/buzzer</code>
          </div>
          <p className="url-hint">QRコードリーダーでも読み取れます</p>
        </div>
      )}
    </div>
  );
}
