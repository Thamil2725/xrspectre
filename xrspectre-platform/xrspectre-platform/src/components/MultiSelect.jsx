import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './MultiSelect.css';

export default function MultiSelect({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const summary = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find((o) => o.id === selected[0])?.name
      : `${selected.length} selected`;

  return (
    <div className="msel" ref={ref}>
      <label className="msel__label">{label}</label>
      <button
        type="button"
        className={`msel__trigger ${open ? 'msel__trigger--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={selected.length === 0 ? 'msel__placeholder' : ''}>{summary}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="msel__menu" role="listbox">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.id);
            return (
              <button
                type="button"
                key={opt.id}
                className="msel__option"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(opt.id)}
              >
                <span className={`msel__checkbox ${isSelected ? 'msel__checkbox--checked' : ''}`}>
                  {isSelected && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="msel__option-text">
                  <span>{opt.name}</span>
                  {opt.subtitle && <span className="msel__option-sub">{opt.subtitle}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
