import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldPlus, Trash2, AlertCircle, UserPlus } from 'lucide-react';
import * as adminsApi from '../api/adminManagement';
import './ManageAdmins.css';

export default function ManageAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadAdmins = () => {
    setLoading(true);
    setError('');
    adminsApi.listAdmins()
      .then(setAdmins)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAdmins(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await adminsApi.createAdmin(form);
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
      loadAdmins();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (adminId, name) => {
    if (!window.confirm(`Remove "${name}" from the admin team?`)) return;
    setDeleting(adminId);
    setError('');
    try {
      await adminsApi.deleteAdmin(adminId);
      loadAdmins();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="madmins">
      <div className="madmins__header">
        <h1><ShieldPlus size={18} /> Admins</h1>
        <button className="madmins__btn madmins__btn--primary" onClick={() => setShowForm((v) => !v)}>
          <UserPlus size={14} /> {showForm ? 'Cancel' : 'New admin'}
        </button>
      </div>

      {error && <div className="madmins__banner madmins__banner--error"><AlertCircle size={14} /> {error}</div>}

      {showForm && (
        <form className="madmins__form" onSubmit={handleCreate}>
          <h3>Add admin</h3>
          <div className="madmins__form-row">
            <input className="madmins__input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="madmins__input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="madmins__input" type="password" placeholder="Password (min 8 chars)" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="submit" className="madmins__btn madmins__btn--primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="madmins__loading">Loading admins...</p>
      ) : admins.length === 0 ? (
        <div className="madmins__empty">No admins found.</div>
      ) : (
        <div className="madmins__list">
          {admins.map((a) => (
            <div key={a.id} className="madmins__row">
              <div className="madmins__avatar">{a.name?.charAt(0)?.toUpperCase() || '?'}</div>
              <div className="madmins__info">
                <span className="madmins__name">{a.name}</span>
                <span className="madmins__email">{a.email}</span>
              </div>
              <span className="madmins__date">Joined {new Date(a.createdAt).toLocaleDateString()}</span>
              {user?.id !== a.id && (
                <button
                  className="madmins__delete-btn"
                  onClick={() => handleDelete(a.id, a.name)}
                  disabled={deleting === a.id}
                  title="Remove admin"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
