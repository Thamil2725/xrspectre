import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Pencil, Eye, AlertTriangle, CalendarClock, Building2, ShieldAlert, Check } from 'lucide-react';
import MultiSelect from '../components/MultiSelect';
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import AddQuestionModal from '../components/AddQuestionModal';
import EditQuestionModal from '../components/EditQuestionModal';
import { useOrgData } from '../hooks/useOrgData';
import * as adminTestsApi from '../api/adminTests';
import * as poolsApi from '../api/pools';
import { TestDraftProvider, useTestDraft } from '../context/TestDraftContext';
import './EditTest.css';
import './QuestionPools.css';

// The questions section reuses AddQuestionModal, which is wired to
// TestDraftContext (the create-flow's in-memory draft). To reuse it
// here without a rewrite, we wrap just that section in its own
// TestDraftProvider and seed it with this test's id/questions on load,
// so "Add question" calls hit PATCH/POST against the real testId
// immediately rather than staying in memory.
export default function EditTest() {
  const { testId } = useParams();
  return (
    <TestDraftProvider>
      <EditTestInner testId={testId} />
    </TestDraftProvider>
  );
}

function EditTestInner({ testId }) {
  const { draft, updateDraft } = useTestDraft();
  const { institutions, departments, batches, loading: orgLoading } = useOrgData();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const audienceLoaded = useRef(false);

  const [title, setTitle] = useState('');
  const [institutionIds, setInstitutionIds] = useState([]);
  const [departmentIds, setDepartmentIds] = useState([]);
  const [batchIds, setBatchIds] = useState([]);
  const [savingAudience, setSavingAudience] = useState(false);
  const [audienceSaved, setAudienceSaved] = useState(false);

  const filteredDepartments = departments
    .filter((d) => institutionIds.includes(d.institutionId))
    .map((d) => ({
      ...d,
      subtitle: institutions.find((i) => i.id === d.institutionId)?.name ?? '',
    }));
  const filteredBatches = batches
    .filter((b) => b.departmentId && departmentIds.includes(b.departmentId))
    .map((b) => ({
      ...b,
      subtitle: departments.find((d) => d.id === b.departmentId)?.name ?? '',
    }));

  useEffect(() => {
    if (!audienceLoaded.current) return;
    setDepartmentIds([]);
  }, [institutionIds]);

  useEffect(() => {
    if (!audienceLoaded.current) return;
    setBatchIds([]);
  }, [departmentIds]);

  const [questionSource, setQuestionSource] = useState('manual');
  const [selectedPoolIds, setSelectedPoolIds] = useState([]);
  const [questionsPerStudent, setQuestionsPerStudent] = useState(5);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [questionsPerCategory, setQuestionsPerCategory] = useState([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [poolInfo, setPoolInfo] = useState(null);

  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxWarnings, setMaxWarnings] = useState(3);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState(null);
  const [previewingQuestion, setPreviewingQuestion] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = () => {
    return adminTestsApi.getTestDetails(testId).then((data) => {
      updateDraft({
        testId: data.id,
        title: data.title,
        institutionIds: data.institutions.map((i) => i.id),
        departmentIds: data.departments.map((d) => d.id),
        batchIds: data.batches.map((b) => b.id),
        questions: data.questions,
      });
      setTitle(data.title);
      setInstitutionIds(data.institutions.map((i) => i.id));
      setDepartmentIds(data.departments.map((d) => d.id));
      setBatchIds(data.batches.map((b) => b.id));
      setQuestionSource(data.questionSource || 'manual');
      setSelectedPoolIds(data.selectedPoolIds || []);
      setQuestionsPerStudent(data.questionsPerStudent || 5);
      setSelectedCategoryIds(data.selectedCategoryIds || []);
      setSelectedQuestionIds(data.selectedQuestionIds || []);
      setQuestionsPerCategory(data.questionsPerCategory || []);
      const sd = toLocalParts(data.startTime);
      setStartDate(sd.date);
      setStartTime(sd.time);
      const ed = toLocalParts(data.endTime);
      setEndDate(ed.date);
      setEndTime(ed.time);
      setMaxWarnings(data.maxWarnings ?? 3);
      setSecurityEnabled(data.securityEnabled ?? true);
      setAttemptCount(data.attemptCount ?? 0);
      if (data.selectedPoolIds && data.selectedPoolIds.length > 0) {
        Promise.all(data.selectedPoolIds.map((pid) => poolsApi.getPoolDetails(pid).catch(() => null)))
          .then((results) => {
            const merged = results.filter(Boolean).reduce((acc, info) => {
              if (!acc) return info;
              return {
                ...acc,
                categories: [...(acc.categories || []), ...(info.categories || [])],
              };
            }, null);
            setPoolInfo(merged);
          });
      }
    });
  };

  useEffect(() => {
    load().catch((err) => setError(err.message)).finally(() => {
      audienceLoaded.current = true;
      setLoading(false);
    });
  }, [testId]);

  const handleSaveAudience = async () => {
    setError('');
    setSavingAudience(true);
    setAudienceSaved(false);
    try {
      const totalFromCat = questionsPerCategory.reduce((sum, e) => sum + (parseInt(e.split(':')[1], 10) || 0), 0);
      await adminTestsApi.updateAudience(testId, {
        title: title.trim(),
        institutionIds, departmentIds, batchIds,
        questionSource,
        selectedPoolIds: questionSource === 'pool' ? selectedPoolIds : [],
        questionsPerStudent: questionSource === 'pool' ? (totalFromCat || questionsPerStudent) : undefined,
        selectedCategoryIds: questionSource === 'pool' ? selectedCategoryIds : [],
        selectedQuestionIds: questionSource === 'pool' ? selectedQuestionIds : [],
        questionsPerCategory: questionSource === 'pool' ? questionsPerCategory : [],
      });
      await load();
      setAudienceSaved(true);
      setTimeout(() => setAudienceSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAudience(false);
    }
  };

  const countSelectedInCat = (catId) => {
    const cat = poolInfo?.categories?.find((c) => c.id === catId);
    if (!cat) return 0;
    return cat.questions.filter((q) => selectedQuestionIds.includes(q.id)).length;
  };

  const toggleQuestion = (qId) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleSaveSchedule = async () => {
    setError('');
    setSavingSchedule(true);
    setScheduleSaved(false);
    try {
      await adminTestsApi.scheduleTest(testId, {
        startTime: new Date(`${startDate}T${startTime}`).toISOString(),
        endTime: new Date(`${endDate}T${endTime}`).toISOString(),
        maxWarnings,
        securityEnabled,
      });
      await load();
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleUpdateQuestion = async (questionId, payload) => {
    await adminTestsApi.updateQuestion(testId, questionId, payload);
    await load();
  };

  const handleRemoveQuestion = async (questionId) => {
    setRemovingId(questionId);
    setError('');
    try {
      await adminTestsApi.removeQuestion(testId, questionId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return <p className="etest__loading">Loading test…</p>;

  const canSaveAudience = institutionIds.length > 0 && departmentIds.length > 0 && batchIds.length > 0 && title.trim();
  const canSaveSchedule = startTime && endTime && startTime < endTime;

  return (
    <div className="etest">
      <Link to="/admin/tests" className="etest__back"><ChevronLeft size={15} /> All tests</Link>

      <div className="etest__header">
        <h1>{draft.title || 'Edit test'}</h1>
        {attemptCount > 0 && (
          <div className="etest__attempt-warning">
            <AlertTriangle size={14} />
            {attemptCount} student{attemptCount !== 1 ? 's' : ''} already started this test. Changes you make here apply immediately and may affect their experience.
          </div>
        )}
      </div>

      {error && <p className="etest__error">{error}</p>}

      <section className="etest__section">
        <div className="etest__section-title"><Building2 size={16} /> Audience</div>

        <label className="etest__label">Test title</label>
        <input className="etest__input" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="etest__row">
          <MultiSelect
            label="Educational institution"
            options={institutions}
            selected={institutionIds}
            onChange={setInstitutionIds}
            placeholder={orgLoading ? 'Loading…' : 'Select institutions'}
          />
          <MultiSelect
            label="Department"
            options={filteredDepartments}
            selected={departmentIds}
            onChange={setDepartmentIds}
            placeholder={orgLoading ? 'Loading…' : (institutionIds.length === 0 ? 'Select an institution first' : 'Select departments')}
          />
          <MultiSelect
            label="Batch"
            options={filteredBatches}
            selected={batchIds}
            onChange={setBatchIds}
            placeholder={orgLoading ? 'Loading…' : (departmentIds.length === 0 ? 'Select a department first' : 'Select batches')}
          />
        </div>

        <div className="etest__question-source">
          <label className="etest__label">Question source</label>
          <div className="etest__toggle">
            <button
              className={`etest__toggle-btn ${questionSource === 'manual' ? 'etest__toggle-btn--active' : ''}`}
              onClick={() => setQuestionSource('manual')}
            >Add manually</button>
            <button
              className={`etest__toggle-btn ${questionSource === 'pool' ? 'etest__toggle-btn--active' : ''}`}
              onClick={() => setQuestionSource('pool')}
            >Use pool</button>
          </div>
        </div>

        {questionSource === 'pool' && (
          <div className="etest__pool-config">
            <div className="etest__field">
              <label className="etest__label">Pool</label>
              <input className="etest__input" value={poolInfo?.name || (selectedPoolIds.length > 0 ? `${selectedPoolIds.length} pool(s)` : '') || 'Loading…'} disabled />
            </div>
            {poolInfo?.categories && (
              <div className="etest__per-cat">
                <label className="etest__label" style={{ marginBottom: 6 }}>Questions per category</label>
                {poolInfo.categories.map((cat) => {
                  const entry = questionsPerCategory.find((e) => e.startsWith(cat.id + ':'));
                  const count = entry ? parseInt(entry.split(':')[1], 10) || 0 : 0;
                  const selCount = countSelectedInCat(cat.id);
                  const expanded = expandedCategoryId === cat.id;
                  return (
                    <div key={cat.id} className="etest__cat-wrap">
                      <div className="etest__cat-row">
                        <button className="etest__cat-main" onClick={() => setExpandedCategoryId(expanded ? null : cat.id)}>
                          <span className="etest__cat-chevron">{expanded ? '▼' : '▶'}</span>
                          <span className="etest__cat-name">{cat.name}</span>
                          <span className="etest__cat-total">
                            {selCount > 0 ? `${selCount} selected` : `${cat.questions.length} qns`}
                          </span>
                        </button>
                        <input
                          className="etest__input etest__input--sm"
                          type="number"
                          min={0}
                          max={cat.questions.length}
                          value={count}
                          onChange={(e) => {
                            const val = Math.min(cat.questions.length, Math.max(0, Number(e.target.value)));
                            const key = cat.id + ':';
                            setQuestionsPerCategory((prev) => {
                              const filtered = prev.filter((p) => !p.startsWith(key));
                              return val > 0 ? [...filtered, `${cat.id}:${val}`] : filtered;
                            });
                          }}
                        />
                      </div>
                      {expanded && (
                        <div className="etest__cat-qlist">
                          {cat.questions.map((q) => (
                            <label key={q.id} className="etest__cat-qitem">
                              <span className={`etest__checkbox ${selectedQuestionIds.includes(q.id) ? 'etest__checkbox--checked' : ''}`}>
                                {selectedQuestionIds.includes(q.id) && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span className="etest__cat-qbody">
                                <span className="etest__cat-qtitle">{q.title}</span>
                                <span className={`qpools__diff qpools__diff--${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                                <span className={`qpools__type qpools__type--${q.type.toLowerCase()}`}>{q.type === 'CODING' ? 'Coding' : 'Subjective'}</span>
                                <span className="qpools__meta qpools__meta--pts">{q.points} pts</span>
                                <span className="qpools__meta qpools__meta--time">{q.timeAllottedMinutes} min</span>
                                {q.type !== 'SUBJECTIVE' && <span className="qpools__meta qpools__meta--tc">{q.testCases.length} tc{q.testCases.length !== 1 ? 's' : ''}</span>}
                              </span>
                              <input
                                type="checkbox"
                                checked={selectedQuestionIds.includes(q.id)}
                                onChange={() => toggleQuestion(q.id)}
                                className="etest__cat-hidden-checkbox"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!poolInfo?.categories && selectedPoolIds.length > 0 && (
              <p className="etest__hint" style={{ fontSize: 12, color: 'var(--ink-400)' }}>Loading categories...</p>
            )}
          </div>
        )}

        <div className="etest__section-footer">
          <button className="etest__save-btn" disabled={!canSaveAudience || savingAudience} onClick={handleSaveAudience}>
            {savingAudience ? 'Saving…' : 'Save audience'}
          </button>
          {audienceSaved && <span className="etest__saved">Saved</span>}
        </div>
      </section>

      {questionSource === 'manual' && (
        <section className="etest__section">
          <div className="etest__section-title-row">
            <div className="etest__section-title"><Pencil size={16} /> Questions</div>
            <button className="etest__add-btn" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Add question
            </button>
          </div>

          <div className="etest__qlist">
            {draft.questions.length === 0 && <p className="etest__empty">No questions yet.</p>}
            {draft.questions.map((q, i) => (
              <div className="etest__qitem" key={q.id}>
                <span className="etest__qnum">{i + 1}</span>
                <div className="etest__qbody">
                  <span className="etest__qtitle">{q.title}</span>
                  <span className="etest__qmeta">{q.type === 'CODING' ? 'Coding' : 'Subjective'} · {q.points} pts · {q.timeAllottedMinutes} min · {q.testCases?.length ?? 0} test cases</span>
                </div>
                <button className="etest__qaction" onClick={() => setPreviewingQuestion(q)} aria-label={`Preview ${q.title}`}>
                  <Eye size={14} />
                </button>
                <button className="etest__qaction" onClick={() => setEditingQuestion(q)} aria-label={`Edit ${q.title}`}>
                  <Pencil size={14} />
                </button>
                <button
                  className="etest__qaction etest__qaction--danger"
                  onClick={() => handleRemoveQuestion(q.id)}
                  disabled={removingId === q.id}
                  aria-label={`Remove ${q.title}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="etest__section">
        <div className="etest__section-title"><CalendarClock size={16} /> Schedule</div>

        <div className="etest__row">
          <div className="etest__field">
            <label className="etest__label">Start time</label>
            <DatePicker value={startDate} onChange={(v) => setStartDate(v)} />
            <TimePicker value={startTime} onChange={(v) => setStartTime(v)} />
          </div>
          <div className="etest__field">
            <label className="etest__label">End time</label>
            <DatePicker value={endDate} onChange={(v) => setEndDate(v)} />
            <TimePicker value={endTime} onChange={(v) => setEndTime(v)} />
          </div>
        </div>

        <div className="etest__field" style={{ marginTop: 16 }}>
          <label className="etest__label"><ShieldAlert size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Security warnings</label>
          <label className="etest__toggle">
            <input
              type="checkbox"
              checked={securityEnabled}
              onChange={(e) => setSecurityEnabled(e.target.checked)}
            />
            Enable restrictions
          </label>
          {securityEnabled ? (
            <div className="cts__row cts__row--narrow" style={{ marginTop: 8 }}>
              <input
                className="cts__input cts__input--sm"
                type="number"
                min={1}
                max={10}
                value={maxWarnings}
                onChange={(e) => setMaxWarnings(Number(e.target.value))}
                style={{ width: 80 }}
              />
              <span className="cts__input-suffix">warning{maxWarnings !== 1 ? 's' : ''} allowed</span>
            </div>
          ) : (
            <p className="cts__hint" style={{ marginTop: 4 }}>Tab switching, fullscreen exit, and other security checks are disabled.</p>
          )}
        </div>

        <div className="etest__section-footer">
          <button className="etest__save-btn" disabled={!canSaveSchedule || savingSchedule} onClick={handleSaveSchedule}>
            {savingSchedule ? 'Saving…' : 'Save schedule'}
          </button>
          {scheduleSaved && <span className="etest__saved">Saved</span>}
        </div>
      </section>

      {showAddModal && <AddQuestionModal onClose={() => { setShowAddModal(false); load(); }} />}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onSave={handleUpdateQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}
      {previewingQuestion && (
        <QuestionPreviewModal
          question={previewingQuestion}
          onClose={() => setPreviewingQuestion(null)}
        />
      )}
    </div>
  );
}

/* ─── Question Preview Modal ─── */
function QuestionPreviewModal({ question, onClose }) {
  return (
    <div className="qpools__overlay" onClick={onClose}>
      <div className="etest__preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="etest__preview-header">
          <h2>Student preview</h2>
          <button className="qpools__icon-btn" onClick={onClose}>
            <Eye size={16} />
          </button>
        </div>
        <div className="etest__preview-body">
          <div className="pp">
            <div className="pp__header">
              <div className="pp__title-row">
                <h1 className="pp__title">{question.title}</h1>
              </div>
              <div className="pp__badges">
                <span className={`pp__badge ${question.difficulty === 'EASY' ? 'pp__badge--easy' : question.difficulty === 'MEDIUM' ? 'pp__badge--medium' : 'pp__badge--hard'}`}>
                  {question.difficulty}
                </span>
                <span className="pp__badge pp__badge--type">{question.type === 'CODING' ? 'Coding' : 'Subjective'}</span>
                {question.category && <span className="pp__category">{question.category}</span>}
                <span className="pp__points">{question.points} pts</span>
                <span className="pp__time">{question.timeAllottedMinutes} min</span>
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

              {question.type !== 'SUBJECTIVE' && (
                <div className="etest__preview-editor-placeholder">
                  <div className="pp__section">
                    <h3 className="pp__subhead">Code editor</h3>
                    <p className="pp__empty">The code editor with language selection, run, and submit buttons will appear here.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="etest__preview-footer">
          <button className="qpools__btn" onClick={onClose}>Close preview</button>
        </div>
      </div>
    </div>
  );
}

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

function toLocalParts(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
