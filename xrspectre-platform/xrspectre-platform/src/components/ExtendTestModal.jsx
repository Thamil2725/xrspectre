import { useState } from 'react';
import { X, CalendarClock } from 'lucide-react';
import { scheduleTest } from '../api/adminTests';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';
import './ExtendTestModal.css';

function toLocalParts(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function ExtendTestModal({ testId, testTitle, startTime, endTime, onClose }) {
  const { date: initStartDate, time: initStartTime } = toLocalParts(startTime);
  const { date: initEndDate, time: initEndTime } = toLocalParts(endTime);

  const [endDate, setEndDate] = useState('');
  const [endTimeVal, setEndTimeVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const endISO = endDate && endTimeVal ? `${endDate}T${endTimeVal}:00` : '';
  const startISO = `${initStartDate}T${initStartTime}:00`;
  const canSave = endISO && new Date(endISO) > new Date(startISO);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await scheduleTest(testId, {
        startTime: new Date(startISO).toISOString(),
        endTime: new Date(endISO).toISOString(),
      });
      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="etm__overlay" onClick={() => onClose(false)}>
      <div className="etm" onClick={(e) => e.stopPropagation()}>
        <div className="etm__header">
          <div className="etm__header-left">
            <CalendarClock size={18} />
            <h2>Extend test window</h2>
          </div>
          <button className="etm__close" onClick={() => onClose(false)}><X size={18} /></button>
        </div>

        <div className="etm__body">
          <p className="etm__desc">The test is currently active. You can only change the end time to extend the window.</p>

          <div className="etm__card">
            <div className="etm__fieldset">
              <label className="etm__label">Started</label>
              <div className="etm__readonly">
                {formatDate(initStartDate)} at {formatTime12(initStartTime)}
              </div>
            </div>

            <div className="etm__fieldset">
              <label className="etm__label">New end time</label>
              <div className="etm__row">
                <div className="etm__input-group">
                  <DatePicker value={endDate} onChange={setEndDate} />
                </div>
                <div className="etm__input-group">
                  <TimePicker value={endTimeVal} onChange={setEndTimeVal} />
                </div>
              </div>
            </div>

            {endISO && new Date(endISO) <= new Date(startISO) && (
              <p className="etm__error">End time must be after the start time.</p>
            )}
          </div>

          {error && <p className="etm__error">{error}</p>}
        </div>

        <div className="etm__footer">
          <button className="etm__btn" onClick={() => onClose(false)}>Cancel</button>
          <button className="etm__btn etm__btn--primary" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
