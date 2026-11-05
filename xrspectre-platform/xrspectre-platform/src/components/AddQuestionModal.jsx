import { useState } from 'react';
import { X } from 'lucide-react';
import { useTestDraft } from '../context/TestDraftContext';
import QuestionFormFields from './QuestionFormFields';
import './AddQuestionModal.css';

export default function AddQuestionModal({ onClose }) {
  const { draft, addQuestion } = useTestDraft();

  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [points, setPoints] = useState(20);
  const [timeAllottedMinutes, setTimeAllottedMinutes] = useState(20);
  const [difficulty, setDifficulty] = useState('EASY');
  const [timeLimitSecs, setTimeLimitSecs] = useState(5);
  const [memoryLimitMB, setMemoryLimitMB] = useState(256);
  const [testRows, setTestRows] = useState([{ input: '', output: '', isSample: true }]);
  const [functionSignature, setFunctionSignature] = useState(null);
  const [functionTemplates, setFunctionTemplates] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const validRows = testRows.filter((t) => t.input.trim() !== '' && t.output.trim() !== '');
  const canSave = title.trim() && statement.trim() && validRows.length > 0;

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await addQuestion({
        title: title.trim(),
        statement: statement.trim(),
        points: Number(points) || 0,
        timeAllottedMinutes: Number(timeAllottedMinutes) || 0,
        difficulty,
        timeLimitSecs: Number(timeLimitSecs) || 5,
        memoryLimitMB: Number(memoryLimitMB) || 256,
        testCases: validRows.map((t) => ({ input: t.input, output: t.output, isSample: t.isSample })),
        functionSignature: functionSignature?.name !== undefined ? functionSignature : undefined,
      });
      // Reset the form so the admin can keep adding more questions
      // without closing the overlay.
      setTitle('');
      setStatement('');
      setPoints(20);
      setTimeAllottedMinutes(20);
      setDifficulty('EASY');
      setTimeLimitSecs(5);
      setMemoryLimitMB(256);
      setTestRows([{ input: '', output: '', isSample: true }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="aqm__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add question"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="aqm">
        <div className="aqm__panel aqm__panel--form">
          <div className="aqm__panel-header">
            <h2>Add question</h2>
            <button className="aqm__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="aqm__form">
            {error && <p style={{ color: 'var(--red-300)', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}

            <QuestionFormFields
              title={title} setTitle={setTitle}
              statement={statement} setStatement={setStatement}
              points={points} setPoints={setPoints}
              timeAllottedMinutes={timeAllottedMinutes} setTimeAllottedMinutes={setTimeAllottedMinutes}
              difficulty={difficulty} setDifficulty={setDifficulty}
              timeLimitSecs={timeLimitSecs} setTimeLimitSecs={setTimeLimitSecs}
              memoryLimitMB={memoryLimitMB} setMemoryLimitMB={setMemoryLimitMB}
              testRows={testRows} setTestRows={setTestRows}
              functionSignature={functionSignature} setFunctionSignature={setFunctionSignature}
              functionTemplates={functionTemplates} setFunctionTemplates={setFunctionTemplates}
            />
          </div>

          <div className="aqm__form-footer">
            <button type="button" className="aqm__cancel" onClick={onClose}>Done adding questions</button>
            <button className="aqm__save" disabled={!canSave || saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save question'}
            </button>
          </div>
        </div>

        <div className="aqm__panel aqm__panel--list">
          <h3>Questions added so far ({draft.questions.length})</h3>
          {draft.questions.length === 0 ? (
            <p className="aqm__list-empty">Questions you save will appear here.</p>
          ) : (
            <div className="aqm__list">
              {draft.questions.map((q, i) => (
                <div className="aqm__list-item" key={q.id}>
                  <span className="aqm__list-num">{i + 1}</span>
                  <div>
                    <div className="aqm__list-title">{q.title}</div>
                    <div className="aqm__list-meta">{q.difficulty} · {q.points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
