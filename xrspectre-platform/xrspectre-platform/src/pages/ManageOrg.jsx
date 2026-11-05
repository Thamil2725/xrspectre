import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Building2, GraduationCap, Users, ChevronRight, AlertTriangle, X, Download } from 'lucide-react';
import * as orgApi from '../api/org';
import { downloadStudents } from '../api/students';
import './ManageOrg.css';

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function DeleteConfirmModal({ type, name, dependencies, onConfirm, onCancel, deleting }) {
  return (
    <div className="morg-modal-overlay" onClick={onCancel}>
      <div className="morg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="morg-modal__header">
          <AlertTriangle size={18} className="morg-modal__icon" />
          <h3>Delete {type}</h3>
          <button className="morg-modal__close" onClick={onCancel}><X size={16} /></button>
        </div>
        <p className="morg-modal__text">
          Are you sure you want to delete <strong>{name}</strong>?
        </p>
        {dependencies.length > 0 && (
          <>
            <p className="morg-modal__text">This will also delete:</p>
            <ul className="morg-modal__list">
              {dependencies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
          </ul>
        </>
        )}
        <p className="morg-modal__text morg-modal__warn">This action cannot be undone.</p>
        <div className="morg-modal__actions">
          <button className="morg-btn morg-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="morg-btn morg-btn--danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManageOrg() {
  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadAll = () => {
    setError('');
    return Promise.all([orgApi.getInstitutions(), orgApi.getDepartments(), orgApi.getBatches()])
      .then(([inst, dept, batch]) => {
        setInstitutions(inst);
        setDepartments(dept);
        setBatches(batch);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => { loadAll().finally(() => setLoading(false)); }, []);

  // Compute counts
  const deptCountByInst = useMemo(() => {
    const m = {};
    for (const d of departments) {
      m[d.institutionId] = (m[d.institutionId] || 0) + 1;
    }
    return m;
  }, [departments]);

  const batchCountByDept = useMemo(() => {
    const m = {};
    for (const b of batches) {
      const key = `${b.institutionId}|${b.departmentId}`;
      m[key] = (m[key] || 0) + 1;
    }
    return m;
  }, [batches]);

  const visibleDepartments = selectedInstitutionId
    ? departments.filter((d) => d.institutionId === selectedInstitutionId)
    : [];

  const visibleBatches = selectedInstitutionId && selectedDepartmentId
    ? batches.filter((b) => b.institutionId === selectedInstitutionId && b.departmentId === selectedDepartmentId)
    : [];

  const selectedInst = institutions.find((i) => i.id === selectedInstitutionId);
  const selectedDept = departments.find((d) => d.id === selectedDepartmentId);

  const handleInstitutionChange = (id) => {
    setSelectedInstitutionId(id);
    setSelectedDepartmentId('');
  };

  const handleDeleteClick = async (type, item) => {
    if (type === 'institution') {
      const deps = departments.filter((d) => d.institutionId === item.id).map((d) => `Department: ${d.name}`);
      const batchList = batches.filter((b) => b.institutionId === item.id).map((b) => `Batch: ${b.name}`);
      setDeleteTarget({ type: 'institution', id: item.id, name: item.name, dependencies: [...deps, ...batchList], force: false });
    } else if (type === 'department') {
      const batchList = batches.filter((b) => b.departmentId === item.id).map((b) => `Batch: ${b.name}`);
      setDeleteTarget({ type: 'department', id: item.id, name: item.name, dependencies: batchList, force: false });
    } else {
      setDeleteTarget({ type: 'batch', id: item.id, name: item.name, dependencies: [], force: false });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteTarget((prev) => ({ ...prev, deleting: true }));
    try {
      if (deleteTarget.type === 'institution') {
        const hasDeps = deleteTarget.dependencies.length > 0;
        await orgApi.deleteInstitution(deleteTarget.id, hasDeps);
        setSelectedInstitutionId('');
        setSelectedDepartmentId('');
      } else if (deleteTarget.type === 'department') {
        const hasDeps = deleteTarget.dependencies.length > 0;
        await orgApi.deleteDepartment(deleteTarget.id, hasDeps);
        setSelectedDepartmentId('');
      } else {
        const hasDeps = deleteTarget.dependencies.length > 0;
        await orgApi.deleteBatch(deleteTarget.id, hasDeps);
      }
      await loadAll();
      setDeleteTarget(null);
    } catch (err) {
      if (err.message && err.message.includes('Delete again to confirm')) {
        const deps = [];
        const match = err.message.match(/referenced by (.+?)\./);
        if (match) {
          match[1].split(', ').forEach((d) => deps.push(d));
        }
        setDeleteTarget((prev) => ({ ...prev, deleting: false, dependencies: deps, force: true }));
      } else {
        setError(err.message);
        setDeleteTarget(null);
      }
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--ink-400)', fontSize: '13.5px' }}>Loading…</p>;
  }

  return (
    <div className="morg">
      <div className="morg__header">
        <h1>Manage organizations</h1>
        <p>Configure the institutional, departmental, and batch structures for test management and student enrollment.</p>
      </div>

      {error && <p className="morg__error">{error}</p>}

      <div className="morg__grid">
        <InstitutionSection
          institutions={institutions}
          selectedId={selectedInstitutionId}
          deptCountByInst={deptCountByInst}
                  onSelect={handleInstitutionChange}
          onChanged={loadAll}
          onDelete={handleDeleteClick}
        />

        <DepartmentSection
          departments={visibleDepartments}
          institutionId={selectedInstitutionId}
          selectedInstName={selectedInst?.name}
          selectedId={selectedDepartmentId}
          batchCountByDept={batchCountByDept}
          onSelect={setSelectedDepartmentId}
          onChanged={loadAll}
          onDelete={handleDeleteClick}
        />

        <BatchSection
          batches={visibleBatches}
          institutionId={selectedInstitutionId}
          departmentId={selectedDepartmentId}
          selectedInstName={selectedInst?.name}
          selectedDeptName={selectedDept?.name}
          onChanged={loadAll}
          onDelete={handleDeleteClick}
        />
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          type={deleteTarget.type}
          name={deleteTarget.name}
          dependencies={deleteTarget.dependencies}
          deleting={deleteTarget.deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

/* ───── Institution ───── */
function InstitutionSection({ institutions, selectedId, deptCountByInst, onSelect, onChanged, onDelete }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (institutions.some((i) => normalize(i.name) === normalize(trimmed))) {
      setRowError('An institution with this name already exists.');
      return;
    }
    setSubmitting(true);
    setRowError('');
    try {
      await orgApi.createInstitution(trimmed);
      setName('');
      await onChanged();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="morg__section">
      <div className="morg__section-title">
        <Building2 size={16} />
        Institutions
      </div>

      <form className="morg__add-form" onSubmit={handleAdd}>
        <input
          className="morg__input"
          placeholder="Add new institution"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="morg__add-btn" type="submit" disabled={submitting || !name.trim()}>
          <Plus size={14} />
        </button>
      </form>

      {rowError && <p className="morg__row-error">{rowError}</p>}

      <ul className="morg__list">
        {institutions.length === 0 && <li className="morg__empty">No institutions yet.</li>}
        {institutions.map((inst) => {
          const deptCount = deptCountByInst[inst.id] || 0;
          return (
            <li
              className={`morg__item${inst.id === selectedId ? ' morg__item--active' : ''}`}
              key={inst.id}
              onClick={() => onSelect(inst.id)}
            >
              <span className="morg__item-name">{inst.name}</span>
              <span className="morg__item-count">{deptCount} dept{deptCount !== 1 ? 's' : ''}</span>
              <button
                className="morg__delete-btn"
                onClick={(e) => { e.stopPropagation(); onDelete('institution', inst); }}
              >
                <Trash2 size={13} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ───── Department ───── */
function DepartmentSection({ departments, institutionId, selectedInstName, selectedId, batchCountByDept, onSelect, onChanged, onDelete }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !institutionId) return;
    if (departments.some((d) => normalize(d.name) === normalize(trimmed))) {
      setRowError('A department with this name already exists in this institution.');
      return;
    }
    setSubmitting(true);
    setRowError('');
    try {
      await orgApi.createDepartment(trimmed, institutionId);
      setName('');
      await onChanged();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="morg__section">
      <div className="morg__section-title">
        <GraduationCap size={16} />
        Departments
        {selectedInstName && <span className="morg__ctx"><ChevronRight size={11} /> {selectedInstName}</span>}
      </div>

      {!institutionId ? (
        <p className="morg__empty">Select an institution first.</p>
      ) : (
        <>
          <form className="morg__add-form" onSubmit={handleAdd}>
            <input
              className="morg__input"
              placeholder="Add new department"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="morg__add-btn" type="submit" disabled={submitting || !name.trim()}>
              <Plus size={14} />
            </button>
          </form>

          {rowError && <p className="morg__row-error">{rowError}</p>}

          <ul className="morg__list">
            {departments.length === 0 && <li className="morg__empty">No departments yet.</li>}
            {departments.map((d) => {
              const key = `${d.institutionId}|${d.id}`;
              const batchCount = batchCountByDept[key] || 0;
              return (
                <li
                  className={`morg__item${d.id === selectedId ? ' morg__item--active' : ''}`}
                  key={d.id}
                  onClick={() => onSelect(d.id)}
                >
                  <span className="morg__item-name">{d.name}</span>
                  <span className="morg__item-count">{batchCount} batch{batchCount !== 1 ? 'es' : ''}</span>
                  <button
                    className="morg__delete-btn"
                    onClick={(e) => { e.stopPropagation(); onDelete('department', d); }}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/* ───── Batch ───── */
function BatchSection({ batches, institutionId, departmentId, selectedInstName, selectedDeptName, onChanged, onDelete }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [studentCount, setStudentCount] = useState(null);

  useEffect(() => {
    if (!departmentId) { setStudentCount(null); return; }
    downloadStudents({ institutionId, departmentId }, null, true)
      .then((c) => setStudentCount(c))
      .catch(() => setStudentCount(0));
  }, [institutionId, departmentId]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const inst = selectedInstName?.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'unknown';
      const dept = selectedDeptName?.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'unknown';
      await downloadStudents({ institutionId, departmentId }, `${inst}_${dept}_students.csv`);
    } catch {
    } finally {
      setDownloading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !institutionId || !departmentId) return;
    if (batches.some((b) => normalize(b.name) === normalize(trimmed))) {
      setRowError('A batch with this name already exists in this department.');
      return;
    }
    setSubmitting(true);
    setRowError('');
    try {
      await orgApi.createBatch(trimmed, institutionId, departmentId);
      setName('');
      await onChanged();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="morg__section">
      <div className="morg__section-title">
        <Users size={16} />
        Batches
        {selectedInstName && <span className="morg__ctx"><ChevronRight size={11} /> {selectedInstName}</span>}
        {selectedDeptName && <span className="morg__ctx"><ChevronRight size={11} /> {selectedDeptName}</span>}
      </div>

      {!departmentId ? (
        <p className="morg__empty">Select a department first.</p>
      ) : (
        <>
          <form className="morg__add-form" onSubmit={handleAdd}>
            <input
              className="morg__input"
              placeholder="Add new batch"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="morg__add-btn" type="submit" disabled={submitting || !name.trim()}>
              <Plus size={14} />
            </button>
          </form>

          {rowError && <p className="morg__row-error">{rowError}</p>}

          <ul className="morg__list">
            {batches.length === 0 && <li className="morg__empty">No batches yet.</li>}
            {batches.map((batch) => (
              <li className="morg__item" key={batch.id}>
                <span className="morg__item-name">{batch.name}</span>
                <button
                  className="morg__delete-btn"
                  onClick={() => onDelete('batch', batch)}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>

          <button
            className="morg__download-btn"
            onClick={handleDownload}
            disabled={downloading || studentCount === 0}
            title={studentCount === 0 ? 'No Students in this Category' : ''}
          >
            <Download size={14} />
            Download Students from Selected Category
          </button>
        </>
      )}
    </section>
  );
}
