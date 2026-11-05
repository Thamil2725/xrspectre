import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, Send } from 'lucide-react';
import QuestionRail from '../components/QuestionRail';
import TimerStrip from '../components/TimerStrip';
import ProblemPanel from '../components/ProblemPanel';
import EditorPanel from '../components/EditorPanel';
import { STARTER_CODE } from '../data/starterCode';
import * as studentTestsApi from '../api/studentTests';
import TechUI from '../components/TechUI';
import './StudentTest.css';

export default function StudentTest() {
  const navigate = useNavigate();
  const { testId } = useParams();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeIndex, setActiveIndex] = useState(0);
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('dark');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [output, setOutput] = useState(null);

  // Submit confirmation modal
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(null);

  // Question submit confirmation modal
  const [showQuestionSubmitConfirm, setShowQuestionSubmitConfirm] = useState(false);

  // Time-up forced submit modal
  const [showTimeUp, setShowTimeUp] = useState(false);

  // Test submission progress
  const [submitProgress, setSubmitProgress] = useState(null);
  const [fakeProgress, setFakeProgress] = useState(0);
  const submitStartTime = useRef(0);

  // Fullscreen / warning state
  const [warningInfo, setWarningInfo] = useState(null); // { warningCount, maxWarnings, disqualified }
  const [showWarning, setShowWarning] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [disqualCountdown, setDisqualCountdown] = useState(10);
  const lastWarningTime = useRef(0);
  const hasSubmittedRef = useRef(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const submittingRef = useRef(false);
  const showTimeUpRef = useRef(false);

  // Reload intercept modal
  const [showReloadIntercept, setShowReloadIntercept] = useState(false);

  const [split, setSplit] = useState(40);
  const draggingSplit = useRef(false);
  const splitStartX = useRef(0);
  const splitStartPct = useRef(0);
  const splitBodyRef = useRef(null);

  const handleSplitStart = useCallback((e) => {
    draggingSplit.current = true;
    splitStartX.current = e.clientX;
    splitStartPct.current = split;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [split]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!draggingSplit.current) return;
      const body = splitBodyRef.current;
      if (!body) return;
      const rect = body.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.max(25, Math.min(60, pct)));
    };
    const handleUp = () => {
      if (!draggingSplit.current) return;
      draggingSplit.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const [subjectiveAnswers, setSubjectiveAnswers] = useState({});
  const [codeByQuestion, setCodeByQuestion] = useState({});
  const [statuses, setStatuses] = useState({});
  const [questionTimeLeft, setQuestionTimeLeft] = useState({});
  const [overallTimeLeft, setOverallTimeLeft] = useState(0);
  const [overallTotalSeconds, setOverallTotalSeconds] = useState(0);
  const overallTotalSecondsRef = useRef(0);
  const autoSubmittedRef = useRef(new Set());
  const [timedOutQuestions, setTimedOutQuestions] = useState(new Set());

  // Refs so event handlers (beforeunload, blocker) can read current state
  const codeByQuestionRef = useRef(codeByQuestion);
  const subjectiveAnswersRef = useRef(subjectiveAnswers);
  const languageRef = useRef(language);
  const testRef = useRef(test);
  useEffect(() => { codeByQuestionRef.current = codeByQuestion; }, [codeByQuestion]);
  useEffect(() => { subjectiveAnswersRef.current = subjectiveAnswers; }, [subjectiveAnswers]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { testRef.current = test; }, [test]);
  useEffect(() => { showTimeUpRef.current = showTimeUp; }, [showTimeUp]);
  useEffect(() => { hasSubmittedRef.current = hasSubmitted; }, [hasSubmitted]);
  useEffect(() => { overallTotalSecondsRef.current = overallTotalSeconds; }, [overallTotalSeconds]);

  // Sync hasSubmitted state with submitProgress for render access
  useEffect(() => { setHasSubmitted(submitProgress !== null); }, [submitProgress]);

  // Build unsaved answers payload for auto-submit (beforeunload / blocker)
  const buildAutoSubmitAnswers = useCallback(() => {
    const t = testRef.current;
    const code = codeByQuestionRef.current;
    const subj = subjectiveAnswersRef.current;
    const lang = languageRef.current;
    if (!t) return [];
    const answers = [];
    for (const q of t.questions) {
      if (q.type === 'SUBJECTIVE') {
        const answer = subj[q.id];
        if (answer) answers.push({ questionId: q.id, answer });
      } else {
        const qCode = code[q.id]?.[lang];
        if (qCode) answers.push({ questionId: q.id, code: qCode, language: lang });
      }
    }
    return answers;
  }, []);

  const SESSION_KEY = `test_session_${testId}`;

  const clearSession = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  };

  // Load persisted session state on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.questionTimeLeft) {
          setQuestionTimeLeft(parsed.questionTimeLeft);
          const timedOut = new Set();
          for (const [qid, secs] of Object.entries(parsed.questionTimeLeft)) {
            if (secs <= 0) {
              timedOut.add(qid);
              autoSubmittedRef.current.add(qid);
            }
          }
          if (timedOut.size > 0) setTimedOutQuestions(timedOut);
        }
        if (parsed.codeByQuestion) setCodeByQuestion(parsed.codeByQuestion);
        if (parsed.statuses) setStatuses(parsed.statuses);
        if (parsed.subjectiveAnswers) setSubjectiveAnswers(parsed.subjectiveAnswers);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.theme) setTheme(parsed.theme);
        if (typeof parsed.activeIndex === 'number') setActiveIndex(parsed.activeIndex);
      }
    } catch {
      // ignore corrupt session data
    }
  }, [SESSION_KEY]);

  useEffect(() => {
    let cancelled = false;
    studentTestsApi.startOrResumeAttempt(testId)
      .then((data) => {
        if (cancelled) return;
        setTest(data.test);

        // Only initialize fresh if no persisted session exists
        try {
          const saved = sessionStorage.getItem(SESSION_KEY);
          if (saved) {
            if (data.reopenedAt) {
              sessionStorage.removeItem(SESSION_KEY);
            } else {
              const deadline = new Date(data.startedAt).getTime() + data.test.questions.reduce((sum, q) => sum + q.timeAllottedMinutes * 60, 0) * 1000;
              const totalSeconds = data.test.questions.reduce((sum, q) => sum + q.timeAllottedMinutes * 60, 0);
              overallTotalSecondsRef.current = totalSeconds;
              setOverallTotalSeconds(totalSeconds);
              setOverallTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
              return; // skip fresh init — restored from session above
            }
          }
        } catch {
          // ignore
        }

        const initCode = {};
        const initStatus = {};
        const initQTime = {};
        data.test.questions.forEach((q) => {
          // functionTemplates is stored as {} when a question has no
          // signature, so fall back to the stdin starter per language.
          initCode[q.id] = { ...STARTER_CODE, ...(q.functionTemplates || {}) };
          initStatus[q.id] = 'untouched';
          initQTime[q.id] = q.timeAllottedMinutes * 60;
        });
        setCodeByQuestion(initCode);
        setStatuses(initStatus);
        setQuestionTimeLeft(initQTime);
        setActiveIndex(0);
        setSubjectiveAnswers({});
        setOutput(null);

        // Student gets time based on sum of all question timeAllottedMinutes
        const totalSeconds = data.test.questions.reduce((sum, q) => sum + q.timeAllottedMinutes * 60, 0);
        const deadline = new Date(data.startedAt).getTime() + totalSeconds * 1000;
        overallTotalSecondsRef.current = totalSeconds;
        setOverallTotalSeconds(totalSeconds);
        setOverallTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
      })
      .catch((err) => {
        if (!cancelled) {
          if (err.message?.includes('already submitted')) {
            clearSession();
            navigate('/student/submitted');
          } else {
            setLoadError(err.message);
          }
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [testId, SESSION_KEY]);

  // Persist state to sessionStorage on every change
  useEffect(() => {
    if (!test) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        questionTimeLeft,
        codeByQuestion,
        statuses,
        subjectiveAnswers,
        language,
        theme,
        activeIndex,
        timedOutQuestions: [...timedOutQuestions],
      }));
    } catch {
      // quota exceeded — silently ignore
    }
  }, [questionTimeLeft, codeByQuestion, statuses, subjectiveAnswers, language, theme, activeIndex, timedOutQuestions, SESSION_KEY, test]);

  const activeQuestion = test?.questions[activeIndex];
  const activeQuestionIdRef = useRef(activeQuestion?.id);
  useEffect(() => { activeQuestionIdRef.current = activeQuestion?.id; }, [activeQuestion?.id]);

  // Single interval — never re-created on question switch. Reads the
  // current active question ID from a ref to avoid stale closures.
  useEffect(() => {
    const interval = setInterval(() => {
      setOverallTimeLeft((t) => Math.max(0, t - 1));
      const qid = activeQuestionIdRef.current;
      if (qid) {
        setQuestionTimeLeft((prev) => ({
          ...prev,
          [qid]: Math.max(0, (prev[qid] ?? 0) - 1),
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-submit when overall time hits zero
  useEffect(() => {
    if (overallTimeLeft > 0 || !test) return;
    setShowTimeUp(true);
  }, [overallTimeLeft, test]);

  const advanceToNextQuestion = useCallback(() => {
    if (!test) return;
    const nextIndex = activeIndex + 1;
    if (nextIndex < test.questions.length) {
      setActiveIndex(nextIndex);
      setOutput(null);
    } else {
      setAutoSubmitCountdown(10);
    }
  }, [test, activeIndex]);

  // Auto-submit entire test after 10s countdown when last question is submitted
  useEffect(() => {
    if (autoSubmitCountdown === null || hasSubmitted) return;
    if (autoSubmitCountdown <= 0) {
      setAutoSubmitCountdown(null);
      doSubmitTest();
      return;
    }
    const timer = setTimeout(() => setAutoSubmitCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoSubmitCountdown, hasSubmitted]);

  // Auto-submit a question when its time hits zero
  useEffect(() => {
    let shouldAdvance = false;
    for (const [qid, seconds] of Object.entries(questionTimeLeft)) {
      if (seconds <= 0 && !autoSubmittedRef.current.has(qid)) {
        autoSubmittedRef.current.add(qid);
        setTimedOutQuestions((prev) => new Set([...prev, qid]));
        setStatuses((prev) => (prev[qid] === 'solved' || prev[qid] === 'timedOut' ? prev : { ...prev, [qid]: 'timedOut' }));
        const q = test?.questions.find((q) => q.id === qid);
        if (q) {
          const lang = languageRef.current;
          const codeSnap = codeByQuestionRef.current;
          if (q.type === 'SUBJECTIVE') {
            const ans = subjectiveAnswersRef.current[qid];
            if (ans) {
              studentTestsApi.submitQuestion(testId, { questionId: qid, answer: ans }).catch(() => {});
            }
          } else {
            const qCode = codeSnap[qid]?.[lang];
            if (qCode) {
              studentTestsApi.submitQuestion(testId, { questionId: qid, language: lang, code: qCode }).catch(() => {});
            }
          }
        }
        if (qid === activeQuestionIdRef.current) {
          shouldAdvance = true;
        }
      }
    }
    if (shouldAdvance) {
      setTimeout(() => advanceToNextQuestion(), 300);
    }
  }, [questionTimeLeft, test, testId, advanceToNextQuestion]);

  // Block navigation away from the test
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !hasSubmitted && currentLocation.pathname !== nextLocation.pathname
  );

  // Auto-submit silently when navigation is blocked (no modal shown)
  useEffect(() => {
    if (blocker.state !== 'blocked' || hasSubmitted || submittingRef.current) return;
    (async () => {
      hasSubmittedRef.current = true;
      try { await studentTestsApi.autoSubmit(testId, buildAutoSubmitAnswers()); } catch { /* best-effort */ }
      clearSession();
      blocker.proceed();
    })();
  }, [blocker.state, hasSubmitted, testId, buildAutoSubmitAnswers]);

  useEffect(() => {
    const handler = (e) => {
      if (hasSubmittedRef.current || submittingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      // Auto-submit via fetch keepalive — reliable even as the page unloads
      try {
        studentTestsApi.autoSubmit(testId, buildAutoSubmitAnswers(), true);
      } catch { /* best-effort */ }
      clearSession();
    };
    window.addEventListener('beforeunload', handler);

    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [hasSubmitted, testId, buildAutoSubmitAnswers]);

  const code = activeQuestion ? codeByQuestion[activeQuestion.id]?.[language] ?? '' : '';
  const isSubjective = activeQuestion?.type === 'SUBJECTIVE';
  const subjectiveAnswer = isSubjective ? (subjectiveAnswers[activeQuestion.id] ?? '') : '';
  const questionLocked = activeQuestion ? timedOutQuestions.has(activeQuestion.id) : false;

  const handleSubjectiveChange = useCallback((value) => {
    if (!activeQuestion) return;
    setSubjectiveAnswers((prev) => ({ ...prev, [activeQuestion.id]: value }));
    setStatuses((prev) => (
      prev[activeQuestion.id] === 'untouched'
        ? { ...prev, [activeQuestion.id]: 'attempted' }
        : prev
    ));
  }, [activeQuestion?.id]);

  const doSubmitSubjective = async () => {
    if (!activeQuestion || questionLocked) return;
    setIsSubmittingQuestion(true);
    try {
      await studentTestsApi.submitQuestion(testId, {
        questionId: activeQuestion.id,
        answer: subjectiveAnswer,
      });
      setStatuses((prev) => ({ ...prev, [activeQuestion.id]: 'solved' }));
      setOutput({ type: 'text', text: 'Answer saved. It will be graded when you submit the test.', isError: false });
      advanceToNextQuestion();
    } catch (err) {
      setOutput({ type: 'text', text: err.message, isError: true });
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleSubmitSubjective = () => {
    if (!activeQuestion || questionLocked) return;
    setShowQuestionSubmitConfirm(true);
  };

  const handleCodeChange = useCallback((value) => {
    if (!activeQuestion) return;
    setCodeByQuestion((prev) => ({
      ...prev,
      [activeQuestion.id]: { ...prev[activeQuestion.id], [language]: value },
    }));
    setStatuses((prev) => (
      prev[activeQuestion.id] === 'untouched'
        ? { ...prev, [activeQuestion.id]: 'attempted' }
        : prev
    ));
  }, [activeQuestion?.id, language]);

  const handleRun = async () => {
    if (!activeQuestion || questionLocked) return;
    setIsRunning(true);
    setOutput(null);
    try {
      const result = await studentTestsApi.runCode(testId, {
        questionId: activeQuestion.id,
        language,
        code,
      });
      if (result.mode === 'sample') {
        const allPassed = result.results.every((r) => r.passed);
        const passed = result.results.filter((r) => r.passed).length;
        setOutput({
          type: 'test-results',
          results: result.results,
          summary: `${passed}/${result.results.length} sample tests passed`,
          allPassed,
        });
      } else {
        let text = result.stdout || '(no output)';
        let isError = false;
        if (result.timedOut) {
          text = 'Time Limit Exceeded\n' + text;
          isError = true;
        }
        if (result.stderr) {
          text = result.stderr + '\n' + text;
          isError = true;
        }
        setOutput({ type: 'text', text, isError });
      }
    } catch (err) {
      setOutput({ type: 'text', text: err.message, isError: true });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCustom = async (customInput) => {
    if (!activeQuestion || questionLocked) return;
    setIsRunning(true);
    setOutput(null);
    try {
      const result = await studentTestsApi.runCode(testId, {
        questionId: activeQuestion.id,
        language,
        code,
        customInput,
      });
      let text = result.stdout || '(no output)';
      let isError = false;
      if (result.timedOut) {
        text = 'Time Limit Exceeded\n' + text;
        isError = true;
      }
      if (result.stderr) {
        text = result.stderr + '\n' + text;
        isError = true;
      }
      setOutput({ type: 'text', text, isError });
    } catch (err) {
      setOutput({ type: 'text', text: err.message, isError: true });
    } finally {
      setIsRunning(false);
    }
  };

  const doSubmitQuestion = async () => {
    if (!activeQuestion || questionLocked) return;
    setIsSubmittingQuestion(true);
    try {
      const result = await studentTestsApi.submitQuestion(testId, {
        questionId: activeQuestion.id,
        language,
        code,
      });
      const passed = result.status === 'PASSED';
      setStatuses((prev) => ({
        ...prev,
        [activeQuestion.id]: passed ? 'solved' : 'attempted',
      }));
      setOutput({
        type: 'text',
        text: `Submitted. ${result.passedCount}/${result.totalCount} test cases passed.\n${result.pointsAwarded} points awarded.`,
        isError: !passed,
      });
      advanceToNextQuestion();
    } catch (err) {
      setOutput({ type: 'text', text: err.message, isError: true });
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleSubmitQuestion = () => {
    if (!activeQuestion || questionLocked) return;
    setShowQuestionSubmitConfirm(true);
  };

  // Fullscreen / warning system
  const dismissWarning = () => {
    setShowWarning(false);
    try { document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!test || !test.securityEnabled) return;
    try { document.documentElement.requestFullscreen?.(); } catch { /* browser may block without gesture */ }
  }, [test]);

  // Disqualification countdown — auto-submit after 10s
  useEffect(() => {
    if (!disqualified || disqualCountdown <= 0) return;
    const timer = setInterval(() => {
      setDisqualCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [disqualified, disqualCountdown]);

  useEffect(() => {
    if (!disqualified || disqualCountdown > 0) return;
    (async () => {
      try { await studentTestsApi.autoSubmit(testId, buildAutoSubmitAnswers()); } catch { /* best-effort */ }
      clearSession();
      navigate('/student/submitted');
    })();
  }, [disqualified, disqualCountdown, testId, navigate, buildAutoSubmitAnswers]);

  const handleViolation = useCallback(async () => {
    if (hasSubmittedRef.current || disqualified || showTimeUpRef.current) return;
    const now = Date.now();
    if (now - lastWarningTime.current < 3000) return;
    lastWarningTime.current = now;

    try {
      const result = await studentTestsApi.submitWarning(testId);
      setWarningInfo(result);
      setShowWarning(true);

      if (result.disqualified) {
        hasSubmittedRef.current = true;
        setDisqualified(true);
        setDisqualCountdown(10);
      }
    } catch { /* server rejected — already submitted */ }
  }, [testId, disqualified]);

  useEffect(() => {
    if (!test || !test.securityEnabled) return;
    const onFullscreenChange = () => { if (!document.fullscreenElement) handleViolation(); };
    const onVisibilityChange = () => { if (document.hidden) handleViolation(); };
    const onBlur = () => { handleViolation(); };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [test, handleViolation]);

  // Block PrintScreen, dev tools, and other capture/save shortcuts
  useEffect(() => {
    if (!test || !test.securityEnabled) return;
    const handler = (e) => {
      if (hasSubmittedRef.current) return;
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        handleViolation();
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        handleViolation();
        return;
      }
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        handleViolation();
        return;
      }
      if (e.ctrlKey && ['u', 'p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        handleViolation();
        return;
      }
      // Intercept reload shortcuts — show our own modal instead of browser's native dialog
      if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        e.stopPropagation();
        setShowReloadIntercept(true);
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [test, handleViolation]);

  // Block opening new tabs
  useEffect(() => {
    if (!test || !test.securityEnabled) return;
    const origOpen = window.open;
    window.open = () => { handleViolation(); return null; };
    return () => { window.open = origOpen; };
  }, [test, handleViolation]);

  const doSubmitTest = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    hasSubmittedRef.current = true;
    submitStartTime.current = Date.now();
    setSubmitProgress({ current: 0, total: 100, message: 'Submitting test…' });
    setFakeProgress(0);
    try {
      await studentTestsApi.submitTest(testId, (p) => setSubmitProgress(p));
      setFakeProgress(100);
      setSubmitProgress((p) => p ? { ...p, current: 100, total: 100, message: 'Done!' } : p);
      clearSession();
      navigate('/student/submitted');
    } catch (err) {
      submittingRef.current = false;
      hasSubmittedRef.current = false;
      setSubmitProgress(null);
      setFakeProgress(0);
      if (err.message?.includes('already been submitted')) {
        clearSession();
        navigate('/student/submitted');
      } else {
        alert(err.message);
      }
    }
  };

  const handleSubmitTest = () => {
    setShowSubmitConfirm(true);
  };

  if (loading) {
    return <div className="stest__loading">Loading test...</div>;
  }
  if (loadError) {
    return <div className="stest__loading stest__loading--error">{loadError}</div>;
  }
  if (!activeQuestion) {
    return <div className="stest__loading">This test has no questions yet.</div>;
  }

  return (
    <div className={`stest ${theme === 'dark' ? 'stest--dark' : 'stest--light'}`} onContextMenu={test.securityEnabled ? (e) => e.preventDefault() : undefined}>
      <TimerStrip
        testTitle={test.title}
        questionSecondsLeft={questionTimeLeft[activeQuestion.id]}
        questionTotalSeconds={activeQuestion.timeAllottedMinutes * 60}
        overallSecondsLeft={overallTimeLeft}
        overallTotalSeconds={overallTotalSeconds}
        onSubmitTest={handleSubmitTest}
      />
      {!hasSubmitted && test.securityEnabled && (
        <div className="stest__warning-banner">
          Screenshotting, printing, and tab switching are prohibited and will trigger a security warning.
        </div>
      )}
      <div className="stest__body" ref={splitBodyRef}>
        <QuestionRail
          questions={test.questions}
          activeIndex={activeIndex}
          statuses={statuses}
          onSelect={(index) => { setActiveIndex(index); setOutput(null); }}
        />
        <div className="stest__problem" style={{ width: `${split}%` }}>
          <ProblemPanel question={activeQuestion} />
        </div>
        <div className="stest__split-handle" onMouseDown={handleSplitStart}>
          <div className="stest__split-bar" />
        </div>
        <div className="stest__editor">
          {isSubjective ? (
            <div className="stest__subjective">
              <div className="stest__subjective-toolbar">
                <span className="stest__subjective-label">Your answer</span>
                <button
                  className="stest__subjective-submit"
                  onClick={handleSubmitSubjective}
                  disabled={isSubmittingQuestion || !subjectiveAnswer.trim() || questionLocked}
                >
                  {isSubmittingQuestion ? 'Submitting...' : 'Submit answer'}
                </button>
              </div>
              <textarea
                className="stest__subjective-textarea"
                value={subjectiveAnswer}
                onChange={(e) => handleSubjectiveChange(e.target.value)}
                placeholder="Write your answer here..."
                disabled={isSubmittingQuestion || questionLocked}
              />
              <div className="stest__subjective-output">
                {output && (
                  <pre className={`stest__subjective-result ${output.isError ? 'stest__subjective-result--error' : ''}`}>
                    {output.text}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <EditorPanel
              code={code}
              onCodeChange={handleCodeChange}
              language={language}
              onLanguageChange={setLanguage}
              theme={theme}
              onThemeChange={setTheme}
              onRun={handleRun}
              onRunCustom={handleRunCustom}
              onSubmitQuestion={handleSubmitQuestion}
              output={output}
              isRunning={isRunning}
              isSubmitting={isSubmittingQuestion}
              functionSignature={activeQuestion.functionSignature}
              locked={questionLocked}
            />
          )}
        </div>
      </div>

      {showWarning && warningInfo && (
        <div className="stest__progress-overlay">
          <div className="stest__warning-modal">
            {disqualified ? (
              <>
                <div className="stest__warning-icon stest__warning-icon--error">
                  <ShieldAlert size={32} />
                </div>
                <h3 className="stest__warning-title stest__warning-title--error">Disqualified</h3>
                <p className="stest__warning-desc">
                  Maximum warnings exceeded. Your test is being auto-submitted.
                </p>
                <div className="stest__warning-countdown">
                  <span className="stest__warning-countdown-num">{disqualCountdown}</span>
                  <span className="stest__warning-countdown-label">seconds</span>
                </div>
                <div className="stest__progress-bar-track">
                  <div
                    className="stest__progress-bar-fill stest__progress-bar-fill--red"
                    style={{ width: `${((10 - disqualCountdown) / 10) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="stest__warning-icon">
                  <AlertTriangle size={28} />
                </div>
                <h3 className="stest__warning-title">Security Violation</h3>
                <p className="stest__warning-desc">
                  You exited fullscreen or switched tabs.
                </p>
                <div className="stest__warning-dots">
                  {Array.from({ length: warningInfo.maxWarnings }, (_, i) => (
                    <div
                      key={i}
                      className={`stest__warning-dot ${i < warningInfo.warningCount ? 'stest__warning-dot--filled' : ''}`}
                    />
                  ))}
                </div>
                <p className="stest__warning-count">
                  {warningInfo.warningCount} of {warningInfo.maxWarnings} warnings
                </p>
                <button className="stest__warning-btn" onClick={dismissWarning}>
                  Continue test
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showReloadIntercept && !disqualified && !hasSubmitted && (
        <div className="stest__progress-overlay">
          <div className="stest__warning-modal">
            <div className="stest__warning-icon stest__warning-icon--amber">
              <AlertTriangle size={28} />
            </div>
            <h3 className="stest__warning-title">Page Reload Blocked</h3>
            <p className="stest__warning-desc">
              Reloading will auto-submit your test. Submit manually or continue working.
            </p>
            <div className="stest__warning-actions">
              <button
                className="stest__warning-btn stest__warning-btn--submit"
                onClick={() => {
                  setShowReloadIntercept(false);
                  doSubmitTest();
                }}
              >
                Submit test
              </button>
              <button
                className="stest__warning-btn"
                onClick={() => setShowReloadIntercept(false)}
              >
                Continue test
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimeUp && (
        <div className="stest__progress-overlay">
          <div className="stest__warning-modal">
            <div className="stest__warning-icon stest__warning-icon--error">
              <AlertTriangle size={32} />
            </div>
            <h3 className="stest__warning-title stest__warning-title--error">Time's Up</h3>
            <p className="stest__warning-desc">
              Your test duration has ended. Submit your test to see your results.
            </p>
            <button
              className="stest__warning-btn stest__warning-btn--submit"
              onClick={() => { setShowTimeUp(false); doSubmitTest(); }}
            >
              Submit test
            </button>
          </div>
        </div>
      )}

      {showQuestionSubmitConfirm && (
        <div className="stest__progress-overlay">
          <div className="stest__warning-modal">
            <div className="stest__warning-icon">
              <Send size={24} />
            </div>
            <h3 className="stest__warning-title">Submit Question</h3>
            <p className="stest__warning-desc">
              You won't be able to edit this question after submitting. Are you sure?
            </p>
            <div className="stest__warning-actions">
              <button
                className="stest__warning-btn stest__warning-btn--submit"
                onClick={() => {
                  setShowQuestionSubmitConfirm(false);
                  if (isSubjective) doSubmitSubjective();
                  else doSubmitQuestion();
                }}
              >
                Submit
              </button>
              <button
                className="stest__warning-btn"
                onClick={() => setShowQuestionSubmitConfirm(false)}
              >
                Stay on question
              </button>
            </div>
          </div>
        </div>
      )}

      {autoSubmitCountdown !== null && (
        <div className="stest__progress-overlay">
          <div className="stest__warning-modal">
            <div className="stest__warning-icon">
              <Send size={24} />
            </div>
            <h3 className="stest__warning-title">All questions submitted!</h3>
            <p className="stest__warning-desc">
              Your test will be submitted automatically in <strong>{autoSubmitCountdown}</strong> second{autoSubmitCountdown !== 1 ? 's' : ''}.
            </p>
            <div className="stest__warning-actions">
              <button
                className="stest__warning-btn stest__warning-btn--submit"
                onClick={() => { setAutoSubmitCountdown(null); doSubmitTest(); }}
              >
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubmitConfirm && (
        <div className="stest__progress-overlay">
          <div className="stest__warning-modal">
            <div className="stest__warning-icon">
              <Send size={24} />
            </div>
            <h3 className="stest__warning-title">Submit Test</h3>
            <p className="stest__warning-desc">
              Once submitted, you won't be able to change any answers. Are you sure you want to submit?
            </p>
            <div className="stest__warning-actions">
              <button
                className="stest__warning-btn stest__warning-btn--submit"
                onClick={() => { setShowSubmitConfirm(false); doSubmitTest(); }}
              >
                Submit test
              </button>
              <button
                className="stest__warning-btn"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Stay on test
              </button>
            </div>
          </div>
        </div>
      )}

      {submitProgress && (
        <div className="stest__progress-overlay">
          <TechUI progress={fakeProgress} message={submitProgress.message} />
        </div>
      )}
    </div>
  );
}
