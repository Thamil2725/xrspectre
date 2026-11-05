import { useState } from 'react';
import { X } from 'lucide-react';
import { generateTemplates } from '../utils/templateGenerator';
import QuestionFormFields from './QuestionFormFields';
import './AddQuestionModal.css';

// Edits a single existing question in place. Pre-populates from the
// question passed in, and calls onSave(questionId, payload) — the
// parent (EditTest page) owns the actual API call and refresh.
export default function EditQuestionModal({ question, onSave, onClose }) {
  const [title, setTitle] = useState(question.title);
  const [statement, setStatement] = useState(question.statement);
  const [points, setPoints] = useState(question.points);
  const [timeAllottedMinutes, setTimeAllottedMinutes] = useState(question.timeAllottedMinutes);
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [questionType, setQuestionType] = useState(question.type ?? 'CODING');
  const [modelAnswer, setModelAnswer] = useState(question.modelAnswer ?? '');
  const [timeLimitSecs, setTimeLimitSecs] = useState(question.timeLimitSecs ?? 5);
  const [memoryLimitMB, setMemoryLimitMB] = useState(question.memoryLimitMB ?? 256);
  const [functionSignature, setFunctionSignature] = useState(question.functionSignature ?? null);
  const [functionTemplates, setFunctionTemplates] = useState(
    question.functionSignature?.name ? generateTemplates(question.functionSignature) : (question.functionTemplates ?? null)
  );
  const [testRows, setTestRows] = useState(
    question.testCases?.length
      ? question.testCases.map((tc) => ({ input: tc.input, output: tc.output, isSample: tc.isSample }))
      : [{ input: '', output: '', isSample: true }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSubjective = questionType === 'SUBJECTIVE';
  const validRows = testRows.filter((t) => t.input.trim() !== '' && t.output.trim() !== '');
  const canSave = title.trim() && statement.trim() && (isSubjective || validRows.length > 0);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await onSave(question.id, {
        title: title.trim(),
        statement: statement.trim(),
        points: Number(points) || 0,
        timeAllottedMinutes: Number(timeAllottedMinutes) || 0,
        difficulty,
        type: questionType,
        modelAnswer: isSubjective ? modelAnswer : undefined,
        timeLimitSecs: isSubjective ? undefined : Number(timeLimitSecs) || 5,
        memoryLimitMB: isSubjective ? undefined : Number(memoryLimitMB) || 256,
        testCases: isSubjective ? [] : validRows.map((t) => ({ input: t.input, output: t.output, isSample: t.isSample })),
        functionSignature: functionSignature?.name !== undefined ? functionSignature : undefined,
      });
      onClose();
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
      aria-label="Edit question"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="aqm aqm--single">
        <div className="aqm__panel aqm__panel--form">
          <div className="aqm__panel-header">
            <h2>Edit question</h2>
            <button className="aqm__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="aqm__form">
            {error && <p style={{ color: 'var(--red-300)', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}

            <label className="aqm__label">Question type</label>
            <div className="aqm__type-toggle">
              <button className={`aqm__type-btn ${questionType === 'CODING' ? 'aqm__type-btn--active' : ''}`} onClick={() => setQuestionType('CODING')} type="button">Coding</button>
              <button className={`aqm__type-btn ${questionType === 'SUBJECTIVE' ? 'aqm__type-btn--active' : ''}`} onClick={() => setQuestionType('SUBJECTIVE')} type="button">Subjective</button>
            </div>

            <QuestionFormFields
              title={title} setTitle={setTitle}
              statement={statement} setStatement={setStatement}
              points={points} setPoints={setPoints}
              timeAllottedMinutes={timeAllottedMinutes} setTimeAllottedMinutes={setTimeAllottedMinutes}
              difficulty={difficulty} setDifficulty={setDifficulty}
              questionType={questionType}
              modelAnswer={modelAnswer} setModelAnswer={setModelAnswer}
              timeLimitSecs={timeLimitSecs} setTimeLimitSecs={setTimeLimitSecs}
              memoryLimitMB={memoryLimitMB} setMemoryLimitMB={setMemoryLimitMB}
              testRows={testRows} setTestRows={setTestRows}
              functionSignature={functionSignature} setFunctionSignature={setFunctionSignature}
              functionTemplates={functionTemplates} setFunctionTemplates={setFunctionTemplates}
            />
          </div>

          <div className="aqm__form-footer">
            <button className="aqm__cancel" onClick={onClose}>Cancel</button>
            <button className="aqm__save" disabled={!canSave || saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
