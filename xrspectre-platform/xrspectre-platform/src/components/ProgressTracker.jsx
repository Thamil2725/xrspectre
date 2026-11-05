import { Check } from 'lucide-react';
import './ProgressTracker.css';

const STEPS = [
  { num: 1, label: 'Audience' },
  { num: 2, label: 'Questions' },
  { num: 3, label: 'Review' },
];

export default function ProgressTracker({ currentStep }) {
  return (
    <div className="pt">
      {STEPS.map((s, i) => {
        const done = currentStep > s.num;
        const active = currentStep === s.num;
        return (
          <div key={s.num} className={`pt__step${done ? ' pt__step--done' : ''}${active ? ' pt__step--active' : ''}`}>
            <div className="pt__circle">
              {done ? <Check size={12} strokeWidth={3} /> : s.num}
            </div>
            <span className="pt__label">{s.label}</span>
            {i < STEPS.length - 1 && <div className="pt__line" />}
          </div>
        );
      })}
    </div>
  );
}
