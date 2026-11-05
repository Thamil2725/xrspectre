import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, LogOut, ChevronRight, CheckCircle, AlertTriangle, Timer, Ban, RotateCcw } from 'lucide-react';
import { listAvailableTests } from '../api/studentTests';
import { useAuth } from '../context/AuthContext';
import './StudentTestList.css';
import BrandMark from '../components/BrandMark';

function formatTimeLeft(endTime) {
  const now = Date.now();
  const end = new Date(endTime).getTime();
  const diff = end - now;
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 48) return `${Math.floor(hours / 24)}d left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function formatWindow(start, end) {
  const opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return `${new Date(start).toLocaleString(undefined, opts)} — ${new Date(end).toLocaleString(undefined, opts)}`;
}

/* ── Falling Numbers Canvas ── */
function FallingNumbers() {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    const cols = Math.floor(W / 16);
    const drops = Array.from({ length: cols }, () => Math.random() * -120);
    const speeds = Array.from({ length: cols }, () => 0.15 + Math.random() * 0.2);
    const sizes = Array.from({ length: cols }, () => 10 + Math.floor(Math.random() * 10));
    const chars = '01'.split('');

    function render() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * 16;
        const y = drops[i] * 16;
        const fs = sizes[i];

        ctx.font = `${fs}px 'IBM Plex Mono', monospace`;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + Math.random() * 0.08})`;
        ctx.fillText(ch, x, y);

        if (y > H && Math.random() > 0.988) { drops[i] = Math.random() * -30; sizes[i] = 10 + Math.floor(Math.random() * 10); }
        drops[i] += speeds[i];
      }
      canvas._raf = requestAnimationFrame(render);
    }
    render();
  }, []);

  useEffect(() => {
    draw();
    return () => {
      const canvas = canvasRef.current;
      if (canvas && canvas._raf) cancelAnimationFrame(canvas._raf);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="stl__matrix" />;
}

export default function StudentTestList() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listAvailableTests()
      .then(setTests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="stl">
      {/* ── Falling Numbers Background ── */}
      <FallingNumbers />

      {/* ── Top Navigation Bar ── */}
      <nav className="stl__navbar">
        <div className="stl__navbar-inner">
          <div className="stl__navbar-brand">
            <span className="stl__logo"><BrandMark size={15} /></span>
            <span className="stl__brand-text">XRSpectre</span>
          </div>
          <div className="stl__navbar-right">
            <button className="stl__logout" onClick={handleLogout}>
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Modal ── */}
      <main className="stl__main">
        <div className="stl__modal">
          <div className="stl__modal-header">
            <h1 className="stl__title">{user?.name?.split(' ')[0] || 'Your'}'s Tests</h1>
            <p className="stl__subtitle">Tests you're currently eligible to take</p>
          </div>

          {error && <div className="stl__error">{error}</div>}
          {loading && <div className="stl__loading">Loading tests...</div>}

          {!loading && !error && tests.length === 0 && (
            <div className="stl__empty-state">
              <div className="stl__empty-icon">
                <Clock size={28} />
              </div>
              <p className="stl__empty-title">No tests available</p>
              <p className="stl__empty-sub">Check back during your test's scheduled window.</p>
            </div>
          )}

          <div className="stl__list">
            {tests.map((t) => {
              const isClickable = t.status === 'ACTIVE' || t.status === 'REOPENED' || t.status === 'REOPEN_ATTEMPT';
              const linkTo = isClickable ? `/student/tests/${t.id}` : null;

              return (
                <div
                  className={`stl__card ${t.status === 'SUBMITTED' ? 'stl__card--submitted' : ''} ${t.status === 'DISQUALIFIED' ? 'stl__card--disqualified' : ''} ${t.status === 'ENDED' ? 'stl__card--ended' : ''}`}
                  key={t.id}
                >
                  {linkTo ? (
                    <Link to={linkTo} className="stl__card-link">
                      <CardContent t={t} formatWindow={formatWindow} formatTimeLeft={formatTimeLeft} />
                    </Link>
                  ) : (
                    <CardContent t={t} formatWindow={formatWindow} formatTimeLeft={formatTimeLeft} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function CardContent({ t, formatWindow, formatTimeLeft }) {
  return (
    <>
      <div className="stl__card-body">
        <div className="stl__card-title">
          {t.title}
        </div>
        <div className="stl__card-meta">
          <span className="stl__card-window">{t.reopenStartTime ? formatWindow(t.reopenStartTime, t.reopenEndTime) : formatWindow(t.startTime, t.endTime)}</span>
          {t.durationMinutes != null && (
            <>
              <span className="stl__card-sep">·</span>
              <span className="stl__card-duration">
                <Clock size={11} />
                {t.durationMinutes} min
              </span>
            </>
          )}
        </div>
      </div>
      <div className="stl__card-right">
        {t.status === 'DISQUALIFIED' ? (
          <span className="stl__badge stl__badge--red">
            <AlertTriangle size={11} /> Disqualified
            {t.totalScore != null && <span className="stl__badge-score">Score: {t.totalScore}</span>}
          </span>
        ) : t.status === 'REOPEN_ATTEMPT' ? (
          <span className="stl__badge stl__badge--teal">
            <RotateCcw size={11} /> Reattempt
            {t.totalScore != null && <span className="stl__badge-score">Score: {t.totalScore}</span>}
          </span>
        ) : t.status === 'SUBMITTED' ? (
          <span className="stl__badge stl__badge--green">
            <CheckCircle size={11} /> Submitted
            {t.totalScore != null && <span className="stl__badge-score">Score: {t.totalScore}</span>}
          </span>
        ) : t.status === 'REOPENED' ? (
          <span className="stl__badge stl__badge--purple">
            <Timer size={11} /> Reopened
          </span>
        ) : t.status === 'SCHEDULED' ? (
          <span className="stl__badge stl__badge--amber">
            <Timer size={11} /> Scheduled
          </span>
        ) : t.status === 'ENDED' ? (
          <span className="stl__badge stl__badge--gray">
            <Ban size={11} /> Ended
          </span>
        ) : (
          <>
            <span className="stl__card-time">{formatTimeLeft(t.reopenEndTime || t.endTime)}</span>
            <ChevronRight size={16} className="stl__card-chevron" />
          </>
        )}
      </div>
    </>
  );
}
