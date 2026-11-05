import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import './SubmittedPage.css';

export default function SubmittedPage() {
  const navigate = useNavigate();

  return (
    <div className="submitted">
      <div className="submitted__icon-wrap">
        <CheckCircle2 size={48} strokeWidth={1.5} className="submitted__icon" />
      </div>
      <h1>Test submitted</h1>
      <p className="submitted__desc">Your answers have been recorded. You may close this window.</p>
      <button className="submitted__btn" onClick={() => navigate('/student/tests')}>
        <ArrowLeft size={14} /> Back to tests
      </button>
    </div>
  );
}
