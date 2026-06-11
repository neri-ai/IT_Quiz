import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HostPage from './pages/HostPage';
import MonitorPage from './pages/MonitorPage';
import PlayerPage from './pages/PlayerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/buzzer" element={<Navigate to="/player" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
