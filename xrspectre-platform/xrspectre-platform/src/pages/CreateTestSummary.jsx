import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, Users, Database, FileQuestion, CheckCircle2 } from 'lucide-react';
import { useTestDraft } from '../context/TestDraftContext';
import * as orgApi from '../api/org';
import * as poolsApi from '../api/pools';
import ProgressTracker from '../components/ProgressTracker';
import './CreateTestSummary.css';

export default function CreateTestSummary() {
  const navigate = useNavigate();
  const { draft, publishTest, resetDraft } = useTestDraft();
  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [poolNames, setPoolNames] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    orgApi.getInstitutions().then(setInstitutions).catch(() => {});
    orgApi.getDepartments().then(setDepartments).catch(() => {});
    orgApi.getBatches().then(setBatches).catch(() => {});
    const pids = draft.selectedPoolIds || [];
    if (pids.length > 0) {
      Promise.all(pids.map((pid) => poolsApi.getPoolDetails(pid))).then((details) => {
        setPoolNames(details.map((d) => d.name));
      }).catch(() => {});
    }
  }, []);

  const audienceParts = useMemo(() => {
    const instNames = institutions.filter((i) => draft.institutionIds.includes(i.id)).map((i) => i.name);
    const deptNames = departments.filter((d) => draft.departmentIds.includes(d.id)).map((d) => d.name);
    const batchNames = batches.filter((b) => draft.batchIds.includes(b.id)).map((b) => b.name);
    return { institutions: instNames, departments: deptNames, batches: batchNames };
  }, [institutions, departments, batches, draft]);

  const totalPoints = useMemo(() => {
    if (draft.questionSource === 'pool') return 'Varies per student';
    return draft.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  }, [draft]);

  const handlePublish = async () => {
    setError('');
    setPublishing(true);
    try {
      await publishTest({ startTime: draft.startTime, endTime: draft.endTime, maxWarnings: draft.maxWarnings, securityEnabled: draft.securityEnabled });
      resetDraft();
      navigate('/admin/tests', { state: { justPublished: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (!draft.testId) {
    return (
      <div className="ctsum">
        <p className="ctsum__empty">No test draft found. Start from the beginning.</p>
        <button className="ctsum__back" onClick={() => navigate('/admin/create')}>
          <ChevronLeft size={15} /> Go to step 1
        </button>
      </div>
    );
  }

  return (
    <div className="ctsum">
      <div className="ctsum__header">
        <ProgressTracker currentStep={3} />
        <h1>Review your test</h1>
        <p>Check all the details before publishing. Once published, students in the selected audience will be able to access the test during the scheduled window.</p>
      </div>

      {error && <p className="ctsum__error">{error}</p>}

      <div className="ctsum__card">
        <h3 className="ctsum__card-title"><FileQuestion size={16} /> Test details</h3>
        <div className="ctsum__row">
          <span className="ctsum__label">Title</span>
          <span className="ctsum__value">{draft.title || 'Untitled test'}</span>
        </div>
      </div>

      <div className="ctsum__card">
        <h3 className="ctsum__card-title"><Users size={16} /> Audience</h3>
        {audienceParts.institutions.length > 0 && (
          <div className="ctsum__row">
            <span className="ctsum__label">Institutions</span>
            <span className="ctsum__value">{audienceParts.institutions.join(', ')}</span>
          </div>
        )}
        {audienceParts.departments.length > 0 && (
          <div className="ctsum__row">
            <span className="ctsum__label">Departments</span>
            <span className="ctsum__value">{audienceParts.departments.join(', ')}</span>
          </div>
        )}
        {audienceParts.batches.length > 0 && (
          <div className="ctsum__row">
            <span className="ctsum__label">Batches</span>
            <span className="ctsum__value">{audienceParts.batches.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="ctsum__card">
        <h3 className="ctsum__card-title"><Database size={16} /> Questions</h3>
        <div className="ctsum__row">
          <span className="ctsum__label">Source</span>
          <span className="ctsum__value">{draft.questionSource === 'pool' ? `Pools: ${poolNames.length > 0 ? poolNames.join(', ') : '...'}` : 'Manually added'}</span>
        </div>
        {draft.questionSource === 'pool' ? (
          <>
            <div className="ctsum__row">
              <span className="ctsum__label">Allocation</span>
              <span className="ctsum__value">{draft.questionsPerStudent} Questions</span>
            </div>

          </>
        ) : (
          <div className="ctsum__row">
            <span className="ctsum__label">Questions</span>
            <span className="ctsum__value">{draft.questions.length} question{draft.questions.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="ctsum__row">
          <span className="ctsum__label">Total points</span>
          <span className="ctsum__value">{totalPoints}</span>
        </div>
      </div>

      <div className="ctsum__card">
        <h3 className="ctsum__card-title"><Clock size={16} /> Schedule</h3>
        <div className="ctsum__row">
          <span className="ctsum__label">Starts</span>
          <span className="ctsum__value">{formatDate(draft.startTime)}</span>
        </div>
        <div className="ctsum__row">
          <span className="ctsum__label">Ends</span>
          <span className="ctsum__value">{formatDate(draft.endTime)}</span>
        </div>
      </div>

      <div className="ctsum__footer">
        <button className="ctsum__back" onClick={() => navigate('/admin/create/questions')}>
          <ChevronLeft size={15} /> Back
        </button>
        <button className="ctsum__publish" disabled={publishing} onClick={handlePublish}>
          <CheckCircle2 size={16} /> {publishing ? 'Publishing\u2026' : 'Publish test'}
        </button>
      </div>
    </div>
  );
}