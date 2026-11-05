import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Search, RotateCcw, CheckCircle2, XCircle, Users, Clock, Eye, Trash2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as studentsApi from '../api/students';
import * as orgApi from '../api/org';
import CustomSelect from '../components/CustomSelect';
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import './ManageStudents.css';

export default function ManageStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [batchId, setBatchId] = useState('');

  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);

  // bulk upload state
  const [showUpload, setShowUpload] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // reopen state
  const [reopening, setReopening] = useState(null);
  const [reopenModal, setReopenModal] = useState(null); // { studentId, testId }
  const [reopenStartDate, setReopenStartDate] = useState('');
  const [reopenStartTime, setReopenStartTime] = useState('');
  const [reopenEndDate, setReopenEndDate] = useState('');
  const [reopenEndTime, setReopenEndTime] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    orgApi.getInstitutions().then(setInstitutions).catch(() => {});
  }, []);

  useEffect(() => {
    if (institutionId) {
      orgApi.getDepartments(institutionId).then(setDepartments).catch(() => {});
      setDepartmentId('');
      setBatchId('');
    } else {
      setDepartments([]);
      setDepartmentId('');
      setBatchId('');
    }
  }, [institutionId]);

  useEffect(() => {
    if (departmentId) {
      orgApi.getBatches(institutionId, departmentId).then(setBatches).catch(() => {});
      setBatchId('');
    } else {
      setBatches([]);
      setBatchId('');
    }
  }, [departmentId]);

  const loadStudents = () => {
    setLoading(true);
    setError('');
    studentsApi.listStudents({ institutionId, departmentId, batchId, search: search || undefined })
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStudents(); }, [institutionId, departmentId, batchId]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadStudents();
  };

  const handleReopenClick = (studentId, testId) => {
    setReopenStartDate('');
    setReopenStartTime('');
    setReopenEndDate('');
    setReopenEndTime('');
    setReopenModal({ studentId, testId });
  };

  const handleConfirmReopen = async () => {
    if (!reopenModal) return;
    if (!reopenStartDate || !reopenStartTime || !reopenEndDate || !reopenEndTime) return;
    const start = new Date(`${reopenStartDate}T${reopenStartTime}`);
    const end = new Date(`${reopenEndDate}T${reopenEndTime}`);
    if (end <= start) { alert('End time must be after start time.'); return; }
    setReopening(reopenModal.studentId);
    try {
      await studentsApi.reopenAttempt(reopenModal.testId, reopenModal.studentId, start.toISOString(), end.toISOString());
      setReopenModal(null);
      loadStudents();
    } catch (err) {
      alert(err.message);
    } finally {
      setReopening(null);
    }
  };

  const handleCancelReopen = () => {
    setReopenModal(null);
  };

  const handleDeleteStudent = async (studentId, name) => {
    if (!window.confirm(`Delete "${name}"? This will permanently remove the student and all their test data.`)) return;
    setDeleting(studentId);
    try {
      await studentsApi.deleteStudent(studentId);
      loadStudents();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (data.length === 0) {
          setParsedRows([]);
          setUploadResult({ success: 0, errors: [{ row: 0, email: '', message: 'File is empty or has no data rows.' }] });
          return;
        }

        const FIELD_MAP = {
          name: ['name', 'student name', 'full name', 'student_name'],
          email: ['email', 'email address', 'student email', 'e-mail', 'email_address'],
          password: ['password', 'pass', 'passwd', 'pwd'],
          institution: ['institution', 'college', 'university', 'school', 'inst'],
          department: ['department', 'dept', 'branch', 'dept_name'],
          batch: ['batch', 'batch name', 'year', 'section'],
        };

        const headers = Object.keys(data[0]);
        const colMapping = {};
        headers.forEach((col) => {
          const norm = col.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
          Object.keys(FIELD_MAP).forEach((field) => {
            if (!colMapping[field] && FIELD_MAP[field].some((alias) => norm === alias || norm.startsWith(alias + ' '))) {
              colMapping[field] = col;
            }
          });
        });

        const missing = ['name', 'email', 'password'].filter((f) => !colMapping[f]);
        if (missing.length > 0) {
          setParsedRows([]);
          setUploadResult({ success: 0, errors: [{ row: 0, email: '', message: `Missing required columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}` }] });
          return;
        }

        const rows = data.map((row) => {
          const mapped = {};
          Object.keys(colMapping).forEach((field) => {
            const val = String(row[colMapping[field]] ?? '').trim();
            if (val) mapped[field] = val;
          });
          return mapped;
        }).filter((r) => r.name || r.email);
        setParsedRows(rows);
      } catch {
        setParsedRows([]);
        setUploadResult({ success: 0, errors: [{ row: 0, email: '', message: 'Failed to parse file. Make sure it is a valid .xlsx or .csv file.' }] });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await studentsApi.bulkUploadStudents(parsedRows);
      setUploadResult(result);
      if (result.success > 0) {
        loadStudents();
        setFileName('');
        setParsedRows([]);
      }
    } catch (err) {
      setUploadResult({ success: 0, errors: [{ row: 0, email: '', message: err.message }] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mstudents">
      <div className="mstudents__header">
        <h1><Users size={18} /> Students</h1>
        <button className="mstudents__btn mstudents__btn--primary" onClick={() => setShowUpload((v) => !v)}>
          <Upload size={14} /> {showUpload ? 'Close upload' : 'Bulk upload Excel'}
        </button>
      </div>

      {error && <div className="mstudents__banner mstudents__banner--error"><AlertCircle size={14} /> {error}</div>}

      {/* Bulk upload section */}
      {showUpload && (
        <div className="mstudents__upload-section">
          <h3>Bulk upload students</h3>
          <p className="mstudents__hint">
            Required columns: <code>name</code>, <code>email</code>, <code>password</code>. Optional: <code>institution</code>, <code>department</code>, <code>batch</code>. Extra columns (e.g. Timestamp) are ignored.
          </p>
          <div className="mstudents__file-input-wrapper" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="mstudents__file-input"
              onChange={handleFile}
            />
            <FileSpreadsheet size={18} />
            <span>{fileName || 'Choose file...'}</span>
          </div>
          {parsedRows.length > 0 && (
            <div className="mstudents__csv-preview">
              <p className="mstudents__csv-count">{parsedRows.length} student{parsedRows.length !== 1 ? 's' : ''} parsed</p>
              <table className="mstudents__csv-table">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Email</th><th>Institution</th><th>Department</th><th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{r.name}</td>
                      <td>{r.email}</td>
                      <td>{r.institution}</td>
                      <td>{r.department}</td>
                      <td>{r.batch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && <p className="mstudents__hint">...and {parsedRows.length - 10} more</p>}
              <button className="mstudents__btn mstudents__btn--primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : `Upload ${parsedRows.length} student${parsedRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
          {uploadResult && (
            <div className="mstudents__upload-result">
              <p className="mstudents__result-line">
                <CheckCircle2 size={14} /> {uploadResult.success} created successfully
              </p>
              {uploadResult.errors.length > 0 && (
                <div className="mstudents__result-errors">
                  <p className="mstudents__result-line"><XCircle size={14} /> {uploadResult.errors.length} error{uploadResult.errors.length !== 1 ? 's' : ''}</p>
                  <table className="mstudents__csv-table">
                    <thead><tr><th>Row</th><th>Email</th><th>Error</th></tr></thead>
                    <tbody>
                      {uploadResult.errors.map((e, i) => (
                        <tr key={i}><td>{e.row}</td><td>{e.email}</td><td>{e.message}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mstudents__filters">
        <CustomSelect
          options={institutions.map((i) => ({ value: i.id, label: i.name }))}
          value={institutionId}
          onChange={setInstitutionId}
          placeholder="All institutions"
        />
        <CustomSelect
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          value={departmentId}
          onChange={setDepartmentId}
          placeholder="All departments"
          disabled={!institutionId}
        />
        <CustomSelect
          options={batches.map((b) => ({ value: b.id, label: b.name }))}
          value={batchId}
          onChange={setBatchId}
          placeholder="All batches"
          disabled={!institutionId}
        />
        <form onSubmit={handleSearch} className="mstudents__search-form">
          <input className="mstudents__input mstudents__input--sm" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" className="mstudents__icon-btn"><Search size={14} /></button>
        </form>
      </div>

      {/* Student list */}
      {loading ? (
        <p className="mstudents__loading">Loading students...</p>
      ) : students.length === 0 ? (
        <div className="mstudents__empty">No students found.</div>
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
                <div className="mstudents__student-actions">
                  <button
                    className="mstudents__delete-btn"
                    onClick={() => handleDeleteStudent(s.id, s.name)}
                    disabled={deleting === s.id}
                    title="Delete student"
                  >
                    <Trash2 size={14} />
                  </button>
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
                    // Reopened but not submitted — check timing
                    const reopenEnd = new Date(a.reopenEndTime);
                    if (now <= reopenEnd) {
                      status = 'In progress';
                      statusClass = 'mstudents__attempt-status--in-progress';
                    } else {
                      status = 'Not attempted';
                      statusClass = 'mstudents__attempt-status--none';
                    }
                  } else {
                    // No reopen, not submitted
                    const testEnd = new Date(a.testEndTime);
                    if (now <= testEnd) {
                      status = 'In progress';
                      statusClass = 'mstudents__attempt-status--in-progress';
                    } else {
                      status = 'Not attempted';
                      statusClass = 'mstudents__attempt-status--none';
                    }
                  }

                  const isReopenPending = a.reopenedAt && !a.submittedAt && a.reopenStartTime && now < new Date(a.reopenStartTime);
                  const isReopenActive = a.reopenedAt && !a.submittedAt && a.reopenStartTime && a.reopenEndTime && now >= new Date(a.reopenStartTime) && now <= new Date(a.reopenEndTime);
                  const isActive = isReopenActive || (!a.reopenedAt && !a.submittedAt && now >= new Date(a.testStartTime) && now <= new Date(a.testEndTime));
                  const isDone = !!a.submittedAt || !!a.disqualifiedAt;
                  const canView = isDone || isReopenPending || isReopenActive;
                  const canReopen = a.submittedAt && !a.disqualifiedAt;

                  return (
                    <div key={a.id} className="mstudents__attempt">
                      <span className="mstudents__attempt-test">{a.testTitle}</span>
                      <span className="mstudents__attempt-score">{a.totalScore ?? '\u2014'} pts</span>
                      <span className={`mstudents__attempt-status ${statusClass}`}>
                        {status}
                      </span>
                      {a.hasNeedsReview && (
                          <span className="mstudents__attempt-status mstudents__attempt-status--review" style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.12)' }}>
                          Review Manually
                        </span>
                      )}
                      <span className="mstudents__attempt-actions">
                         <button
                           className="mstudents__reopen-btn"
                           onClick={() => navigate(`/admin/students/${s.id}/attempts/${a.id}`)}
                           title="View details"
                           disabled={!canView}
                         >
                           <Eye size={12} />
                         </button>
                        {canReopen && (
                          <button
                            className="mstudents__reopen-btn"
                            onClick={() => handleReopenClick(s.id, a.testId)}
                            disabled={reopening === s.id}
                            title="Reopen attempt"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
                {(s.pendingTests || []).map((t) => {
                  const now = new Date();
                  const testStart = new Date(t.startTime);
                  const testEnd = new Date(t.endTime);
                  let pStatus, pStatusClass;
                  if (now > testEnd) {
                    pStatus = 'Not attempted';
                    pStatusClass = 'mstudents__attempt-status--none';
                  } else if (now < testStart) {
                    pStatus = t.isGloballyReopened ? 'Reopen scheduled' : 'Scheduled';
                    pStatusClass = t.isGloballyReopened ? 'mstudents__attempt-status--reopen-scheduled' : 'mstudents__attempt-status--scheduled';
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
                {s.attempts.length === 0 && (!s.pendingTests || s.pendingTests.length === 0) && (
                  <span className="mstudents__no-attempts">No attempts</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reopen modal */}
      {reopenModal && (
        <div className="mstudents__overlay" onClick={handleCancelReopen}>
          <div className="mstudents__modal" onClick={(e) => e.stopPropagation()}>
            <div className="mstudents__modal-header">
              <h3><Clock size={16} /> Reopen Attempt</h3>
              <button className="mstudents__modal-close" onClick={handleCancelReopen}>&times;</button>
            </div>
            <div className="mstudents__modal-body">
              <p className="mstudents__modal-hint">Set the custom time window for this reopened attempt. The student can only access the test during this period.</p>

              <div className="mstudents__card">
                <div className="mstudents__fieldset">
                  <label className="mstudents__label">Start time</label>
                  <div className="mstudents__row">
                    <div className="mstudents__input-group">
                      <DatePicker value={reopenStartDate} onChange={(v) => setReopenStartDate(v)} />
                    </div>
                    <div className="mstudents__input-group">
                      <TimePicker value={reopenStartTime} onChange={(v) => setReopenStartTime(v)} />
                    </div>
                  </div>
                </div>

                <div className="mstudents__fieldset">
                  <label className="mstudents__label">End time</label>
                  <div className="mstudents__row">
                    <div className="mstudents__input-group">
                      <DatePicker value={reopenEndDate} onChange={(v) => setReopenEndDate(v)} />
                    </div>
                    <div className="mstudents__input-group">
                      <TimePicker value={reopenEndTime} onChange={(v) => setReopenEndTime(v)} />
                    </div>
                  </div>
                </div>

                {reopenStartDate && reopenStartTime && reopenEndDate && reopenEndTime && new Date(`${reopenEndDate}T${reopenEndTime}`) <= new Date(`${reopenStartDate}T${reopenStartTime}`) && (
                  <p className="mstudents__error">End time must be after the start time.</p>
                )}
              </div>
            </div>
            <div className="mstudents__modal-footer">
              <button className="mstudents__btn" onClick={handleCancelReopen}>Cancel</button>
              <button className="mstudents__btn mstudents__btn--primary" onClick={handleConfirmReopen} disabled={!reopenStartDate || !reopenStartTime || !reopenEndDate || !reopenEndTime}>
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
