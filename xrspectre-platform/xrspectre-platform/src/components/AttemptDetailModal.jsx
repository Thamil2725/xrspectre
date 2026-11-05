import { useState, useEffect } from 'react';
import { X, Clock, Play, Send, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import * as studentsApi from '../api/students';
import './AttemptDetailModal.css';

function formatDuration(secs) {
  if (!secs || secs < 0) return '0s';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_ICON = {
  PASSED: <CheckCircle2 size={13} className="adm__status-icon adm__status-icon--pass" />,
  FAILED: <XCircle size={13} className="adm__status-icon adm__status-icon--fail" />,
  PARTIAL: <AlertTriangle size={13} className="adm__status-icon adm__status-icon--partial" />,
  ERROR: <XCircle size={13} className="adm__status-icon adm__status-icon--fail" />,
  PENDING: <Clock size={13} className="adm__status-icon adm__status-icon--pending" />,
};

export default function AttemptDetailModal({ studentId, attemptId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQ, setExpandedQ] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);

  useEffect(() => {
    studentsApi.getAttemptDetails(studentId, attemptId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [studentId, attemptId]);

  if (loading) {
    return (
      <div className="adm__overlay" onClick={onClose}>
        <div className="adm" onClick={(e) => e.stopPropagation()}>
          <div className="adm__loading">Loading attempt details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="adm__overlay" onClick={onClose}>
        <div className="adm" onClick={(e) => e.stopPropagation()}>
          <div className="adm__loading adm__loading--error">{error}</div>
        </div>
      </div>
    );
  }

  const { attempt, testTitle, questionDetails } = data;

  return (
    <div className="adm__overlay" onClick={onClose}>
      <div className="adm" onClick={(e) => e.stopPropagation()}>
        <div className="adm__header">
          <div>
            <h2>{testTitle}</h2>
            <p className="adm__subtitle">
              Started {formatDate(attempt.startedAt)}
              {attempt.submittedAt && <> · Submitted {formatDate(attempt.submittedAt)}</>}
            </p>
          </div>
          <button className="adm__close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="adm__stats">
          <div className="adm__stat">
            <span className="adm__stat-value">{attempt.totalScore ?? '—'}</span>
            <span className="adm__stat-label">Score / {attempt.totalPoints}</span>
          </div>
          <div className="adm__stat">
            <span className="adm__stat-value">{attempt.runCount}</span>
            <span className="adm__stat-label">Runs</span>
          </div>
          <div className="adm__stat">
            <span className="adm__stat-value">{attempt.warningCount}</span>
            <span className="adm__stat-label">Warnings</span>
          </div>
          {attempt.disqualifiedAt && (
            <div className="adm__stat adm__stat--warn">
              <span className="adm__stat-value">Yes</span>
              <span className="adm__stat-label">Disqualified</span>
            </div>
          )}
        </div>

        <div className="adm__questions">
          {questionDetails.map((q, qi) => {
            const isExpanded = expandedQ === q.questionId;
            const pct = q.points > 0 ? Math.round((q.bestScore / q.points) * 100) : 0;
            return (
              <div className="adm__q" key={q.questionId}>
                <button className="adm__q-header" onClick={() => setExpandedQ(isExpanded ? null : q.questionId)}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="adm__q-num">Q{qi + 1}</span>
                  <span className="adm__q-title">{q.title}</span>
                  <span className="adm__q-score">{q.bestScore}/{q.points}</span>
                  <span className={`adm__q-pct ${pct === 100 ? 'adm__q-pct--full' : pct > 0 ? 'adm__q-pct--partial' : 'adm__q-pct--zero'}`}>{pct}%</span>
                </button>
                {isExpanded && (
                  <div className="adm__q-body">
                    <div className="adm__q-meta">
                      <span><Send size={12} /> {q.totalSubmissions} submit{q.totalSubmissions !== 1 ? 's' : ''}</span>
                      <span><Play size={12} /> {q.uniqueSubmissions} distinct</span>
                      <span><Clock size={12} /> {formatDuration(q.timeSpentSecs)} spent</span>
                    </div>
                    {q.submissions.length === 0 ? (
                      <p className="adm__q-empty">No submissions for this question.</p>
                    ) : (
                      <div className="adm__subs">
                        {q.submissions.map((sub, si) => {
                          const isSubExpanded = expandedSub === sub.id;
                          return (
                            <div className="adm__sub" key={sub.id}>
                              <button className="adm__sub-header" onClick={() => setExpandedSub(isSubExpanded ? null : sub.id)}>
                                {isSubExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                {STATUS_ICON[sub.status]}
                                <span className="adm__sub-lang">{sub.language}</span>
                                <span className="adm__sub-score">{sub.passedCount}/{sub.totalCount}</span>
                                <span className="adm__sub-pts">{sub.pointsAwarded}pts</span>
                                <span className="adm__sub-time">{formatDate(sub.createdAt)}</span>
                              </button>
                              {isSubExpanded && (
                                <pre className="adm__code">{sub.code || sub.answer || '(no code)'}</pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
