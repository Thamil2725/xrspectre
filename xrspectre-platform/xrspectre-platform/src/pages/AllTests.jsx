import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Pencil, Trash2, Download, Info, BarChart3, RotateCcw, Clock } from 'lucide-react';
import { listAdminTests, deleteTest, deleteAllTests } from '../api/adminTests';
import { downloadFile } from '../api/client';
import AnalysisModal from '../components/AnalysisModal';
import ReopenModal from '../components/ReopenModal';
import ExtendTestModal from '../components/ExtendTestModal';
import './AllTests.css';

const STATUS_LABEL = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  ENDED: 'Ended',
};

const STATUS_CLASS = {
  DRAFT: 'atests__status--draft',
  SCHEDULED: 'atests__status--scheduled',
  ACTIVE: 'atests__status--active',
  ENDED: 'atests__status--ended',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function AllTests() {
  const location = useLocation();
  const justPublished = location.state?.justPublished;

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deletingId, setDeletingId] = useState(null);
  const [analysisTest, setAnalysisTest] = useState(null);
  const [reopenTestId, setReopenTestId] = useState(null);
  const [extendTest, setExtendTest] = useState(null);
  const [downloadTestId, setDownloadTestId] = useState(null);
  const [downloadSort, setDownloadSort] = useState('desc');

  const load = () => listAdminTests().then(setTests).catch((err) => setError(err.message));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleDelete = async (testId, e) => {
    e.preventDefault();
    if (!window.confirm('Delete this draft test? This cannot be undone.')) return;
    setDeletingId(testId);
    setError('');
    try {
      await deleteTest(testId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadAnalysis = async (testId, sortOrder = 'desc') => {
    try {
      const testObj = tests.find((t) => t.id === testId);
      const testName = (testObj?.title || 'test').replace(/[^a-zA-Z0-9]/g, '_');
      const collegeName = (testObj?.institutions?.[0] || 'org').replace(/[^a-zA-Z0-9]/g, '_');
      await downloadFile(`/admin/tests/${testId}/analysis?sort=${sortOrder}`, `${testName}_${collegeName}.xlsx`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReopenClose = (didReopen) => {
    setReopenTestId(null);
    if (didReopen) load();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete ALL tests? This will permanently remove every test regardless of status. This cannot be undone.')) return;
    setError('');
    setLoading(true);
    try {
      await deleteAllTests();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="atests">
      <div className="atests__header">
        <h1>All tests</h1>
        <p>Every test created across your institutions, departments, and batches.</p>
        {tests.length > 0 && (
          <button className="atests__delete-all" onClick={handleDeleteAll}>
            Delete all tests
          </button>
        )}
      </div>

      {justPublished && (
        <div className="atests__banner">
          <CheckCircle2 size={16} />
          Test published. Students in the selected audience can now access it during its scheduled window.
        </div>
      )}

      {error && <p style={{ color: 'var(--red-300)', fontSize: '13.5px' }}>{error}</p>}
      {loading && <p style={{ color: 'var(--ink-400)', fontSize: '13.5px' }}>Loading tests…</p>}

      {!loading && !error && tests.length === 0 && (
        <p style={{ color: 'var(--ink-400)', fontSize: '13.5px', marginBottom: 20 }}>
          No tests created yet.
        </p>
      )}

      {tests.length > 0 && (
        <div className="atests__table">
          <div className="atests__row atests__row--head">
            <span>Test</span>
            <span>Audience</span>
            <span className="questions-col">Questions</span>
            <span className="window-col">Window</span>
            <span className="status-col">Status</span>
            <span />
            <span />
          </div>
          {tests.map((t) => (
            <div className="atests__row atests__row--data" key={t.id}>
              <span className="atests__title">{t.title}</span>
              <span className="atests__audience">
                {t.audience.map((a, i) => (
                  <span key={a.institution} className="atests__inst">
                    {i === 0 && (
                      <span className="atests__popup-trigger">
                        <Info size={12} />
                        <span className="atests__popup">
                          {t.audience.map((inst) => (
                            <div key={inst.institution} className="atests__popup-group">
                              <strong>{inst.institution}</strong>
                              {inst.departments.map((d) => (
                                <div key={d.name} className="atests__popup-dept">
                                  {d.name}
                                  {d.batches.length > 0 && (
                                    <span className="atests__popup-batches">
                                      &nbsp;({d.batches.join(', ')})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </span>
                      </span>
                    )}
                    {a.institution}
                  </span>
                ))}
              </span>
              <span className="questions-col questions-data">{t.questionCount}</span>
              <span className="atests__window">
                <span className="atests__window-date">{formatDate(t.startTime)}</span>
                <span className="atests__window-time">{formatTime(t.startTime)} – {formatTime(t.endTime)}</span>
              </span>
              <span className={`atests__status ${STATUS_CLASS[t.displayStatus]}`}>{STATUS_LABEL[t.displayStatus]}</span>
              {t.displayStatus === 'ENDED' ? (
                <span className="atests__actions">
                  <button className="atests__action-btn" onClick={() => setReopenTestId(t.id)} aria-label="Reopen test" title="Reopen test">
                    <RotateCcw size={14} />
                  </button>
                  <button className="atests__action-btn" onClick={() => setAnalysisTest(t)} aria-label="View analysis" title="View analysis">
                    <BarChart3 size={14} />
                  </button>
                  <button className="atests__download-btn" disabled={t.activeAttemptCount > 0} onClick={() => { setDownloadTestId(t.id); setDownloadSort('desc'); }} aria-label="Download analysis" title={t.activeAttemptCount > 0 ? `${t.activeAttemptCount} student${t.activeAttemptCount === 1 ? '' : 's'} are writing this test` : 'Download analysis'}>
                    <Download size={14} />
                    {t.activeAttemptCount > 0 && <span className="atests__download-count">{t.activeAttemptCount}</span>}
                  </button>
                </span>
              ) : t.displayStatus === 'ACTIVE' ? (
                <span className="atests__actions">
                  <button className="atests__action-btn" onClick={() => setExtendTest(t)} aria-label="Extend test window" title="Extend test window">
                    <Clock size={14} />
                  </button>
                </span>
              ) : (
                <Link to={`/admin/create/edit/${t.id}`} className="atests__edit-link" aria-label="Edit test" title="Edit test">
                  <Pencil size={14} />
                </Link>
              )}
              {t.displayStatus === 'DRAFT' && (
                <button
                  className="atests__delete-btn"
                  disabled={deletingId === t.id}
                  onClick={(e) => handleDelete(t.id, e)}
                  aria-label="Delete test"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {analysisTest && (
        <AnalysisModal
          testId={analysisTest.id}
          testTitle={analysisTest.title}
          onClose={() => setAnalysisTest(null)}
        />
      )}

      {reopenTestId && (
        <ReopenModal
          testId={reopenTestId}
          testTitle={tests.find((t) => t.id === reopenTestId)?.title ?? ''}
          onClose={handleReopenClose}
        />
      )}

      {extendTest && (
        <ExtendTestModal
          testId={extendTest.id}
          testTitle={extendTest.title}
          startTime={extendTest.startTime}
          endTime={extendTest.endTime}
          onClose={(didChange) => { setExtendTest(null); if (didChange) load(); }}
        />
      )}

      {downloadTestId && (
        <div className="atests__overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setDownloadTestId(null); }}>
          <div className="atests__sort-modal">
            <h3>Download scores</h3>
            <p className="atests__sort-desc">Sort by score percentage. Students with the same score are ranked by test completion time.</p>
            <div className="atests__sort-options">
              <label className={`atests__sort-option ${downloadSort === 'desc' ? 'atests__sort-option--active' : ''}`}>
                <input type="radio" name="sortOrder" value="desc" checked={downloadSort === 'desc'} onChange={() => setDownloadSort('desc')} />
                <span className="atests__sort-radio" />
                <span>
                  <strong>Descending</strong>
                  <span className="atests__sort-hint">Highest scores first</span>
                </span>
              </label>
              <label className={`atests__sort-option ${downloadSort === 'asc' ? 'atests__sort-option--active' : ''}`}>
                <input type="radio" name="sortOrder" value="asc" checked={downloadSort === 'asc'} onChange={() => setDownloadSort('asc')} />
                <span className="atests__sort-radio" />
                <span>
                  <strong>Ascending</strong>
                  <span className="atests__sort-hint">Lowest scores first</span>
                </span>
              </label>
            </div>
            <div className="atests__sort-actions">
              <button className="atests__sort-cancel" onClick={() => setDownloadTestId(null)}>Cancel</button>
              <button className="atests__sort-download" onClick={() => { handleDownloadAnalysis(downloadTestId, downloadSort); setDownloadTestId(null); }}>
                <Download size={13} /> Download
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
