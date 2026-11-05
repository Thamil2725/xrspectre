import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react';
import * as mentorApi from '../api/mentor';
import './MentorStudentDetail.css';

export default function MentorStudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedAttempt, setExpandedAttempt] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    mentorApi.getStudentAttempts(studentId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const loadDetails = async (attemptId) => {
    if (expandedAttempt === attemptId) {
      setExpandedAttempt(null);
      setDetails(null);
      return;
    }
    setExpandedAttempt(attemptId);
    setDetailsLoading(true);
    try {
      const d = await mentorApi.getAttemptDetails(studentId, attemptId);
      setDetails(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const fmtTime = (secs) => {
    if (!secs) return '—';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || !h && !m) parts.push(`${s}s`);
    return parts.join(' ');
  };

  const attemptStatus = (a) => {
    if (a.disqualifiedAt) return { label: 'Disqualified', color: 'red' };
    if (a.submittedAt) return { label: 'Submitted', color: 'green' };
    if (a.startedAt) return { label: 'In progress', color: 'blue' };
    return { label: 'Not started', color: 'muted' };
  };

  if (loading) return <p className="mstd__loading">Loading…</p>;
  if (error && !data) return <div className="mstd__banner mstd__banner--error"><AlertCircle size={14} /> {error}</div>;
  if (!data) return null;

  return (
    <div className="mstd">
      <button className="mstd__back" onClick={() => navigate('/mentor/students')}>
        <ArrowLeft size={14} /> Back to students
      </button>

      <div className="mstd__header">
        <div className="mstd__avatar-lg">{data.student.name?.charAt(0)?.toUpperCase() || '?'}</div>
        <div>
          <h1>{data.student.name}</h1>
          <p className="mstd__meta">{data.student.department} · {data.student.batch}</p>
          <p className="mstd__meta">{data.student.email}</p>
        </div>
      </div>

      {error && <div className="mstd__banner mstd__banner--error"><AlertCircle size={14} /> {error}</div>}

      <div className="mstd__section">
        <h2>Test attempts</h2>
        {data.attempts.length === 0 && (!data.pendingTests || data.pendingTests.length === 0) ? (
          <div className="mstd__empty">No tests yet.</div>
        ) : (
          <div className="mstd__attempts">
            {data.attempts.map((a) => {
              const status = attemptStatus(a);
              const score = a.totalScore;
              const isOpen = expandedAttempt === a.id;
              return (
                <div key={a.id} className={`mstd__attempt ${isOpen ? 'mstd__attempt--open' : ''}`}>
                  <div className="mstd__attempt-row" onClick={() => loadDetails(a.id)}>
                    <div className="mstd__attempt-info">
                      <span className="mstd__attempt-title">{a.testTitle}</span>
                      <span className="mstd__attempt-date">Started {fmtDate(a.startedAt)}</span>
                    </div>
                    <div className="mstd__attempt-stats">
                      <span className={`mstd__tag mstd__tag--${status.color}`}>{status.label}</span>
                      {score !== null && <span className="mstd__attempt-score">{score}</span>}
                      <ChevronRight size={14} className={`mstd__chevron ${isOpen ? 'mstd__chevron--open' : ''}`} />
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mstd__attempt-detail">
                      {detailsLoading ? (
                        <p className="mstd__loading-inline">Loading details…</p>
                      ) : details ? (
                        <div className="mstd__questions">
                          {details.questionDetails.map((q, i) => (
                            <div key={q.questionId} className="mstd__question">
                              <div className="mstd__question-head">
                                <span className="mstd__qnum">Q{i + 1}</span>
                                <span className="mstd__qtitle">{q.title}</span>
                                <span className="mstd__qscore">{q.bestScore}/{q.points}</span>
                              </div>
                              <div className="mstd__question-meta">
                                <span>{q.totalSubmissions} submission{q.totalSubmissions !== 1 ? 's' : ''}</span>
                                <span>{q.bestPassedCount}/{q.bestTotalCount} test cases passed</span>
                                <span>Time: {fmtTime(q.timeSpentSecs)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
            {(data.pendingTests || []).map((t) => {
              const now = new Date();
              const testStart = new Date(t.startTime);
              const testEnd = new Date(t.endTime);
              let pStatus, pStatusClass;
              if (now > testEnd) {
                pStatus = 'Not attempted';
                pStatusClass = 'mstd__tag--muted';
              } else if (now < testStart) {
                pStatus = 'Scheduled';
                pStatusClass = 'mstd__tag--blue';
              } else {
                pStatus = 'Active';
                pStatusClass = 'mstd__tag--green';
              }
              return (
                <div key={t.id} className="mstd__attempt">
                  <div className="mstd__attempt-row">
                    <div className="mstd__attempt-info">
                      <span className="mstd__attempt-title">{t.title}</span>
                    </div>
                    <div className="mstd__attempt-stats">
                      <span className={`mstd__tag ${pStatusClass}`}>{pStatus}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
