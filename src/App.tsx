import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HostPage from './pages/HostPage';
import MonitorPage from './pages/MonitorPage';
import BuzzerPage from './pages/BuzzerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/buzzer" element={<BuzzerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
