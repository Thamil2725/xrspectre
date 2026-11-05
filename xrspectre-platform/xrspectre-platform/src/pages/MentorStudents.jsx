import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, AlertCircle, Eye } from 'lucide-react';
import * as mentorApi from '../api/mentor';
import './MentorStudents.css';

export default function MentorStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    mentorApi.listStudents()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mstudents">
      <div className="mstudents__header">
        <h1><Users size={18} /> My students</h1>
        <span className="mstudents__count">{students.length} students</span>
      </div>

      {error && <div className="mstudents__banner mstudents__banner--error"><AlertCircle size={14} /> {error}</div>}

      {loading ? (
        <p className="mstudents__loading">Loading students…</p>
      ) : students.length === 0 ? (
        <div className="mstudents__empty">No students in your scope yet.</div>
      ) : (
        <div className="mstudents__list">
          {students.map((s) => (
            <div key={s.id} className="mstudents__student">
              <div className="mstudents__student-header">
                <div className="mstudents__student-info">
                  <span className="mstudents__student-name">{s.name}</span>
                  <span className="mstudents__student-email">{s.email}</span>
                  <span className="mstudents__student-org">{s.institution} · {s.department} · {s.batch}</span>
                </div>
              </div>
              <div className="mstudents__student-attempts">
                {s.attempts.length > 0 && s.attempts.map((a) => {
                  const now = new Date();
                  let status, statusClass;

                  if (a.disqualifiedAt) {
                    status = 'Disqualified';
                    statusClass = 'mstudents__attempt-status--disqualified';
                  } else if (a.submittedAt) {
                    status = 'Submitted';
                    statusClass = 'mstudents__attempt-status--submitted';
                  } else if (a.reopenedAt) {
                    const reopenEnd = new Date(a.reopenEndTime);
                    if (now <= reopenEnd) {
                      status = 'In progress';
                      statusClass = 'mstudents__attempt-status--in-progress';
                    } else {
                      status = 'Not attempted';
                      statusClass = 'mstudents__attempt-status--none';
                    }
                  } else {
                    const testEnd = new Date(a.testEndTime);
                    if (now <= testEnd) {
                      status = 'In progress';
                      statusClass = 'mstudents__attempt-status--in-progress';
                    } else {
                      status = 'Not attempted';
                      statusClass = 'mstudents__attempt-status--none';
                    }
                  }

                  const isDone = !!a.submittedAt || !!a.disqualifiedAt;
                  const reopenEnd = a.reopenedAt && a.reopenEndTime ? new Date(a.reopenEndTime) : null;
                  const isReopenPending = a.reopenedAt && !a.submittedAt && a.reopenStartTime && now < new Date(a.reopenStartTime);
                  const isReopenActive = reopenEnd && now <= reopenEnd;
                  const canView = isDone || isReopenPending || isReopenActive;

                  return (
                    <div key={a.id} className="mstudents__attempt">
                      <span className="mstudents__attempt-test">{a.testTitle}</span>
                      <span className="mstudents__attempt-score">{a.totalScore ?? '\u2014'} pts</span>
                      <span className={`mstudents__attempt-status ${statusClass}`}>{status}</span>
                      <span className="mstudents__attempt-actions">
                        <button
                          className="mstudents__view-btn"
                          onClick={() => navigate(`/mentor/students/${s.id}/attempts/${a.id}`)}
                          title="View attempt details"
                          disabled={!canView}
                        >
                          <Eye size={12} />
                        </button>
                      </span>
                    </div>
                  );
                })}
                {s.attempts.length === 0 && (!s.pendingTests || s.pendingTests.length === 0) && (
                  <span className="mstudents__no-attempts">No tests yet</span>
                )}
                {(s.pendingTests || []).map((t) => {
                  const now = new Date();
                  const testStart = new Date(t.startTime);
                  const testEnd = new Date(t.endTime);
                  let pStatus, pStatusClass;
                  if (now > testEnd) {
                    pStatus = 'Not attempted';
                    pStatusClass = 'mstudents__attempt-status--none';
                  } else if (now < testStart) {
                    pStatus = 'Scheduled';
                    pStatusClass = 'mstudents__attempt-status--scheduled';
                  } else {
                    pStatus = 'Active';
                    pStatusClass = 'mstudents__attempt-status--active';
                  }
                  return (
                    <div key={t.id} className="mstudents__attempt">
                      <span className="mstudents__attempt-test">{t.title}</span>
                      <span className={`mstudents__attempt-status ${pStatusClass}`}>{pStatus}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
