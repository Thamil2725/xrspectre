import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTestDraft } from '../context/TestDraftContext';
import * as adminTestsApi from '../api/adminTests';

export default function CreateTestEditLoader() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { updateDraft } = useTestDraft();

  useEffect(() => {
    if (!testId) { navigate('/admin/create', { replace: true }); return; }
    adminTestsApi.getTestDetails(testId)
      .then((data) => {
        updateDraft({
          testId: data.id,
          title: data.title,
          institutionIds: data.institutions.map((i) => i.id),
          departmentIds: data.departments.map((d) => d.id),
          batchIds: data.batches.map((b) => b.id),
          questionSource: data.questionSource || 'manual',
          selectedPoolIds: data.selectedPoolIds || [],
          questionsPerStudent: data.questionsPerStudent || 5,
          selectedCategoryIds: data.selectedCategoryIds || [],
          selectedQuestionIds: data.selectedQuestionIds || [],
          questionsPerCategory: data.questionsPerCategory || [],
          questions: data.questions || [],
          startTime: data.startTime || '',
          endTime: data.endTime || '',
        });
        if (data.displayStatus === 'ACTIVE') {
          navigate(`/admin/tests`, { replace: true });
        } else if (data.startTime && data.endTime) {
          navigate('/admin/create/summary', { replace: true });
        } else if (data.selectedPoolIds?.length > 0 || data.questionsPerCategory?.length > 0 || (data.questions && data.questions.length > 0)) {
          navigate('/admin/create/questions', { replace: true });
        } else {
          navigate('/admin/create', { replace: true });
        }
      })
      .catch(() => navigate('/admin/create', { replace: true }));
  }, [testId]);

  return <p style={{ color: 'var(--ink-400)', fontSize: '13.5px' }}>Loading test...</p>;
}
