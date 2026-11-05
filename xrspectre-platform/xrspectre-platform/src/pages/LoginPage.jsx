import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye } from 'lucide-react';
import './AuthPages.css';
import BrandMark from '../components/BrandMark';
import { getTestCredentials } from '../api/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [testLogin, setTestLogin] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTestCredentials().then((creds) => {
      if (!cancelled && creds?.email && creds?.password) setTestLogin(creds);
    });
    return () => { cancelled = true; };
  }, []);

  const fillTestLogin = () => {
    setEmail(testLogin.email);
    setPassword(testLogin.password);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login({ email, password });
      const redirectMap = { ADMIN: '/admin/tests', MENTOR: '/mentor/students', STUDENT: '/student/tests' };
      navigate(redirectMap[user.role] || '/login');
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
        <p className="auth__subtitle">Access your tests or your admin dashboard.</p>

        {testLogin && (
          <div className="auth__demo">
            <div className="auth__demo-title">Test admin login</div>
            <div className="auth__demo-row"><span>ID</span><code>{testLogin.email}</code></div>
            <div className="auth__demo-row"><span>Password</span><code>{testLogin.password}</code></div>
            <button type="button" className="auth__demo-fill" onClick={fillTestLogin}>Fill in</button>
          </div>
        )}

        {error && <div className="auth__error">{error}</div>}

        <label className="auth__label">Email</label>
        <input
          className="auth__input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label className="auth__label">Password</label>
        <div className="auth__pw">
          <input
            className="auth__input"
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button type="button" className="auth__pw-toggle" onClick={() => setShowPw((v) => !v)} tabIndex={-1}><Eye size={16} /></button>
        </div>

        <button className="auth__submit" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        <p className="auth__switch">
          Don't have an account? <Link to="/signup/student">Sign up as student</Link>.
        </p>

      </form>
    </div>
  );
}
