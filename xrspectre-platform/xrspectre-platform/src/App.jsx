import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import MentorLayout from './components/MentorLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { TestDraftProvider } from './context/TestDraftContext';
import { AuthProvider } from './context/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const StudentSignupPage = lazy(() => import('./pages/StudentSignupPage'));
const StudentTestList = lazy(() => import('./pages/StudentTestList'));
const StudentTest = lazy(() => import('./pages/StudentTest'));
const SubmittedPage = lazy(() => import('./pages/SubmittedPage'));
const AttemptDetailPage = lazy(() => import('./pages/AttemptDetailPage'));
const AllTests = lazy(() => import('./pages/AllTests'));
const EditTest = lazy(() => import('./pages/EditTest'));
const CreateTestAudience = lazy(() => import('./pages/CreateTestAudience'));
const CreateTestQuestions = lazy(() => import('./pages/CreateTestQuestions'));
const CreateTestSchedule = lazy(() => import('./pages/CreateTestSchedule'));
const CreateTestSummary = lazy(() => import('./pages/CreateTestSummary'));
const CreateTestEditLoader = lazy(() => import('./pages/CreateTestEditLoader'));
const ManageOrg = lazy(() => import('./pages/ManageOrg'));
const ManageStudents = lazy(() => import('./pages/ManageStudents'));
const QuestionPools = lazy(() => import('./pages/QuestionPools'));
const ManageAdmins = lazy(() => import('./pages/ManageAdmins'));
const ManageMentors = lazy(() => import('./pages/ManageMentors'));
const MentorStudents = lazy(() => import('./pages/MentorStudents'));
const MentorStudentDetail = lazy(() => import('./pages/MentorStudentDetail'));

function Lazy({ children }) {
  return <Suspense fallback={<div className="page-loading">Loading…</div>}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <Lazy><LoginPage /></Lazy>,
  },
  {
    path: '/signup/student',
    element: <Lazy><StudentSignupPage /></Lazy>,
  },
  {
    path: '/student/tests',
    element: <ProtectedRoute role="STUDENT"><Lazy><StudentTestList /></Lazy></ProtectedRoute>,
  },
  {
    path: '/student/tests/:testId',
    element: <ProtectedRoute role="STUDENT"><Lazy><StudentTest /></Lazy></ProtectedRoute>,
  },
  {
    path: '/student/submitted',
    element: <ProtectedRoute role="STUDENT"><Lazy><SubmittedPage /></Lazy></ProtectedRoute>,
  },
  {
    path: '/student/attempts/:attemptId',
    element: <ProtectedRoute role="STUDENT"><Lazy><AttemptDetailPage /></Lazy></ProtectedRoute>,
  },
  {
    path: '/admin',
    element: <ProtectedRoute role="ADMIN"><Lazy><AdminLayout /></Lazy></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="tests" replace /> },
      { path: 'tests', element: <Lazy><AllTests /></Lazy> },
      { path: 'tests/:testId/edit', element: <Lazy><EditTest /></Lazy> },
      { path: 'create', element: <Lazy><CreateTestAudience /></Lazy> },
      { path: 'create/edit/:testId', element: <Lazy><CreateTestEditLoader /></Lazy> },
      { path: 'create/questions', element: <Lazy><CreateTestQuestions /></Lazy> },
      { path: 'create/schedule', element: <Lazy><CreateTestSchedule /></Lazy> },
      { path: 'create/summary', element: <Lazy><CreateTestSummary /></Lazy> },
      { path: 'organizations', element: <Lazy><ManageOrg /></Lazy> },
      { path: 'students', element: <Lazy><ManageStudents /></Lazy> },
      { path: 'students/:studentId/attempts/:attemptId', element: <Lazy><AttemptDetailPage /></Lazy> },
      { path: 'pools', element: <Lazy><QuestionPools /></Lazy> },
      { path: 'admins', element: <Lazy><ManageAdmins /></Lazy> },
      { path: 'mentors', element: <Lazy><ManageMentors /></Lazy> },
    ],
  },
  {
    path: '/mentor',
    element: <ProtectedRoute role="MENTOR"><Lazy><MentorLayout /></Lazy></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="students" replace /> },
      { path: 'students', element: <Lazy><MentorStudents /></Lazy> },
      { path: 'students/:studentId', element: <Lazy><MentorStudentDetail /></Lazy> },
      { path: 'students/:studentId/attempts/:attemptId', element: <Lazy><AttemptDetailPage /></Lazy> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TestDraftProvider>
          <RouterProvider router={router} />
        </TestDraftProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
