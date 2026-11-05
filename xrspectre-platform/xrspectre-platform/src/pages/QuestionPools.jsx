import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, X, Database, FolderOpen, ChevronDown, ChevronRight, AlertCircle, Code2 } from 'lucide-react';
import * as poolsApi from '../api/pools';
import CustomSelect from '../components/CustomSelect';
import { generateTemplates, RETURN_TYPES, PARAM_TYPES } from '../utils/templateGenerator';
import './QuestionPools.css';

export default function QuestionPools() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPoolId, setExpandedPoolId] = useState(null);
  const [poolDetails, setPoolDetails] = useState(null);
  const [popupCategory, setPopupCategory] = useState(null); // { poolId, category } | null

  // modals
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(null); // null | { poolId, categoryId } | { poolId, question }
  const [deleting, setDeleting] = useState(null);
  const [modalReturnCategoryId, setModalReturnCategoryId] = useState(null); // category id to restore popup after question modal

  const loadPools = () => {
    return poolsApi.listPools()
      .then(setPools)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPools(); }, []);

  const togglePool = async (poolId) => {
    if (expandedPoolId === poolId) {
      setExpandedPoolId(null);
      setPoolDetails(null);
      return;
    }
    setExpandedPoolId(poolId);
    try {
      const details = await poolsApi.getPoolDetails(poolId);
      setPoolDetails(details);
      setPopupCategory(null);
    } catch (err) { setError(err.message); }
  };

  const refreshPool = async () => {
    if (!expandedPoolId) return;
    try {
      const details = await poolsApi.getPoolDetails(expandedPoolId);
      setPoolDetails(details);
      setPopupCategory((prev) => {
        if (!prev) return null;
        const found = details.categories.find((c) => c.id === prev.category.id);
        return found ? { ...prev, category: found } : null;
      });
    } catch (err) { setError(err.message); }
  };

  const handleDeletePool = async (poolId) => {
    if (!window.confirm('Delete this pool and all its questions?')) return;
    setDeleting(poolId);
    try {
      await poolsApi.deletePool(poolId);
      if (expandedPoolId === poolId) { setExpandedPoolId(null); setPoolDetails(null); }
      loadPools();
    } catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category and all its questions?')) return;
    setDeleting(categoryId);
    try {
      await poolsApi.deleteCategory(categoryId);
      loadPools();
      refreshPool();
    } catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;
    setDeleting(questionId);
    try {
      await poolsApi.deleteQuestion(questionId);
      loadPools();
      refreshPool();
    } catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };

  const tryOpenCategoryPopup = (catId) => {
    if (catId && poolDetails) {
      const found = poolDetails.categories.find(c => c.id === catId);
      if (found) setPopupCategory({ poolId: poolDetails.id, category: found });
    }
  };

  return (
    <div className="qpools">
      <div className="qpools__header">
        <h1><Database size={18} /> Question Pools</h1>
        <button className="qpools__btn qpools__btn--primary" onClick={() => setShowCreatePool(true)}>
          <Plus size={14} /> New Pool
        </button>
      </div>

      {error && <div className="qpools__banner qpools__banner--error"><AlertCircle size={14} /> {error}</div>}

      {/* ── Create Pool Modal ── */}
      {showCreatePool && <CreatePoolModal onClose={() => setShowCreatePool(false)} onDone={() => { setShowCreatePool(false); loadPools(); }} />}

      {/* ── Add Category Modal ── */}
      {showAddCategory && (
        <AddCategoryModal
          poolId={expandedPoolId}
          onClose={() => setShowAddCategory(false)}
          onDone={() => { setShowAddCategory(false); loadPools(); refreshPool(); }}
        />
      )}

      {/* ── Question Modal (add / edit) ── */}
      {showQuestionModal && (
        <QuestionModal
          poolId={showQuestionModal.poolId}
          categoryId={showQuestionModal.categoryId || ''}
          editQuestion={showQuestionModal.question || null}
          onClose={() => { const catId = modalReturnCategoryId; setShowQuestionModal(null); setModalReturnCategoryId(null); tryOpenCategoryPopup(catId); }}
          onDone={async () => { const catId = modalReturnCategoryId; setShowQuestionModal(null); setModalReturnCategoryId(null); await loadPools(); if (expandedPoolId && catId) { try { const details = await poolsApi.getPoolDetails(expandedPoolId); setPoolDetails(details); const found = details.categories.find(c => c.id === catId); if (found) setPopupCategory({ poolId: details.id, category: found }); } catch (err) { setError(err.message); } } }}
        />
      )}

      {/* ── Category Questions Popup ── */}
      {popupCategory && (
        <CategoryQuestionsPopup
          poolId={popupCategory.poolId}
          category={popupCategory.category}
          deleting={deleting}
          lockedCategoryIds={poolDetails?.lockedCategoryIds || []}
          onEdit={(q) => { setModalReturnCategoryId(popupCategory.category.id); setPopupCategory(null); setShowQuestionModal({ poolId: popupCategory.poolId, question: q }); }}
          onDelete={handleDeleteQuestion}
          onAddQuestion={() => { setModalReturnCategoryId(popupCategory.category.id); setPopupCategory(null); setShowQuestionModal({ poolId: popupCategory.poolId, categoryId: popupCategory.category.id, question: null }); }}
          onClose={() => setPopupCategory(null)}
          onDone={() => { loadPools(); refreshPool(); }}
        />
      )}

      <div className="qpools__list">
        {loading && <p className="qpools__loading">Loading pools…</p>}

        {!loading && pools.length === 0 && (
          <div className="qpools__empty">No question pools yet. Create your first pool to start building a question bank.</div>
        )}

        {pools.map((pool) => (
          <div key={pool.id} className="qpools__pool">
            <div className="qpools__pool-header" onClick={() => togglePool(pool.id)}>
              <div className="qpools__pool-info">
                <FolderOpen size={16} className="qpools__pool-icon" />
                <span className="qpools__pool-name">{pool.name}</span>
                <span className="qpools__badge">{pool.categoryCount} categor{pool.categoryCount !== 1 ? 'ies' : 'y'}</span>
              </div>
              <div className="qpools__pool-actions">
                <button className="qpools__icon-btn" onClick={(e) => { e.stopPropagation(); handleDeletePool(pool.id); }} disabled={deleting === pool.id || pool.hasActiveTest} title={pool.hasActiveTest ? 'Pool is locked by an active test' : 'Delete pool'}>
                  <Trash2 size={14} />
                </button>
                {expandedPoolId === pool.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </div>

            {expandedPoolId === pool.id && poolDetails && (
              <div className="qpools__pool-body">
                {poolDetails.description && <p className="qpools__desc">{poolDetails.description}</p>}

                  {poolDetails.hasActiveTest && (
                  <div className="qpools__banner qpools__banner--error" style={{ marginBottom: 12 }}>
                    <AlertCircle size={14} /> This pool is linked to an active or scheduled test ("{poolDetails.activeTest?.title}"). Categories used in the test are locked.
                  </div>
                )}

                <div className="qpools__categories-section">
                  <div className="qpools__section-head">
                    <span className="qpools__section-title">Categories</span>
                    <button className="qpools__btn qpools__btn--sm" onClick={() => setShowAddCategory(true)} disabled={poolDetails.hasActiveTest} title={poolDetails.hasActiveTest ? 'Pool is locked by an active test' : 'Add category'}>
                      <Plus size={12} /> Add category
                    </button>
                  </div>

                  {poolDetails.categories.length === 0 && <p className="qpools__empty">No categories yet.</p>}

                  {poolDetails.categories.map((cat) => {
                    const isCatLocked = poolDetails.lockedCategoryIds?.includes(cat.id);
                    return (
                    <div key={cat.id} className="qpools__category">
                      <div className="qpools__category-header" onClick={() => setPopupCategory({ poolId: poolDetails.id, category: cat })}>
                        <span className="qpools__category-name">{cat.name}</span>
                        <span className="qpools__badge qpools__badge--sm">{cat.questions.length} question{cat.questions.length !== 1 ? 's' : ''}</span>
                        <div className="qpools__category-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="qpools__icon-btn" onClick={() => handleDeleteCategory(cat.id)} disabled={deleting === cat.id || isCatLocked} title={isCatLocked ? 'This category is used in an active test' : 'Delete category'}>
                            <Trash2 size={12} />
                          </button>
                          <ChevronRight size={14} className="qpools__chevron" />
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Category Questions Popup ─── */
function CategoryQuestionsPopup({ poolId, category, deleting, lockedCategoryIds, onEdit, onDelete, onAddQuestion, onClose, onDone }) {
  const isCategoryLocked = lockedCategoryIds.includes(category.id);
  return (
    <div className="qpools__overlay" onClick={onClose}>
      <div className="qpools__modal qpools__modal--questions" onClick={(e) => e.stopPropagation()}>
        <div className="qpools__modal-header">
          <div className="qpools__modal-header-info">
            <h2>{category.name}</h2>
            <span className="qpools__badge qpools__badge--sm">{category.questions.length} question{category.questions.length !== 1 ? 's' : ''}</span>
          </div>
          <button className="qpools__icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {isCategoryLocked && (
          <div className="qpools__banner qpools__banner--error" style={{ margin: '0 1rem', marginTop: '1rem' }}>
            <AlertCircle size={14} /> This category is used in an active test. Questions cannot be edited or deleted until the test ends.
          </div>
        )}

        <div className="qpools__qpopup-body">
          {category.questions.length === 0 ? (
            <div className="qpools__qpopup-empty">
              <p>No questions in this category yet.</p>
            </div>
          ) : (
            <div className="qpools__qpopup-list">
              {category.questions.map((q) => (
                <div key={q.id} className="qpools__qpopup-item">
                  <div className="qpools__qpopup-item-info">
                    <span className="qpools__question-title">{q.title}</span>
                    <div className="qpools__qpopup-item-badges">
                       <span className={`qpools__diff qpools__diff--${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                       <span className={`qpools__type qpools__type--${q.type.toLowerCase()}`}>{q.type === 'CODING' ? 'Coding' : 'Subjective'}</span>
                       <span className="qpools__meta qpools__meta--pts">{q.points} pts</span>
                       <span className="qpools__meta qpools__meta--time">{q.timeAllottedMinutes} min</span>
                       {q.type !== 'SUBJECTIVE' && <span className="qpools__meta qpools__meta--tc">{q.testCases.length} tc{q.testCases.length !== 1 ? 's' : ''}</span>}
                     </div>
                  </div>
                  <div className="qpools__qpopup-item-actions">
                    <button className="qpools__icon-btn" onClick={() => onEdit(q)} disabled={isCategoryLocked} title={isCategoryLocked ? 'This category is used in an active test' : 'Edit question'}>
                      <Pencil size={13} />
                    </button>
                    <button className="qpools__icon-btn qpools__icon-btn--danger" onClick={() => onDelete(q.id)} disabled={deleting === q.id || isCategoryLocked} title={isCategoryLocked ? 'This category is used in an active test' : 'Delete question'}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="qpools__modal-footer">
          <button type="button" className="qpools__btn" onClick={onClose}>Close</button>
          <button type="button" className="qpools__btn qpools__btn--primary" onClick={onAddQuestion} disabled={isCategoryLocked} title={isCategoryLocked ? 'This category is used in an active test' : 'Add question'}>
            <Plus size={14} /> Add question
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Pool Modal ─── */
function CreatePoolModal({ onClose, onDone }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await poolsApi.createPool({ name: name.trim(), description: description.trim() });
      onDone();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="qpools__overlay" onClick={onClose}>
      <div className="qpools__modal" onClick={(e) => e.stopPropagation()}>
        <div className="qpools__modal-header">
          <h2>Create question pool</h2>
          <button className="qpools__icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="qpools__banner qpools__banner--error"><AlertCircle size={14} /> {error}</div>}
          <div className="qpools__modal-body">
            <div className="qpools__field">
              <label className="qpools__label">Pool name</label>
              <input className="qpools__input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>
            <div className="qpools__field">
              <label className="qpools__label">Description (optional)</label>
              <textarea className="qpools__textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="qpools__modal-footer">
            <button type="button" className="qpools__btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="qpools__btn qpools__btn--primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Add Category Modal ─── */
function AddCategoryModal({ poolId, onClose, onDone }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await poolsApi.createCategory(poolId, { name: name.trim() });
      onDone();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="qpools__overlay" onClick={onClose}>
      <div className="qpools__modal qpools__modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="qpools__modal-header">
          <h2>Add category</h2>
          <button className="qpools__icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="qpools__banner qpools__banner--error"><AlertCircle size={14} /> {error}</div>}
          <div className="qpools__modal-body">
            <div className="qpools__field">
              <label className="qpools__label">Category name</label>
              <input className="qpools__input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>
          </div>
          <div className="qpools__modal-footer">
            <button type="button" className="qpools__btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="qpools__btn qpools__btn--primary" disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Question Modal (add / edit) ─── */
function QuestionModal({ poolId, categoryId: presetCategoryId, editQuestion, onClose, onDone }) {
  const [title, setTitle] = useState(editQuestion?.title ?? '');
  const [statement, setStatement] = useState(editQuestion?.statement ?? '');
  const [points, setPoints] = useState(editQuestion?.points ?? 20);
  const [time, setTime] = useState(editQuestion?.timeAllottedMinutes ?? 20);
  const [difficulty, setDifficulty] = useState(editQuestion?.difficulty ?? 'EASY');

  const [questionType, setQuestionType] = useState(editQuestion?.type ?? 'CODING');
  const [modelAnswer, setModelAnswer] = useState(editQuestion?.modelAnswer ?? '');
  const [testCases, setTestCases] = useState(editQuestion?.testCases ?? [{ input: '', output: '', isSample: true }]);
  const [functionSignature, setFunctionSignature] = useState(editQuestion?.functionSignature ?? null);
  const [functionTemplates, setFunctionTemplates] = useState(
    editQuestion?.functionSignature?.name ? generateTemplates(editQuestion.functionSignature) : (editQuestion?.functionTemplates ?? null)
  );
  const [showFuncPreview, setShowFuncPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFuncChange = (field, value) => {
    const updated = { ...functionSignature, [field]: value };
    setFunctionSignature(updated);
    setFunctionTemplates(generateTemplates(updated));
  };

  const updateFuncParam = (index, field, value) => {
    const params = [...(functionSignature?.params || [])];
    params[index] = { ...params[index], [field]: value };
    handleFuncChange('params', params);
  };

  const addFuncParam = () => {
    const params = [...(functionSignature?.params || []), { name: '', type: 'int' }];
    handleFuncChange('params', params);
  };

  const removeFuncParam = (index) => {
    const params = (functionSignature?.params || []).filter((_, i) => i !== index);
    handleFuncChange('params', params);
  };

  const addTestCase = () => setTestCases([...testCases, { input: '', output: '', isSample: false }]);
  const updateTestCase = (i, field, value) => {
    setTestCases(testCases.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc));
  };
  const removeTestCase = (i) => setTestCases(testCases.filter((_, idx) => idx !== i));

  // Load categories for pool so user can pick one
  // For the pool question create, we might need a categoryId
  // Since we're passing it from the parent, we need a category picker
  // Actually, the add button is inside a category, so categoryId is known from the context
  // But edit also needs a categoryId... let me handle this by including a categoryId in the question object
  const [categoryId, setCategoryId] = useState(editQuestion?.categoryId ?? presetCategoryId ?? '');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (poolId) {
      poolsApi.getPoolDetails(poolId).then((d) => setCategories(d.categories)).catch(() => {});
    }
  }, [poolId]);

  const validTestCases = testCases.filter((t) => t.input.trim() && t.output.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !statement.trim()) return;
    if (questionType !== 'SUBJECTIVE' && validTestCases.length === 0) return;
    if (functionSignature?.name !== undefined) {
      if (!functionSignature.name.trim()) { setError('Function name cannot be empty.'); return; }
      const hasEmptyParam = (functionSignature.params || []).some((p) => !p.name.trim());
      if (hasEmptyParam) { setError('Parameters cannot have empty names.'); return; }
    }
    setSaving(true);
    setError('');
    const payload = {
      title: title.trim(),
      statement: statement.trim(),
      points,
      timeAllottedMinutes: time,
      difficulty,
      type: questionType,
      modelAnswer: questionType === 'SUBJECTIVE' ? modelAnswer : undefined,
      functionSignature: functionSignature?.name !== undefined ? functionSignature : undefined,
      testCases: questionType === 'SUBJECTIVE' ? [] : validTestCases.map((tc) => ({ input: tc.input, output: tc.output, isSample: tc.isSample })),
      categoryId: editQuestion ? editQuestion.categoryId : categoryId,
    };
    try {
      if (editQuestion) {
        await poolsApi.updateQuestion(editQuestion.id, payload);
      } else {
        await poolsApi.createQuestion(poolId, payload);
      }
      onDone();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

   return (
    <div className="qpools__overlay" onClick={onClose}>
      <div className="qpools__modal qpools__modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="qpools__modal-header">
          <h2>{editQuestion ? 'Edit question' : 'Add question'}</h2>
          <button className="qpools__icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="qpools__modal-body">
            {!editQuestion && (!presetCategoryId ? (
              <div className="qpools__field">
                <label className="qpools__label">Category</label>
                <CustomSelect
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={(v) => setCategoryId(v)}
                  placeholder="— Select category —"
                />
              </div>
            ) : (
              <div className="qpools__field">
                <label className="qpools__label">Category</label>
                <p className="qpools__static-field">{categories.find((c) => c.id === presetCategoryId)?.name ?? '…'}</p>
              </div>
            ))}
            <div className="qpools__field">
              <label className="qpools__label">Title</label>
              <input className="qpools__input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
            </div>
            <div className="qpools__field">
              <label className="qpools__label">Problem statement</label>
              <textarea className="qpools__textarea" value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} required />
            </div>
            <div className="qpools__row qpools__row--3">
              <div className="qpools__field">
                <label className="qpools__label">Points</label>
                <input className="qpools__input" type="number" min={0} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
              </div>
              <div className="qpools__field">
                <label className="qpools__label">Time (min)</label>
                <input className="qpools__input" type="number" min={1} value={time} onChange={(e) => setTime(Number(e.target.value))} />
              </div>
              <div className="qpools__field">
                <label className="qpools__label">Difficulty</label>
                <CustomSelect
                  options={[
                    { value: 'EASY', label: 'Easy' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HARD', label: 'Hard' },
                  ]}
                  value={difficulty}
                  onChange={(v) => setDifficulty(v)}
                />
              </div>
            </div>
            <div className="qpools__field">
              <label className="qpools__label">Question type</label>
              <div className="qpools__type-toggle">
                <button type="button" className={`qpools__type-btn ${questionType === 'CODING' ? 'qpools__type-btn--active' : ''}`} onClick={() => setQuestionType('CODING')}>Coding</button>
                <button type="button" className={`qpools__type-btn ${questionType === 'SUBJECTIVE' ? 'qpools__type-btn--active' : ''}`} onClick={() => setQuestionType('SUBJECTIVE')}>Subjective</button>
              </div>
            </div>
            {questionType === 'SUBJECTIVE' && (
              <div className="qpools__field">
                <label className="qpools__label">Model answer</label>
                <textarea className="qpools__textarea" value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} rows={3} placeholder="Reference answer for this subjective question…" />
              </div>
            )}
            {questionType !== 'SUBJECTIVE' && (
              <>
                <div className="qpools__func-section">
                  <div className="qpools__func-header">
                    <Code2 size={16} />
                    <span>Function template</span>
                    <label className="qpools__toggle">
                      <input
                        type="checkbox"
                        checked={functionSignature?.name !== undefined}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Restore saved name + returnType/params
                            const { _savedName, ...rest } = functionSignature || {};
                            const restored = { ...rest, name: _savedName || '' };
                            setFunctionSignature(restored);
                            setFunctionTemplates(generateTemplates(restored));
                          } else {
                            // Save the name so we can restore it on re-enable
                            if (functionSignature) {
                              setFunctionSignature({ ...functionSignature, name: undefined, _savedName: functionSignature.name });
                            }
                            setFunctionTemplates(null);
                          }
                        }}
                      />
                      Enable
                    </label>
                  </div>
                  {functionSignature?.name !== undefined && (
                    <div className="qpools__func-body">
                      <div className="qpools__row qpools__row--2">
                        <div className="qpools__field">
                          <label className="qpools__label">Function name</label>
                          <input className="qpools__input" value={functionSignature.name || ''} onChange={(e) => handleFuncChange('name', e.target.value)} placeholder="e.g. twoSum" />
                        </div>
                        <div className="qpools__field">
                          <label className="qpools__label">Return type</label>
                          <CustomSelect
                            options={RETURN_TYPES.map((t) => ({ value: t, label: t }))}
                            value={functionSignature?.returnType || 'int'}
                            onChange={(v) => handleFuncChange('returnType', v)}
                          />
                        </div>
                      </div>
                      <label className="qpools__label">Parameters</label>
                      {(functionSignature?.params || []).map((p, i) => (
                        <div className="qpools__param-row" key={i}>
                          <input className="qpools__input qpools__input--param-name" value={p.name} onChange={(e) => updateFuncParam(i, 'name', e.target.value)} placeholder="name" />
                          <CustomSelect
                            options={PARAM_TYPES.map((t) => ({ value: t, label: t }))}
                            value={p.type}
                            onChange={(v) => updateFuncParam(i, 'type', v)}
                          />
                          <button type="button" className="qpools__icon-btn qpools__icon-btn--danger" onClick={() => removeFuncParam(i)}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button type="button" className="qpools__btn qpools__btn--sm qpools__btn--add-tc" onClick={addFuncParam}>
                        <Plus size={12} /> Add parameter
                      </button>
                      {functionTemplates?.python && (
                        <div className="qpools__func-preview">
                          <div className="qpools__preview-header">
                            <span>Generated templates</span>
                            <button type="button" className="qpools__preview-toggle" onClick={() => setShowFuncPreview(!showFuncPreview)}>
                              {showFuncPreview ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          {showFuncPreview && ['python', 'javascript', 'java', 'cpp', 'c'].map((lang) => (
                            <div className="qpools__preview-lang" key={lang}>
                              <span className="qpools__preview-lang-label">{lang}</span>
                              <pre className="qpools__preview-code">{functionTemplates[lang]}</pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="qpools__field">
                  <label className="qpools__label">Test cases</label>
                {testCases.map((tc, i) => (
                  <div key={i} className="qpools__testcase">
                    <input className="qpools__input qpools__input--sm" placeholder="Input" value={tc.input} onChange={(e) => updateTestCase(i, 'input', e.target.value)} />
                    <input className="qpools__input qpools__input--sm" placeholder="Output" value={tc.output} onChange={(e) => updateTestCase(i, 'output', e.target.value)} />
                    <label className="qpools__checkbox-label">
                      <input type="checkbox" checked={tc.isSample} onChange={(e) => updateTestCase(i, 'isSample', e.target.checked)} />
                      Sample
                    </label>
                    <button type="button" className="qpools__icon-btn qpools__icon-btn--danger" onClick={() => removeTestCase(i)} disabled={testCases.length <= 1}><X size={12} /></button>
                  </div>
                ))}
                <button type="button" className="qpools__btn qpools__btn--sm qpools__btn--add-tc" onClick={addTestCase}><Plus size={12} /> Add test case</button>
              </div>
            </>
            )}
          </div>
          {error && <div className="qpools__banner qpools__banner--error" style={{ margin: '0 1rem' }}><AlertCircle size={14} /> {error}</div>}
          <div className="qpools__modal-footer">
            <button type="button" className="qpools__btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="qpools__btn qpools__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : (editQuestion ? 'Save changes' : 'Add question')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
