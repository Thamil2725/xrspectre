import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import './TimePicker.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export default function TimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hour = value ? value.slice(0, 2) : '';
  const min = value ? value.slice(3, 5) : '';
  const display = value || '';

  const selectHour = (h) => {
    const m = min || '00';
    onChange(`${h}:${m}`);
  };

  const selectMin = (m) => {
    const h = hour || '00';
    onChange(`${h}:${m}`);
    if (h && m) setOpen(false);
  };

  return (
    <div ref={ref} className="tp">
      <button className={`tp__btn${!display ? ' tp__btn--empty' : ''}`} onClick={() => setOpen((p) => !p)} type="button">
        <Clock size={15} />
        <span>{display || 'Select time'}</span>
      </button>
      {open && (
        <div className="tp__popup">
          <div className="tp__cols">
            <div className="tp__col">
              <div className="tp__col-label">HH</div>
              {HOURS.map((h) => (
                <button
                  key={h}
                  className={`tp__opt${hour === h ? ' tp__opt--selected' : ''}`}
                  onClick={() => selectHour(h)}
                  type="button"
                >{h}</button>
              ))}
            </div>
            <div className="tp__col">
              <div className="tp__col-label">MM</div>
              {MINUTES.map((m) => (
                <button
                  key={m}
                  className={`tp__opt${min === m ? ' tp__opt--selected' : ''}`}
                  onClick={() => selectMin(m)}
                  type="button"
                >{m}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
