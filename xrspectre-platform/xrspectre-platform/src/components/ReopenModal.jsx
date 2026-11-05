import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getTestDetails, reopenTest } from '../api/adminTests';
import { useOrgData } from '../hooks/useOrgData';
import MultiSelect from '../components/MultiSelect';
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import './ReopenModal.css';

export default function ReopenModal({ testId, testTitle, onClose }) {
  const { departments, batches, loading: orgLoading } = useOrgData();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [institutionIds, setInstitutionIds] = useState([]);
  const [institutionNames, setInstitutionNames] = useState('');

  const [departmentIds, setDepartmentIds] = useState([]);
  const [batchIds, setBatchIds] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    getTestDetails(testId)
      .then((data) => {
        const instIds = data.institutions.map((i) => i.id);
        setInstitutionIds(instIds);
        setInstitutionNames(data.institutions.map((i) => i.name).join(', ') || 'Unknown');
        setDepartmentIds(data.departments.map((d) => d.id));
        setBatchIds(data.batches.map((b) => b.id));
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [testId]);

  const filteredDepartments = institutionIds.length > 0
    ? departments.filter((d) => institutionIds.includes(d.institutionId))
    : [];

  const filteredBatches = batches
    .filter((b) => departmentIds.includes(b.departmentId))
    .map((b) => {
      const dept = departments.find((d) => d.id === b.departmentId);
      return { ...b, subtitle: dept ? dept.name : '' };
    });

  useEffect(() => {
    setBatchIds([]);
  }, [departmentIds]);

  const canSubmit = departmentIds.length > 0 && batchIds.length > 0 && startDate && startTime && endDate && endTime;

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await reopenTest(testId, {
        startTime: new Date(`${startDate}T${startTime}`).toISOString(),
        endTime: new Date(`${endDate}T${endTime}`).toISOString(),
        departmentIds,
        batchIds,
      });
      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rmodal__overlay" onClick={() => onClose()}>
      <div className="rmodal" onClick={(e) => e.stopPropagation()}>
        <div className="rmodal__header">
          <h2 className="rmodal__title">Reopen test</h2>
          <button className="rmodal__close" onClick={() => onClose()}><X size={18} /></button>
        </div>

        <p className="rmodal__subtitle">{testTitle}</p>

        {loading && <p className="rmodal__loading">Loading test details...</p>}

        {!loading && error && <p className="rmodal__error">{error}</p>}

        {!loading && (
          <div className="rmodal__body">
            <div className="rmodal__field">
              <label className="rmodal__label">Institution</label>
              <input className="rmodal__input rmodal__input--readonly" value={institutionNames} readOnly disabled />
            </div>

            <div className="rmodal__row">
              <MultiSelect
                label="Department"
                options={filteredDepartments}
                selected={departmentIds}
                onChange={setDepartmentIds}
                placeholder={orgLoading ? 'Loading…' : 'Select departments'}
              />
              <MultiSelect
                label="Batch"
                options={filteredBatches}
                selected={batchIds}
                onChange={setBatchIds}
                placeholder={orgLoading ? 'Loading…' : (departmentIds.length === 0 ? 'Select a department first' : 'Select batches')}
              />
            </div>

            <div className="rmodal__row">
              <div className="rmodal__field">
                <label className="rmodal__label">Start time</label>
                <div className="rmodal__input-group"><DatePicker value={startDate} onChange={setStartDate} /></div>
                <div className="rmodal__input-group"><TimePicker value={startTime} onChange={setStartTime} /></div>
              </div>
              <div className="rmodal__field">
                <label className="rmodal__label">End time</label>
                <div className="rmodal__input-group"><DatePicker value={endDate} onChange={setEndDate} /></div>
                <div className="rmodal__input-group"><TimePicker value={endTime} onChange={setEndTime} /></div>
              </div>
            </div>
          </div>
        )}

        <div className="rmodal__footer">
          <button className="rmodal__cancel" onClick={() => onClose()}>Cancel</button>
          <button className="rmodal__submit" disabled={!canSubmit || submitting || loading} onClick={handleSubmit}>
            {submitting ? 'Reopening…' : 'Reopen test'}
          </button>
        </div>
      </div>
    </div>
  );
}
