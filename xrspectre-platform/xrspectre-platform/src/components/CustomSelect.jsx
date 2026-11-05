import { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

export default function CustomSelect({ options, value, onChange, placeholder, disabled, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`cselect${disabled ? ' cselect--disabled' : ''}${className ? ' ' + className : ''}`}>
      <button
        type="button"
        className={`cselect__btn${!selected ? ' cselect__btn--empty' : ''}`}
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="cselect__options">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              className={`cselect__option${value === o.value ? ' cselect__option--selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
