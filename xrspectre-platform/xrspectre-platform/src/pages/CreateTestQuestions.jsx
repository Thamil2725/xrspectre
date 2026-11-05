import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Plus, Trash2, ChevronRight, ChevronLeft, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import MultiSelect from '../components/MultiSelect';
import { useTestDraft } from '../context/TestDraftContext';
import { useOrgData } from '../hooks/useOrgData';
import AddQuestionModal from '../components/AddQuestionModal';
import * as poolsApi from '../api/pools';
import ProgressTracker from '../components/ProgressTracker';
import './CreateTestQuestions.css';
import './QuestionPools.css';

export default function CreateTestQuestions() {
  const navigate = useNavigate();
  const { draft, savePoolConfig, addQuestion, removeQuestion } = useTestDraft();
  const { institutions, departments, batches } = useOrgData();

  const [showDetails, setShowDetails] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // question source
  const [questionSource, setQuestionSource] = useState(draft.questionSource || 'manual');

  // pool state
  const [pools, setPools] = useState([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [selectedPoolIds, setSelectedPoolIds] = useState(draft.selectedPoolIds || []);
  const [poolDetailsMap, setPoolDetailsMap] = useState({});
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(draft.selectedQuestionIds || []);
  const [questionsPerCategory, setQuestionsPerCategory] = useState(draft.questionsPerCategory || []);
  const [expandedPoolId, setExpandedPoolId] = useState(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);

  useEffect(() => {
    setPoolsLoading(true);
    poolsApi.listPools()
      .then(setPools)
      .catch((err) => setError(err.message))
      .finally(() => setPoolsLoading(false));
  }, []);

  useEffect(() => {
    selectedPoolIds.forEach((pid) => {
      if (!poolDetailsMap[pid]) {
        poolsApi.getPoolDetails(pid).then((d) => {
          setPoolDetailsMap((prev) => ({ ...prev, [pid]: d }));
        }).catch(() => {});
      }
    });
  }, [selectedPoolIds]);

  const institutionNames = institutions.filter((i) => draft.institutionIds.includes(i.id)).map((i) => i.name);
  const departmentNames = departments.filter((d) => draft.departmentIds.includes(d.id)).map((d) => d.name);
  const batchNames = batches.filter((b) => draft.batchIds.includes(b.id)).map((b) => b.name);

  const removePool = (pid) => {
    setSelectedPoolIds((prev) => prev.filter((id) => id !== pid));
    if (expandedPoolId === pid) setExpandedPoolId(null);
  };

  const allCategories = Object.values(poolDetailsMap).flatMap((pd) => pd?.categories || []);

  const getCatCount = (catId) => {
    const entry = questionsPerCategory.find((e) => e.startsWith(catId + ':'));
    return entry ? parseInt(entry.split(':')[1], 10) || 0 : 0;
  };

  const setCatCount = (catId, count) => {
    setQuestionsPerCategory((prev) => {
      const filtered = prev.filter((e) => !e.startsWith(catId + ':'));
      if (count > 0) {
        return [...filtered, `${catId}:${count}`];
      }
      return filtered;
    });
  };

  const incrementCat = (catId, max) => {
    const current = getCatCount(catId);
    if (current < max) setCatCount(catId, current + 1);
  };

  const decrementCat = (catId) => {
    const current = getCatCount(catId);
    if (current > 0) setCatCount(catId, current - 1);
  };

  const totalPerCategory = questionsPerCategory.reduce((sum, e) => {
    return sum + (parseInt(e.split(':')[1], 10) || 0);
  }, 0);

  const countSelectedInCat = (catId) => {
    const allCats = Object.values(poolDetailsMap).flatMap((pd) => pd?.categories || []);
    const cat = allCats.find((c) => c.id === catId);
    if (!cat) return 0;
    return cat.questions.filter((q) => selectedQuestionIds.includes(q.id)).length;
  };

  const toggleQuestion = (qId) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleRemove = async (questionId) => {
    setRemovingId(questionId);
    setError('');
    try {
      await removeQuestion(questionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleProceed = async () => {
    if (questionSource === 'pool') {
      if (selectedPoolIds.length === 0) return;
      if (totalPerCategory === 0) { setError('Set at least one question per category.'); return; }
      setSaving(true);
      setError('');
      try {
        await savePoolConfig({
          selectedPoolIds,
          questionsPerStudent: totalPerCategory,
          selectedCategoryIds: allCategories.map((c) => c.id),
          selectedQuestionIds,
          questionsPerCategory,
        });
        navigate('/admin/create/summary');
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    } else {
      navigate('/admin/create/summary');
    }
  };

  const renderCategory = (cat, poolId) => {
    const count = getCatCount(cat.id);
    const selCount = countSelectedInCat(cat.id);
    const expanded = expandedCategoryId === `${poolId}:${cat.id}`;
    return (
      <div key={cat.id} style={{ marginTop: 8 }}>
        <div className="ctq__pool-cat-wrap">
          <div className="ctq__pool-cat">
            <button className="ctq__pool-cat-main" onClick={() => cat.questions.length > 0 && setExpandedCategoryId(expanded ? null : `${poolId}:${cat.id}`)}>
              <div className="ctq__pool-cat-info">
                <span className="ctq__pool-cat-name">{cat.name}</span>
                <span className="ctq__pool-cat-count">
                  <span className="ctq__tag ctq__tag--total">{cat.questions.length} questions</span>
                  {selCount > 0 && <span className="ctq__tag ctq__tag--sel">{selCount} selected</span>}
                </span>
              </div>
            </button>
            <div className="ctq__pool-cat-input">
              <button className="ctq__pool-cat-btn" onClick={(e) => { e.stopPropagation(); decrementCat(cat.id); }} disabled={count <= 0}>−</button>
              <span className="ctq__pool-cat-num">{count}</span>
              <button className="ctq__pool-cat-btn" onClick={(e) => { e.stopPropagation(); incrementCat(cat.id, selCount); }} disabled={count >= selCount}>+</button>
            </div>
          </div>
        </div>
        {expanded && cat.questions.length > 0 && (
          <div className="ctq__pool-question-wrap">
            <div className="ctq__pool-question-list">
              <label className="ctq__pool-question-item ctq__pool-select-all">
                <span className={`ctq__checkbox ${selCount === cat.questions.length ? 'ctq__checkbox--checked' : ''}`}>
                  {selCount === cat.questions.length && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="ctq__pool-select-all-label">Select all</span>
                <input
                  type="checkbox"
                  checked={selCount === cat.questions.length}
                  onChange={() => {
                    if (selCount === cat.questions.length) {
                      setSelectedQuestionIds((prev) => prev.filter((id) => !cat.questions.some((q) => q.id === id)));
                    } else {
                      setSelectedQuestionIds((prev) => {
                        const ids = new Set(prev);
                        cat.questions.forEach((q) => ids.add(q.id));
                        return [...ids];
                      });
                    }
                  }}
                  className="ctq__pool-hidden-checkbox"
                />
              </label>
              {cat.questions.map((q) => (
                <label key={q.id} className="ctq__pool-question-item">
                  <span className={`ctq__checkbox ${selectedQuestionIds.includes(q.id) ? 'ctq__checkbox--checked' : ''}`}>
                    {selectedQuestionIds.includes(q.id) && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="ctq__pool-question-body">
                    <span className="ctq__pool-question-title">{q.title}</span>
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
                    className="ctq__pool-hidden-checkbox"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ctq">
      <div className="ctq__header">
        <ProgressTracker currentStep={2} />
        <h1>Add questions</h1>
        <p>Choose how questions are sourced and build your test content.</p>
      </div>

      {error && <p className="ctq__empty" style={{ color: 'var(--red-300)', border: 'none' }}>{error}</p>}

      <button className="ctq__details-btn" onClick={() => setShowDetails((s) => !s)}>
        <Info size={14} />
        {showDetails ? 'Hide audience details' : 'Show audience details'}
      </button>

      {showDetails && (
        <div className="ctq__details">
          <div className="ctq__details-row">
            <span className="ctq__details-label">Title</span>
            <span>{draft.title || '—'}</span>
          </div>
          <div className="ctq__details-row">
            <span className="ctq__details-label">Institutions</span>
            <span>{institutionNames.join(', ') || '—'}</span>
          </div>
          <div className="ctq__details-row">
            <span className="ctq__details-label">Departments</span>
            <span>{departmentNames.join(', ') || '—'}</span>
          </div>
          <div className="ctq__details-row">
            <span className="ctq__details-label">Batches</span>
            <span>{batchNames.join(', ') || '—'}</span>
          </div>
        </div>
      )}

      {/* Question source toggle */}
      <div className="ctq__section">
        <label className="ctq__label">Question source</label>
        <div className="ctq__toggle">
          <button
            className={`ctq__toggle-btn ${questionSource === 'manual' ? 'ctq__toggle-btn--active' : ''}`}
            onClick={() => setQuestionSource('manual')}
          >
            Add questions manually
          </button>
          <button
            className={`ctq__toggle-btn ${questionSource === 'pool' ? 'ctq__toggle-btn--active' : ''}`}
            onClick={() => setQuestionSource('pool')}
          >
            Use question pool
          </button>
        </div>
      </div>

      {/* Pool mode */}
      {questionSource === 'pool' && (
        <div className="ctq__pool-config">
          <div className="ctq__field">
            {poolsLoading ? (
              <p className="ctq__hint" style={{ marginTop: 8 }}>Loading pools…</p>
            ) : pools.length === 0 ? (
              <p className="ctq__hint" style={{ color: 'var(--red-300)', marginTop: 8 }}>No pools available. Create one in Question Pools first.</p>
            ) : (
              <MultiSelect
                label="Select question pools"
                options={pools.map((p) => ({ id: p.id, name: p.name }))}
                selected={selectedPoolIds}
                onChange={setSelectedPoolIds}
                placeholder="— Select pools —"
              />
            )}
          </div>

          {selectedPoolIds.length > 0 && (
            <div className="ctq__selected-pools">
              {selectedPoolIds.map((pid) => {
                const pool = pools.find((p) => p.id === pid);
                const pd = poolDetailsMap[pid];
                const isExpanded = expandedPoolId === pid;
                return (
                  <div key={pid} className="ctq__pool-section">
                    <div className="ctq__pool-section-header">
                      <button className="ctq__pool-section-toggle" onClick={() => setExpandedPoolId(isExpanded ? null : pid)}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span className="ctq__pool-section-name">{pool?.name || pid}</span>
                        {pd && <span className="ctq__pool-section-count">{pd.categories.length} categories</span>}
                      </button>
                      <button className="ctq__pool-section-remove" onClick={() => removePool(pid)} title="Remove pool">
                        <X size={14} />
                      </button>
                    </div>
                    {isExpanded && pd && (
                      <div className="ctq__pool-section-body">
                        {pd.categories.map((cat) => renderCategory(cat, pid))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedPoolIds.length > 0 && (
            <p className="ctq__pool-note">
              <Info size={13} strokeWidth={3} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--teal-500)' }} />
              Click to expand categories to select questions and set mandatory counts on categories.
            </p>
          )}
        </div>
      )}

      {/* Manual mode */}
      {questionSource === 'manual' && (
        <>
          <div className="ctq__list">
            {draft.questions.length === 0 && (
              <div className="ctq__empty">No questions added yet. Add your first question below.</div>
            )}
            {draft.questions.map((q, i) => (
              <div className="ctq__item" key={q.id}>
                <span className="ctq__item-num">{i + 1}</span>
                <div className="ctq__item-body">
                  <span className="ctq__item-title">{q.title}</span>
                  <span className="ctq__item-meta">{q.type === 'CODING' ? 'Coding' : 'Subjective'} · {q.points} pts · {q.timeAllottedMinutes} min · {q.testCases?.length ?? 0} internal test{(q.testCases?.length ?? 0) !== 1 ? 's' : ''}</span>
                </div>
                <button
                  className="ctq__item-remove"
                  onClick={() => handleRemove(q.id)}
                  disabled={removingId === q.id}
                  aria-label={`Remove ${q.title}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <button className="ctq__add" onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            Add question
          </button>
        </>
      )}

      <div className="ctq__footer">
        <button className="ctq__back" onClick={() => navigate('/admin/create')}>
          <ChevronLeft size={15} /> Back
        </button>
        <button
          className="ctq__next"
          disabled={
            saving ||
            (questionSource === 'pool' && selectedPoolIds.length === 0) ||
            (questionSource === 'manual' && draft.questions.length === 0)
          }
          onClick={handleProceed}
        >
          {saving ? 'Saving…' : 'Next: Review'} <ChevronRight size={15} />
        </button>
      </div>

      {showAddModal && (
        <AddQuestionModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
