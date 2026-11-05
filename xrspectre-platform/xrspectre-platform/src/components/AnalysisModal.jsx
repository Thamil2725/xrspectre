import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getTestStats } from '../api/adminTests';
import './AnalysisModal.css';

export default function AnalysisModal({ testId, testTitle, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTestStats(testId)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [testId]);

  const maxCount = stats?.distribution ? Math.max(...stats.distribution.map((d) => d.count), 1) : 1;

  return (
    <div className="amodal__overlay" onClick={onClose}>
      <div className="amodal" onClick={(e) => e.stopPropagation()}>
        <div className="amodal__header">
          <h2 className="amodal__title">{testTitle}</h2>
          <button className="amodal__close" onClick={onClose}><X size={18} /></button>
        </div>

        {loading && <p className="amodal__loading">Loading analysis...</p>}
        {error && <p className="amodal__error">{error}</p>}

        {stats && (
          <div className="amodal__body">
            <div className="amodal__metrics">
              <div className="amodal__metric">
                <span className="amodal__metric-value">{stats.targetAudience}</span>
                <span className="amodal__metric-label">Target Audience</span>
              </div>
              <div className="amodal__metric">
                <span className="amodal__metric-value">{stats.totalAttempted}</span>
                <span className="amodal__metric-label">Attempted</span>
              </div>
              <div className="amodal__metric">
                <span className="amodal__metric-value">{stats.overallAverageScore}</span>
                <span className="amodal__metric-label">Avg Score / {stats.maxPossibleScore}</span>
              </div>
            </div>

            {stats.averageByDepartment.length > 0 && (
              <div className="amodal__section">
                <h3 className="amodal__subhead">Average Score by Department</h3>
                <div className="amodal__dept-table">
                  <div className="amodal__dept-row amodal__dept-row--head">
                    <span>Department</span>
                    <span>Avg Score</span>
                    <span>Count</span>
                  </div>
                  {stats.averageByDepartment.map((d) => (
                    <div className="amodal__dept-row" key={d.department}>
                      <span>{d.department}</span>
                      <span>{d.averageScore}</span>
                      <span>{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.allFinished && stats.distribution.length > 0 && (
              <div className="amodal__section">
                <h3 className="amodal__subhead">Mark Distribution</h3>
                <div className="amodal__chart">
                  {stats.distribution.map((d) => (
                    <div className="amodal__bar-wrapper" key={d.range}>
                      <span className="amodal__bar-count">{d.count}</span>
                      <div className="amodal__bar-track">
                        <div
                          className="amodal__bar-fill"
                          style={{ height: `${(d.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="amodal__bar-label">{d.range}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!stats.allFinished && (
              <p className="amodal__hint">Mark distribution will be available once all students have finished the test.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}