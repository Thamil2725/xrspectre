import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInstitutions, getDepartments, getBatches } from '../api/org';
import { Eye } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import './AuthPages.css';
import BrandMark from '../components/BrandMark';

export default function StudentSignupPage() {
  const navigate = useNavigate();
  const { signupStudent } = useAuth();

  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loadingOrg, setLoadingOrg] = useState(true);

  const [form, setForm] = useState({
    name: '', email: '', password: '', institutionId: '', departmentId: '', batchId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    Promise.all([getInstitutions(), getDepartments()])
      .then(([inst, dept]) => {
        setInstitutions(inst);
        setDepartments(dept);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOrg(false));
  }, []);

  useEffect(() => {
    if (!form.institutionId || !form.departmentId) { setBatches([]); return; }
    setForm((f) => ({ ...f, batchId: '' }));
    getBatches(form.institutionId, form.departmentId)
      .then(setBatches)
      .catch(() => {});
  }, [form.institutionId, form.departmentId]);

  const departmentsForInstitution = departments.filter((d) => d.institutionId === form.institutionId);

  const instOptions = institutions.map((i) => ({ value: i.id, label: i.name }));
  const deptOptions = departmentsForInstitution.map((d) => ({ value: d.id, label: d.name }));
  const batchOptions = batches.map((b) => ({ value: b.id, label: b.name }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.institutionId || !form.departmentId || !form.batchId) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signupStudent(form);
      navigate('/student/tests');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={handleSubmit}>
        <div className="auth__brand">
          <span className="auth__logo"><BrandMark size={18} /></span>
          <h1 className="auth__title">XRSpectre</h1>
        </div>
        <p className="auth__tagline">Deconstruct your code down to silicon</p>
        <p className="auth__subtitle">Create an account to take your assigned tests.</p>

        {error && <div className="auth__error">{error}</div>}

        <label className="auth__label">Full name</label>
        <input className="auth__input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />

        <label className="auth__label">Email</label>
        <input className="auth__input" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />

        <label className="auth__label">Password</label>
        <div className="auth__pw">
          <input className="auth__input" type={showPw ? 'text' : 'password'} required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters" />
          <button type="button" className="auth__pw-toggle" onClick={() => setShowPw((v) => !v)} tabIndex={-1}><Eye size={16} /></button>
        </div>

        <label className="auth__label">Institution</label>
        <CustomSelect
          options={instOptions}
          value={form.institutionId}
          onChange={(v) => setForm((f) => ({ ...f, institutionId: v, departmentId: '', batchId: '' }))}
          placeholder={loadingOrg ? 'Loading…' : 'Select institution'}
          disabled={loadingOrg}
        />

        <label className="auth__label">Department</label>
        <CustomSelect
          options={deptOptions}
          value={form.departmentId}
          onChange={(v) => setForm((f) => ({ ...f, departmentId: v, batchId: '' }))}
          placeholder={form.institutionId ? 'Select department' : 'Select an institution first'}
          disabled={!form.institutionId}
        />

        <label className="auth__label">Batch</label>
        <CustomSelect
          options={batchOptions}
          value={form.batchId}
          onChange={(v) => setForm((f) => ({ ...f, batchId: v }))}
          placeholder={form.departmentId ? 'Select batch' : 'Select a department first'}
          disabled={!form.departmentId}
        />

        <button className="auth__submit" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth__switch">
          Already have an account? <Link to="/login">Log in</Link>.
        </p>
      </form>
    </div>
  );
}
