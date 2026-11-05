import { useState, useEffect } from 'react';
import { Users, Trash2, AlertCircle, UserPlus, Info } from 'lucide-react';
import * as orgApi from '../api/org';
import * as mentorsApi from '../api/mentorManagement';
import CustomSelect from '../components/CustomSelect';
import MultiSelect from '../components/MultiSelect';
import './ManageMentors.css';

export default function ManageMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [creating, setCreating] = useState(false);

  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', institutionId: '', departmentIds: [], batchIds: [] });

  const loadAll = () => {
    setLoading(true);
    setError('');
    mentorsApi.listMentors()
      .then(setMentors)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    orgApi.getInstitutions().then(setInstitutions).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.institutionId) {
      orgApi.getDepartments(form.institutionId).then(setDepartments).catch(() => {});
    } else {
      setDepartments([]);
      setBatches([]);
      setForm((f) => ({ ...f, departmentIds: [], batchIds: [] }));
    }
  }, [form.institutionId]);

  useEffect(() => {
    if (form.departmentIds.length > 0) {
      const fetchAll = form.departmentIds.map((dId) => orgApi.getBatches(form.institutionId, dId));
      Promise.all(fetchAll)
        .then((results) => {
          const merged = results.flat().filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
          setBatches(merged);
        })
        .catch(() => {});
    } else {
      setBatches([]);
      setForm((f) => ({ ...f, batchIds: [] }));
    }
  }, [form.departmentIds]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await mentorsApi.createMentor(form);
      setForm({ name: '', email: '', password: '', institutionId: '', departmentIds: [], batchIds: [] });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (mentorId, name) => {
    if (!window.confirm(`Remove mentor "${name}"?`)) return;
    setDeleting(mentorId);
    setError('');
    try {
      await mentorsApi.deleteMentor(mentorId);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mmentors">
      <div className="mmentors__header">
        <h1><Users size={18} /> Mentors</h1>
        <button className="mmentors__btn mmentors__btn--primary" onClick={() => setShowForm((v) => !v)}>
          <UserPlus size={14} /> {showForm ? 'Cancel' : 'New mentor'}
        </button>
      </div>

      {error && <div className="mmentors__banner mmentors__banner--error"><AlertCircle size={14} /> {error}</div>}

      {showForm && (
        <form className="mmentors__form" onSubmit={handleCreate}>
          <h3>Add mentor</h3>
          <div className="mmentors__form-grid">
            <input className="mmentors__input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="mmentors__input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="mmentors__input" type="password" placeholder="Password (min 8 chars)" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <CustomSelect
              options={institutions.map((i) => ({ value: i.id, label: i.name }))}
              value={form.institutionId}
              onChange={(v) => setForm({ ...form, institutionId: v })}
              placeholder="Select institution"
            />
          </div>
          <div className="mmentors__form-row">
            <MultiSelect
              label="Departments"
              options={departments.map((d) => ({ ...d, subtitle: institutions.find((i) => i.id === d.institutionId)?.name }))}
              selected={form.departmentIds}
              onChange={(ids) => setForm({ ...form, departmentIds: ids, batchIds: [] })}
              placeholder={!form.institutionId ? 'Select an institution first' : 'Select departments'}
            />
            <MultiSelect
              label="Batches"
              options={batches.map((b) => ({ ...b, subtitle: departments.find((d) => d.id === b.departmentId)?.name }))}
              selected={form.batchIds}
              onChange={(ids) => setForm({ ...form, batchIds: ids })}
              placeholder={form.departmentIds.length === 0 ? 'Select a department first' : 'Select batches'}
            />
          </div>
          <div className="mmentors__form-footer">
            <button type="submit" className="mmentors__btn mmentors__btn--primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create mentor'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="mmentors__loading">Loading mentors…</p>
      ) : mentors.length === 0 ? (
        <div className="mmentors__empty">No mentors yet.</div>
      ) : (
        <div className="mmentors__list">
          {mentors.map((m) => (
            <div key={m.id} className="mmentors__row">
              <div className="mmentors__avatar">{m.name?.charAt(0)?.toUpperCase() || '?'}</div>
              <div className="mmentors__info">
                <span className="mmentors__name">{m.name}</span>
                <span className="mmentors__email">{m.email}</span>
              </div>
              <span className="mmentors__audience">
                <span className="mmentors__popup-trigger">
                  <Info size={12} />
                  <span className="mmentors__popup">
                    <div className="mmentors__popup-group">
                      <strong>{m.institution}</strong>
                      {m.departments.map((d) => {
                        const deptBatches = m.batches.filter((b) => b.departmentId === d.id);
                        return (
                          <div key={d.id} className="mmentors__popup-dept">
                            {d.name}
                            {deptBatches.length > 0 && (
                              <span className="mmentors__popup-batches">
                                &nbsp;({deptBatches.map((b) => b.name).join(', ')})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </span>
                </span>
                {m.institution}
              </span>
              <button
                className="mmentors__delete-btn"
                onClick={() => handleDelete(m.id, m.name)}
                disabled={deleting === m.id}
                title="Remove mentor"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
