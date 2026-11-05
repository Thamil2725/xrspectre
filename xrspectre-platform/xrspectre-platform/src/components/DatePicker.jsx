import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './DatePicker.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

function startDay(y, m) { return new Date(y, m, 1).getDay(); }

export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const today = new Date();

  const date = value ? new Date(value + 'T00:00:00') : null;
  const display = date
    ? `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    : '';

  const [viewYear, setViewYear] = useState(date ? date.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(date ? date.getMonth() : today.getMonth());

  useEffect(() => {
    if (date) { setViewYear(date.getFullYear()); setViewMonth(date.getMonth()); }
  }, [date]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (d) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const day = String(d).padStart(2, '0');
    onChange(`${viewYear}-${m}-${day}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const dim = daysInMonth(viewYear, viewMonth);
  const start = startDay(viewYear, viewMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div ref={ref} className="dp">
      <button className={`dp__btn${!display ? ' dp__btn--empty' : ''}`} onClick={() => setOpen((p) => !p)} type="button">
        {display || 'Select date'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
      </button>
      {open && (
        <div className="dp__popup">
          <div className="dp__nav">
            <button className="dp__nav-btn" onClick={prevMonth} type="button"><ChevronLeft size={14} /></button>
            <span className="dp__nav-label">{MONTHS[viewMonth]} {viewYear}</span>
            <button className="dp__nav-btn" onClick={nextMonth} type="button"><ChevronRight size={14} /></button>
          </div>
          <div className="dp__grid">
            {DAYS.map((d) => (
              <span key={d} className="dp__day-head">{d}</span>
            ))}
            {Array.from({ length: start }, (_, i) => (
              <span key={`e${i}`} className="dp__empty" />
            ))}
            {Array.from({ length: dim }, (_, i) => {
              const d = i + 1;
              const m = String(viewMonth + 1).padStart(2, '0');
              const day = String(d).padStart(2, '0');
              const ds = `${viewYear}-${m}-${day}`;
              const isToday = ds === todayStr;
              const isSelected = value === ds;
              return (
                <button
                  key={d}
                  className={`dp__day${isSelected ? ' dp__day--selected' : ''}${isToday ? ' dp__day--today' : ''}`}
                  onClick={() => handleSelect(d)}
                  type="button"
                >{d}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
