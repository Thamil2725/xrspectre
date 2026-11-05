import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import MultiSelect from '../components/MultiSelect';
import CustomSelect from '../components/CustomSelect';
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import { useOrgData } from '../hooks/useOrgData';
import { useTestDraft } from '../context/TestDraftContext';
import ProgressTracker from '../components/ProgressTracker';
import './CreateTestAudience.css';

export default function CreateTestAudience() {
  const navigate = useNavigate();
  const { draft, createTestOnServer, updateDraft } = useTestDraft();
  const { institutions, departments, batches, loading: orgLoading, error: orgError } = useOrgData();

  const [title, setTitle] = useState(draft.title);
  const [institutionId, setInstitutionId] = useState(draft.institutionIds[0] ?? '');
  const [departmentIds, setDepartmentIds] = useState(draft.departmentIds);
  const [batchIds, setBatchIds] = useState(draft.batchIds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxWarnings, setMaxWarnings] = useState(draft.maxWarnings ?? 3);
  const [securityEnabled, setSecurityEnabled] = useState(draft.securityEnabled ?? true);

  const startISO = startDate && startTime ? `${startDate}T${startTime}:00` : '';
  const endISO = endDate && endTime ? `${endDate}T${endTime}:00` : '';
  const scheduleValid = startISO && endISO && endISO > startISO;

  const filteredDepartments = departments
    .filter((d) => d.institutionId === institutionId)
    .map((d) => ({
      ...d,
      subtitle: institutions.find((i) => i.id === d.institutionId)?.name ?? '',
    }));
  const filteredBatches = batches
    .filter((b) => b.departmentId && departmentIds.includes(b.departmentId))
    .map((b) => ({
      ...b,
      subtitle: departments.find((d) => d.id === b.departmentId)?.name ?? '',
    }));

  useEffect(() => {
    setDepartmentIds([]);
  }, [institutionId]);

  useEffect(() => {
    setBatchIds([]);
  }, [departmentIds]);

  const canProceed = institutionId && departmentIds.length > 0 && batchIds.length > 0 && title.trim().length > 0 && scheduleValid;

  const handleProceed = async () => {
    setError('');
    setSubmitting(true);
    try {
      await createTestOnServer({
        title: title.trim(),
        institutionIds: [institutionId], departmentIds, batchIds,
      });
      updateDraft({
        startTime: new Date(startISO).toISOString(),
        endTime: new Date(endISO).toISOString(),
        maxWarnings,
        securityEnabled,
      });
      navigate('/admin/create/questions');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cta">
      <div className="cta__header">
        <ProgressTracker currentStep={1} />
        <h1>Who is this test for?</h1>
        <p>Only students in the institutions, departments, and batches you select here will be able to access this test.</p>
      </div>

      {orgError && <p className="cta__hint" style={{ color: 'var(--red-300)' }}>Could not load institutions/departments/batches: {orgError}</p>}
      {error && <p className="cta__hint" style={{ color: 'var(--red-300)' }}>{error}</p>}

      <div className="cta__field">
        <label className="cta__label">Test title</label>
        <input
          className="cta__input"
          type="text"
          placeholder="e.g. Data Structures — Mid Sem Assessment"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="cta__row">
        <div className="cta__field cta__field--institution">
          <label className="cta__label">Educational institution</label>
          <CustomSelect
            options={institutions.map((i) => ({ value: i.id, label: i.name }))}
            value={institutionId}
            onChange={setInstitutionId}
            placeholder={orgLoading ? 'Loading…' : 'Select an institution'}
          />
        </div>
        <MultiSelect
          label="Department"
          options={filteredDepartments}
          selected={departmentIds}
          onChange={setDepartmentIds}
          placeholder={orgLoading ? 'Loading…' : (!institutionId ? 'Select an institution first' : 'Select departments')}
        />
        <MultiSelect
          label="Batch"
          options={filteredBatches}
          selected={batchIds}
          onChange={setBatchIds}
          placeholder={orgLoading ? 'Loading…' : (departmentIds.length === 0 ? 'Select a department first' : 'Select batches')}
        />
      </div>

      <div className="cta__section-divider" />

      <div className="cta__schedule">
        <h2 className="cta__schedule-title">Schedule</h2>
        <div className="cta__schedule-cards">
          <div className="cta__card">
            <div className="cta__fieldset">
              <label className="cta__label">Start time</label>
              <div className="cta__row">
                <div className="cta__input-group">
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div className="cta__input-group">
                  <TimePicker value={startTime} onChange={setStartTime} />
                </div>
              </div>
            </div>
            <div className="cta__fieldset">
              <label className="cta__label">End time</label>
              <div className="cta__row">
                <div className="cta__input-group">
                  <DatePicker value={endDate} onChange={setEndDate} />
                </div>
                <div className="cta__input-group">
                  <TimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>
            </div>
            {startISO && endISO && endISO <= startISO && (
              <p className="cta__hint" style={{ color: 'var(--red-300)', marginTop: 8 }}>End time must be after the start time.</p>
            )}
          </div>

          <div className="cta__card cta__card--security">
            <div className="cta__fieldset">
              <label className="cta__label">
                <ShieldCheck size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Security warnings
              </label>
              <div className="cta__toggle-row">
                <label className="cta__toggle">
                  <input
                    type="checkbox"
                    checked={securityEnabled}
                    onChange={(e) => setSecurityEnabled(e.target.checked)}
                  />
                  Enable restrictions
                </label>
              </div>
              {securityEnabled ? (
                <>
                  <p className="cta__hint">Number of warnings a student gets before the test is auto-submitted when they attempt to switch tabs or exit fullscreen.</p>
                  <div className="cta__slider-row">
                    <input
                      className="cta__slider"
                      type="range"
                      min={1}
                      max={7}
                      value={maxWarnings}
                      onChange={(e) => setMaxWarnings(Number(e.target.value))}
                      style={{ background: `linear-gradient(to right, var(--amber-500) 0%, var(--amber-500) ${((maxWarnings - 1) / 6) * 100}%, var(--ink-700) ${((maxWarnings - 1) / 6) * 100}%, var(--ink-700) 100%)` }}
                    />
                    <span className="cta__slider-value">{maxWarnings}</span>
                  </div>
                </>
              ) : (
                <p className="cta__hint">Tab switching, fullscreen exit, and other security checks are disabled for this test.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="cta__footer">
        <button className="cta__proceed" disabled={!canProceed || submitting} onClick={handleProceed}>
          {submitting ? 'Creating…' : 'Proceed to add questions'}
        </button>
        {!canProceed && (
          <span className="cta__hint">{!scheduleValid ? 'Set a valid start and end time.' : 'Add a title and at least one selection in each field to continue.'}</span>
        )}
      </div>
    </div>
  );
}
