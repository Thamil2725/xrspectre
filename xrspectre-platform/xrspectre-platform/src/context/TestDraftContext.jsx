import { createContext, useContext, useState, useEffect } from 'react';
import * as adminTestsApi from '../api/adminTests';

const TestDraftContext = createContext(null);

const loadSavedMaxWarnings = () => {
  try { return Number(localStorage.getItem('xrs_maxWarnings')) || 3; } catch { return 3; }
};

const loadSavedSecurityEnabled = () => {
  try { const v = localStorage.getItem('xrs_securityEnabled'); return v === null ? true : v === 'true'; } catch { return true; }
};

const emptyDraft = () => ({
  testId: null,
  title: '',
  institutionIds: [],
  departmentIds: [],
  batchIds: [],
  questionSource: 'manual',
  selectedPoolIds: [],
  questionsPerStudent: 5,
  selectedCategoryIds: [],
  selectedQuestionIds: [],
  questionsPerCategory: [],
  questions: [],
  startTime: '',
  endTime: '',
  maxWarnings: loadSavedMaxWarnings(),
  securityEnabled: loadSavedSecurityEnabled(),
});

export function TestDraftProvider({ children }) {
  const [draft, setDraft] = useState(emptyDraft());

  useEffect(() => {
    const handler = (e) => {
      if (draft.testId || draft.title) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draft.testId, draft.title]);

  const updateDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  // Step 1 → POST /admin/tests, stores the returned testId for later steps.
  // If a test already exists (e.g. user went back), update it instead.
  const createTestOnServer = async ({ title, institutionIds, departmentIds, batchIds }) => {
    if (draft.testId) {
      await adminTestsApi.updateAudience(draft.testId, {
        title, institutionIds, departmentIds, batchIds,
      });
      setDraft((prev) => ({ ...prev, title, institutionIds, departmentIds, batchIds }));
      return { id: draft.testId };
    }
    const created = await adminTestsApi.createTest({
      title, institutionIds, departmentIds, batchIds,
    });
    setDraft((prev) => ({ ...prev,
      testId: created.id, title, institutionIds, departmentIds, batchIds,
    }));
    return created;
  };

  // Step 2 (pool mode) → PATCH the test with pool configuration.
  const savePoolConfig = async ({ selectedPoolIds, questionsPerStudent, selectedCategoryIds, selectedQuestionIds, questionsPerCategory }) => {
    await adminTestsApi.updateAudience(draft.testId, {
      institutionIds: draft.institutionIds,
      departmentIds: draft.departmentIds,
      batchIds: draft.batchIds,
      questionSource: 'pool',
      selectedPoolIds,
      questionsPerStudent,
      selectedCategoryIds,
      selectedQuestionIds,
      questionsPerCategory,
    });
    setDraft((prev) => ({
      ...prev,
      questionSource: 'pool',
      selectedPoolIds,
      questionsPerStudent,
      selectedCategoryIds,
      selectedQuestionIds,
      questionsPerCategory,
    }));
  };

  // Step 2 → POST /admin/tests/:testId/questions, appends the server's
  // saved question (with real id) to local state for the list view.
  const addQuestion = async (questionPayload) => {
    const saved = await adminTestsApi.addQuestion(draft.testId, questionPayload);
    setDraft((prev) => ({ ...prev, questions: [...prev.questions, saved] }));
    return saved;
  };

  const removeQuestion = async (questionId) => {
    await adminTestsApi.removeQuestion(draft.testId, questionId);
    setDraft((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== questionId) }));
  };

  // Step 3 → POST /admin/tests/:testId/schedule, publishes the test.
  const publishTest = async ({ startTime, endTime, maxWarnings, securityEnabled }) => {
    const updated = await adminTestsApi.scheduleTest(draft.testId, { startTime, endTime, maxWarnings, securityEnabled });
    try { localStorage.setItem('xrs_maxWarnings', String(maxWarnings)); } catch { /* ignore */ }
    try { localStorage.setItem('xrs_securityEnabled', String(securityEnabled)); } catch { /* ignore */ }
    setDraft((prev) => ({ ...prev, startTime, endTime, maxWarnings, securityEnabled }));
    return updated;
  };

  const resetDraft = () => setDraft(emptyDraft());

  return (
    <TestDraftContext.Provider value={{
      draft, updateDraft, createTestOnServer, savePoolConfig, addQuestion, removeQuestion, publishTest, resetDraft,
    }}>
      {children}
    </TestDraftContext.Provider>
  );
}

export function useTestDraft() {
  const ctx = useContext(TestDraftContext);
  if (!ctx) throw new Error('useTestDraft must be used within TestDraftProvider');
  return ctx;
}
