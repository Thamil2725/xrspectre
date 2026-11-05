import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Clock, Send, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Trophy, AlertCircle, User, MinusCircle, CheckSquare } from 'lucide-react';
import * as studentsApi from '../api/students';
import * as mentorApi from '../api/mentor';
import { getMyAttemptDetails } from '../api/studentTests';
import { downloadFile } from '../api/client';
import './AttemptDetailPage.css';

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
  PASSED: <CheckCircle2 size={13} className="adp__status-icon adp__status-icon--pass" />,
  FAILED: <XCircle size={13} className="adp__status-icon adp__status-icon--fail" />,
  PARTIAL: <AlertTriangle size={13} className="adp__status-icon adp__status-icon--partial" />,
  ERROR: <XCircle size={13} className="adp__status-icon adp__status-icon--fail" />,
  PENDING: <Clock size={13} className="adp__status-icon adp__status-icon--pending" />,
};

function questionStatus(q) {
  if (q.totalSubmissions === 0) return 'none';
  const pct = q.points > 0 ? (q.bestScore / q.points) * 100 : 0;
  if (pct === 100) return 'full';
  if (pct > 0) return 'partial';
  return 'zero';
}

const Q_STATUS_ICON = {
  full: <CheckCircle2 size={16} className="adp__q-icon adp__q-icon--full" />,
  partial: <AlertTriangle size={16} className="adp__q-icon adp__q-icon--partial" />,
  zero: <XCircle size={16} className="adp__q-icon adp__q-icon--zero" />,
  none: <MinusCircle size={16} className="adp__q-icon adp__q-icon--none" />,
};

export default function AttemptDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { studentId, attemptId } = useParams();
  const isMentor = location.pathname.startsWith('/mentor');
  const isStudent = !studentId && !isMentor;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQ, setExpandedQ] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const promise = isStudent
      ? getMyAttemptDetails(attemptId)
      : isMentor
        ? mentorApi.getAttemptDetails(studentId, attemptId)
        : studentsApi.getAttemptDetails(studentId, attemptId);
    promise
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [studentId, attemptId, isStudent, isMentor]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const endpoint = isStudent
        ? `/student/tests/attempts/${attemptId}/download`
        : isMentor
          ? `/mentor/students/${studentId}/attempts/${attemptId}/download`
          : `/admin/students/${studentId}/attempts/${attemptId}/download`;
      await downloadFile(endpoint, `attempt_${attemptId}.pdf`);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="adp__loading">Loading attempt details...</div>;
  }

  if (error) {
    return <div className="adp__loading adp__loading--error">{error}</div>;
  }

  const { attempt, testTitle, student, questionDetails } = data;
  const pct = attempt.totalPoints > 0 ? Math.round(((attempt.totalScore ?? 0) / attempt.totalPoints) * 100) : 0;
  const passedCount = questionDetails.filter((q) => questionStatus(q) === 'full').length;
  const durationSecs = attempt.startedAt && attempt.submittedAt
    ? Math.floor((new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
    : 0;

  return (
    <div className="adp">
      <div className="adp__topbar">
        <button className="adp__back" onClick={() => navigate(isStudent ? '/student/tests' : isMentor ? '/mentor/students' : '/admin/students')}>
          <ArrowLeft size={16} /> {isStudent ? 'Back to tests' : isMentor ? 'Back to students' : 'Back to students'}
        </button>
        <button className="adp__download-btn" onClick={handleDownload} disabled={downloading}>
          <Download size={14} /> {downloading ? 'Downloading...' : 'Download result'}
        </button>
      </div>

      <div className="adp__title-row">
        <h1>{testTitle}</h1>
        <div className="adp__student-inline">
          <div className="adp__student-avatar">{student.name?.charAt(0)?.toUpperCase() || <User size={14} />}</div>
          <div className="adp__student-info">
            <span className="adp__student-name">{student.name}</span>
            <span className="adp__student-org">{student.institution} &middot; {student.department} &middot; {student.batch}</span>
          </div>
        </div>
      </div>

      <div className="adp__dashboard">
        <div className="adp__dash-score">
          <div className="adp__dash-score-num">
            <Trophy size={20} className="adp__dash-trophy" />
            <span className="adp__dash-big">{attempt.totalScore ?? '—'}</span>
            <span className="adp__dash-of">/ {attempt.totalPoints}</span>
          </div>
        </div>
        <div className="adp__dash-divider" />
        <div className="adp__dash-meta">
          <div className="adp__dash-meta-item">
            <CheckCircle2 size={14} className="adp__dash-meta-icon adp__dash-meta-icon--full" />
            <span className="adp__dash-meta-val">{passedCount}</span>
            <span className="adp__dash-meta-label">/ {questionDetails.length} solved</span>
          </div>
          {attempt.disqualifiedAt ? (
            <span className="adp__dash-tag adp__dash-tag--disq"><XCircle size={12} /> Disqualified</span>
          ) : attempt.submittedAt ? (
            <span className="adp__dash-tag adp__dash-tag--submit"><CheckCircle2 size={12} /> Submitted</span>
          ) : (
            <span className="adp__dash-tag adp__dash-tag--nosubmit"><XCircle size={12} /> Not submitted</span>
          )}
          <div className="adp__dash-meta-item">
            <Clock size={14} className="adp__dash-meta-icon" />
            <span className="adp__dash-meta-val">{formatDuration(durationSecs)}</span>
            <span className="adp__dash-meta-label">total</span>
          </div>
          {attempt.warningCount > 0 && (
            <div className="adp__dash-meta-item adp__dash-meta-item--warn">
              <AlertCircle size={14} className="adp__dash-meta-icon" />
              <span className="adp__dash-meta-val">{attempt.warningCount} warning{attempt.warningCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        <div className="adp__dash-times">
          <div className="adp__dash-time">
            <span className="adp__dash-time-label">Started</span>
            <span className="adp__dash-time-val">{formatDate(attempt.startedAt)}</span>
          </div>
          {attempt.submittedAt && (
            <div className="adp__dash-time">
              <span className="adp__dash-time-label">Ended</span>
              <span className="adp__dash-time-val">{formatDate(attempt.submittedAt)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="adp__questions">
        {questionDetails.map((q, qi) => {
          const isExpanded = expandedQ === q.questionId;
          const st = questionStatus(q);
          return (
            <div className="adp__q" key={q.questionId}>
              <button className="adp__q-header" onClick={() => setExpandedQ(isExpanded ? null : q.questionId)}>
                {Q_STATUS_ICON[st]}
                <span className="adp__q-num">Q{qi + 1}</span>
                <span className="adp__q-title">{q.title}</span>
                <span className="adp__q-cases"><CheckSquare size={11} /> {q.bestPassedCount}/{q.bestTotalCount}</span>
                <span className="adp__q-subs"><Send size={11} /> {q.uniqueSubmissions}</span>
                <span className="adp__q-time"><Clock size={11} /> {formatDuration(q.timeSpentSecs)}</span>
                {isExpanded ? <ChevronDown size={14} className="adp__q-chevron" /> : <ChevronRight size={14} className="adp__q-chevron" />}
              </button>
              {isExpanded && (
                <div className="adp__q-body">
                  {q.submissions.length === 0 ? (
                    <p className="adp__q-empty">No submissions for this question.</p>
                  ) : (
                    <div className="adp__subs">
                      {q.submissions.map((sub) => {
                        const isSubExpanded = expandedSub === sub.id;
                        return (
                          <div className="adp__sub" key={sub.id}>
                            <button className="adp__sub-header" onClick={() => setExpandedSub(isSubExpanded ? null : sub.id)}>
                              {STATUS_ICON[sub.status]}
                              <span className="adp__sub-lang">{sub.language || 'Subjective'}</span>
                              <span className="adp__sub-pts">{sub.pointsAwarded} pts</span>
                              {sub.needsReview && (
                                <span className="adp__sub-review" style={{ color: '#06b6d4', fontSize: '0.7rem', fontWeight: 600, marginLeft: 6 }}>⚠ Review Manually</span>
                              )}
                              <span className="adp__sub-time">{formatDate(sub.createdAt)}</span>
                              <span className="adp__sub-chevron">{isSubExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                            </button>
                            {isSubExpanded && (
                              <>
                                <pre className="adp__code">{sub.code || sub.answer || '(no code)'}</pre>
                                {sub.feedback && (
                                  <div style={{ padding: '8px 12px', background: 'rgba(6,182,212,0.08)', borderTop: '1px solid rgba(6,182,212,0.2)', fontSize: '0.8rem', color: '#06b6d4' }}>
                                    <strong>AI Feedback:</strong> {sub.feedback}
                                  </div>
                                )}
                              </>
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
  );
}
