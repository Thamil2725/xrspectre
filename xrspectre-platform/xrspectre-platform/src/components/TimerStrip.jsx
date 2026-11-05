import { Clock, Send } from 'lucide-react';
import './TimerStrip.css';

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function urgency(seconds, total) {
  if (!total || total <= 0) return 'normal';
  const ratio = seconds / total;
  if (ratio <= 0.1) return 'critical';
  if (ratio <= 0.3) return 'warning';
  return 'normal';
}

export default function TimerStrip({
  testTitle,
  questionSecondsLeft,
  questionTotalSeconds,
  overallSecondsLeft,
  overallTotalSeconds,
  onSubmitTest,
}) {
  const qUrgency = urgency(questionSecondsLeft, questionTotalSeconds);
  const overallUrgency = urgency(overallSecondsLeft, overallTotalSeconds);

  return (
    <header className="tstrip">
      <div className="tstrip__title">{testTitle}</div>

      <div className="tstrip__timers">
        <div className={`tstrip__timer tstrip__timer--${qUrgency}`}>
          <Clock size={13} />
          <span className="tstrip__timer-label">Question</span>
          <span className="tstrip__timer-value">{formatTime(questionSecondsLeft)}</span>
        </div>

        <div className="tstrip__divider" />

        <div className={`tstrip__timer tstrip__timer--${overallUrgency}`}>
          <Clock size={13} />
          <span className="tstrip__timer-label">Total</span>
          <span className="tstrip__timer-value">{formatTime(overallSecondsLeft)}</span>
        </div>
      </div>

      <button className="tstrip__submit" onClick={onSubmitTest}>
        <Send size={13} />
        Submit test
      </button>
    </header>
  );
}
