import './ProblemPanel.css';

const DIFFICULTY_CLASS = {
  EASY: 'pp__badge--easy',
  MEDIUM: 'pp__badge--medium',
  HARD: 'pp__badge--hard',
};

function renderStatement(text) {
  if (!text) return null;
  return text.split('\n\n').map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            part
          )
        )}
      </p>
    );
  });
}

export default function ProblemPanel({ question }) {
  return (
    <div className="pp">
      <div className="pp__header">
        <div className="pp__title-row">
          <h1 className="pp__title">{question.title}</h1>
        </div>
        <div className="pp__badges">
          <span className={`pp__badge ${DIFFICULTY_CLASS[question.difficulty] || ''}`}>
            {question.difficulty}
          </span>
          <span className="pp__badge pp__badge--type">{question.type === 'CODING' ? 'Coding' : 'Subjective'}</span>
          {question.category && <span className="pp__category">{question.category}</span>}
          <span className="pp__points">{question.points} pts</span>
          <span className="pp__time">{question.timeAllottedMinutes} min</span>
          {question.type !== 'SUBJECTIVE' && (
            <span className="pp__limits">{question.timeLimitSecs ?? 5}s &middot; {question.memoryLimitMB ?? 256} MB</span>
          )}
        </div>
      </div>

      <div className="pp__body">
        <div className="pp__section">
          {renderStatement(question.statement)}
        </div>

        {question.type !== 'SUBJECTIVE' && question.constraints?.length > 0 && (
          <div className="pp__section">
            <h3 className="pp__subhead">Constraints</h3>
            <ul className="pp__constraints">
              {question.constraints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {question.type !== 'SUBJECTIVE' && (
          <div className="pp__section">
            <h3 className="pp__subhead">Sample tests</h3>
            {question.sampleTests?.length > 0 ? (
              <div className="pp__samples">
                {question.sampleTests.map((t, i) => (
                  <div className="pp__sample" key={i}>
                    <div className="pp__sample-header">Test {i + 1}</div>
                    <div className="pp__sample-body">
                      <div className="pp__sample-row">
                        <span className="pp__sample-label">Input</span>
                        <pre className="pp__sample-code">{t.input}</pre>
                      </div>
                      <div className="pp__sample-row">
                        <span className="pp__sample-label">Output</span>
                        <pre className="pp__sample-code">{t.output}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pp__empty">No sample tests provided.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
