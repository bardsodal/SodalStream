import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import SeriesDetail from './pages/SeriesDetail.jsx';
import Player from './pages/Player.jsx';
import History from './pages/History.jsx';
import ScanStatus from './components/ScanStatus.jsx';

export default function App() {
  const location = useLocation();
  const inPlayer = location.pathname.startsWith('/play/');

  return (
    <div className="app">
      {!inPlayer && (
        <header className="topnav">
          <Link to="/" className="brand">
            Sodal<span>Stream</span>
          </Link>
          <nav>
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              Home
            </Link>
            <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
              History
            </Link>
          </nav>
          <ScanStatus />
        </header>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
        <Route path="/play/:id" element={<Player />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </div>
  );
}
