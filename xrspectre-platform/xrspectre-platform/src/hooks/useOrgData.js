import { useState, useEffect } from 'react';
import { getInstitutions, getDepartments, getBatches } from '../api/org';

export function useOrgData() {
  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getInstitutions(), getDepartments(), getBatches()])
      .then(([inst, dept, batch]) => {
        if (cancelled) return;
        setInstitutions(inst);
        setDepartments(dept);
        setBatches(batch);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { institutions, departments, batches, loading, error };
}
