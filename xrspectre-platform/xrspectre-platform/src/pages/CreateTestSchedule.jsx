import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Save, ShieldAlert } from 'lucide-react';
import { useTestDraft } from '../context/TestDraftContext';
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import './CreateTestSchedule.css';

export default function CreateTestSchedule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editEnd = searchParams.get('editEnd') === '1';
  const { draft, updateDraft, publishTest } = useTestDraft();

  // Draft times are UTC ISO strings — convert to the admin's local
  // date/time for the pickers (slicing the ISO string showed UTC).
  const pad = (n) => String(n).padStart(2, '0');
  const initDate = (val) => {
    if (!val) return '';
    const d = new Date(val);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const initTime = (val) => {
    if (!val) return '';
    const d = new Date(val);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [startDate, setStartDate] = useState(initDate(draft.startTime));
  const [startTime, setStartTime] = useState(initTime(draft.startTime));
  const [endDate, setEndDate] = useState(initDate(draft.endTime));
  const [endTime, setEndTime] = useState(initTime(draft.endTime));
  const [maxWarnings, setMaxWarnings] = useState(draft.maxWarnings ?? 3);
  const [securityEnabled, setSecurityEnabled] = useState(draft.securityEnabled ?? true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const startISO = startDate && startTime ? `${startDate}T${startTime}:00` : '';
  const endISO = endDate && endTime ? `${endDate}T${endTime}:00` : '';
  const canProceed = startISO && endISO && new Date(endISO) > new Date(startISO);

  const handleSave = async () => {
    if (!canProceed) return;
    if (editEnd) {
      setError('');
      setPublishing(true);
      try {
        await publishTest({
          startTime: new Date(startISO).toISOString(),
          endTime: new Date(endISO).toISOString(),
          maxWarnings,
          securityEnabled,
        });
        navigate('/admin/tests');
      } catch (err) {
        setError(err.message);
      } finally {
        setPublishing(false);
      }
    } else {
      updateDraft({
        startTime: new Date(startISO).toISOString(),
        endTime: new Date(endISO).toISOString(),
        maxWarnings,
        securityEnabled,
      });
      navigate('/admin/create/summary');
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <div className="cts">
      <div className="cts__header">
        <h1>{editEnd ? 'Extend test window' : 'Choose when this test runs'}</h1>
        <p>{editEnd
          ? 'The test is currently active. You can only change the end time to extend the window.'
          : 'Set the window during which students can access and submit the test. Outside this window, the test will not be visible to students.'}</p>
      </div>

      {error && <p className="cts__error">{error}</p>}

      <div className="cts__cards-row">
        <div className="cts__card cts__card--times">
          <div className="cts__fieldset">
            <label className="cts__label">{editEnd ? 'Started' : 'Start time'}</label>
            {editEnd ? (
              <div className="cts__readonly">
                {formatDate(startDate)} at {formatTime(startTime)}
              </div>
            ) : (
              <div className="cts__row">
                <div className="cts__input-group">
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div className="cts__input-group">
                  <TimePicker value={startTime} onChange={setStartTime} />
                </div>
              </div>
            )}
          </div>
          <div className="cts__fieldset">
            <label className="cts__label">{editEnd ? 'New end time' : 'End time'}</label>
            <div className="cts__row">
              <div className="cts__input-group">
                <DatePicker value={endDate} onChange={setEndDate} />
              </div>
              <div className="cts__input-group">
                <TimePicker value={endTime} onChange={setEndTime} />
              </div>
            </div>
          </div>
          {startISO && endISO && endISO <= startISO && (
            <p className="cts__error" style={{ marginTop: 8 }}>End time must be after the start time.</p>
          )}
        </div>

        {!editEnd && (
          <div className="cts__card cts__card--security">
            <div className="cts__fieldset">
              <label className="cts__label">
                <ShieldAlert size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Security warnings
              </label>
              <div className="cts__toggle-row">
                <label className="cts__toggle">
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
                  <p className="cts__hint">warnings for tabswitch and full screen exit</p>
                  <div className="cts__row cts__row--narrow">
                    <input
                      className="cts__input cts__input--sm"
                      type="number"
                      min={1}
                      max={10}
                      value={maxWarnings}
                      onChange={(e) => setMaxWarnings(Number(e.target.value))}
                    />
                  </div>
                </>
              ) : (
                <p className="cts__hint">Tab switching, fullscreen exit, and other security checks are disabled for this test.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="cts__footer">
        <button className="cts__back" onClick={() => navigate(editEnd ? '/admin/tests' : '/admin/create/questions')}>
          <ChevronLeft size={15} /> {editEnd ? 'Back to tests' : 'Back'}
        </button>
        <button className="cts__publish" disabled={!canProceed || publishing} onClick={handleSave}>
          {editEnd ? <><Save size={15} /> {publishing ? 'Saving\u2026' : 'Save changes'}</> : <>{'Next: Review'} <ChevronRight size={15} /></>}
        </button>
      </div>
    </div>
  );
}
