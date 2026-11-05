import './QuestionRail.css';

export default function QuestionRail({ questions, activeIndex, statuses, onSelect }) {
  const counts = { solved: 0, attempted: 0, untouched: 0, timedOut: 0 };
  questions.forEach((q) => {
    const s = statuses[q.id] || 'untouched';
    if (s === 'solved') counts.solved++;
    else if (s === 'attempted') counts.attempted++;
    else if (s === 'timedOut') counts.timedOut++;
    else counts.untouched++;
  });

  return (
    <nav className="qrail" aria-label="Question navigation">
      <div className="qrail__list">
        {questions.map((q, i) => {
          const status = statuses[q.id] || 'untouched';
          return (
            <button
              key={q.id}
              className={`qrail__item qrail__item--${status} ${i === activeIndex ? 'qrail__item--active' : ''}`}
              onClick={() => onSelect(i)}
              aria-current={i === activeIndex}
              title={`${i + 1}. ${q.title}${q.category ? ` (${q.category})` : ''}`}
            >
              <span className="qrail__num">{i + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="qrail__legend">
        <div className="qrail__legend-row">
          <span className="qrail__dot qrail__dot--solved" />
          <span>{counts.solved} Solved</span>
        </div>
        <div className="qrail__legend-row">
          <span className="qrail__dot qrail__dot--attempted" />
          <span>{counts.attempted} Attempted</span>
        </div>
        <div className="qrail__legend-row">
          <span className="qrail__dot qrail__dot--untouched" />
          <span>{counts.untouched} Left</span>
        </div>
        <div className="qrail__legend-row">
          <span className="qrail__dot qrail__dot--timedOut" />
          <span>{counts.timedOut} Timed out</span>
        </div>
      </div>
    </nav>
  );
}
