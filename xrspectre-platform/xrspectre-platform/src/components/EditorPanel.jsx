import { useState, useEffect, useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { indentOnInput } from '@codemirror/language';
import { lintGutter } from '@codemirror/lint';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { Play, Send, ChevronDown, Terminal, Beaker, CheckCircle2, XCircle, Check } from 'lucide-react';
import { LANGUAGES, THEMES } from '../data/starterCode';
import './EditorPanel.css';

const LANG_EXTENSIONS = {
  javascript: [javascript(), lintGutter()],
  python: [python(), lintGutter()],
  c: [cpp(), lintGutter()],
  cpp: [cpp(), lintGutter()],
  java: [java(), lintGutter()],
};

function isArrayType(type) {
  return type?.endsWith('[]');
}

function combineCustomInput(raw, params) {
  const lines = raw.split('\n');
  const parsed = params.map((p, i) => {
    const line = (lines[i] ?? '').trim();
    if (line === '') return null;
    if (isArrayType(p.type)) {
      return line.split(/[\s,]+/).filter(Boolean).map((item) => coerceCustom(item, p.type));
    }
    return coerceCustom(line, p.type);
  });
  return JSON.stringify(parsed);
}

function coerceCustom(raw, type) {
  switch (type) {
    case 'int':
    case 'long':
    case 'double':
      return Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'String':
      return raw;
    case 'char':
      return raw.charAt(0);
    default:
      return raw;
  }
}

function CustomSelect({ value, options, onChange, icon: Icon, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = options.find((o) => o.id === value);

  return (
    <div className="ep__custom-select" ref={ref}>
      <button className="ep__custom-select-trigger" onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}>
        {Icon && <Icon size={13} />}
        <span>{selected?.label || value}</span>
        <ChevronDown size={11} className={`ep__custom-chevron ${open ? 'ep__custom-chevron--open' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="ep__custom-dropdown">
          {options.map((o) => (
            <button
              key={o.id}
              className={`ep__custom-option ${o.id === value ? 'ep__custom-option--selected' : ''}`}
              onClick={() => { onChange(o.id); setOpen(false); }}
            >
              <span>{o.label}</span>
              {o.id === value && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EditorPanel({
  code,
  onCodeChange,
  language,
  onLanguageChange,
  theme,
  onThemeChange,
  onRun,
  onRunCustom,
  onSubmitQuestion,
  output,
  isRunning,
  isSubmitting,
  functionSignature,
  locked: questionLocked = false,
}) {
  const [activeTab, setActiveTab] = useState('output');
  const [customInput, setCustomInput] = useState('');
  const [outputHeight, setOutputHeight] = useState(200);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    if (output) setActiveTab('output');
  }, [output]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = outputHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [outputHeight]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const maxH = rect.height - 50;
      const delta = startY.current - e.clientY;
      const newH = Math.max(80, Math.min(maxH, startH.current + delta));
      setOutputHeight(newH);
    };
    const handleUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
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

  const hasParams = functionSignature?.name && functionSignature?.params?.length > 0;

  const handleRunCustomClick = () => {
    if (hasParams) {
      const combined = combineCustomInput(customInput, functionSignature.params);
      onRunCustom?.(combined);
    } else {
      onRunCustom?.(customInput);
    }
  };

  const testResults = output?.type === 'test-results' ? output.results : null;

  function errorLabel(r) {
    if (r.timedOut) return 'Time Limit Exceeded';
    if (r.stderr && r.stderr.length > 0) return r.stderr.includes('Compilation') || r.stderr.includes('compilation') ? 'Compilation Error' : 'Runtime Error';
    return 'Wrong Answer';
  }

  const locked = isRunning || isSubmitting || questionLocked;

  return (
    <div className={`ep ${theme === 'dark' ? 'ep--dark' : 'ep--light'}`} ref={containerRef}>
      <div className="ep__toolbar">
        <CustomSelect value={language} options={LANGUAGES} onChange={onLanguageChange} disabled={locked} />

        <CustomSelect value={theme} options={THEMES} onChange={onThemeChange} disabled={locked} />

        <div className="ep__toolbar-actions">
          <button className="ep__btn ep__btn--run" onClick={onRun} disabled={locked}>
            <Play size={13} />
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button className="ep__btn ep__btn--submit" onClick={onSubmitQuestion} disabled={locked}>
            <Send size={13} />
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>

      <div className="ep__editor-wrap">
        <CodeMirror
          value={code}
          height="100%"
          theme={theme === 'dark' ? vscodeDark : vscodeLight}
          extensions={[...LANG_EXTENSIONS[language], indentOnInput()]}
          onChange={onCodeChange}
          editable={!locked}
          basicSetup={{ foldGutter: true, autocompletion: true }}
        />
        {locked && (
          <div className="ep__editor-overlay">
            {!isRunning && !isSubmitting && questionLocked ? (
              <span className="ep__spinner-label">Time's up — question auto-submitted</span>
            ) : (
              <>
                <div className="ep__spinner" />
                <span className="ep__spinner-label">{isRunning ? 'Running...' : 'Submitting...'}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="ep__resize-handle" onMouseDown={handleResizeStart}>
        <div className="ep__resize-bar" />
      </div>

      <div className="ep__bottom" style={{ height: outputHeight }}>
        <div className="ep__tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'output'}
            className={`ep__tab ${activeTab === 'output' ? 'ep__tab--active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            <Terminal size={12} /> Output
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'custom'}
            className={`ep__tab ${activeTab === 'custom' ? 'ep__tab--active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            <Beaker size={12} /> Custom input
          </button>
        </div>

        <div className="ep__panel-content">
          {activeTab === 'custom' ? (
            <div className="ep__custom-wrap">
              {functionSignature?.name && functionSignature?.params?.length > 0 && (
                <div className="ep__custom-params">
                  {functionSignature.params.map((p, i) => (
                    <div className="ep__custom-param" key={i}>
                      <span className="ep__custom-param-name">{p.name || `arg${i}`}</span>
                      <span className="ep__custom-param-type">{p.type}</span>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="ep__textarea"
                placeholder={
                  functionSignature?.name && functionSignature?.params?.length > 0
                    ? 'One value per line:\nint: 42\nint[]: 2 7 11 15\nString: hello\nString[]: a b c\nboolean: true'
                    : 'Enter custom input...'
                }
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                disabled={locked}
              />
              <button className="ep__run-custom" onClick={handleRunCustomClick} disabled={locked}>
                <Play size={11} />
                {isRunning ? 'Running...' : 'Run with input'}
              </button>
            </div>
          ) : (
            <div className="ep__output-scroll">
              {testResults ? (
                <div className="ep__test-results">
                  {output.summary && (
                    <div className={`ep__test-summary ${output.allPassed ? 'ep__test-summary--pass' : 'ep__test-summary--fail'}`}>
                      {output.allPassed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      <span>{output.summary}</span>
                    </div>
                  )}
                  {testResults.map((r, i) => (
                    <div key={i} className={`ep__test-row ${r.passed ? 'ep__test-row--pass' : 'ep__test-row--fail'}`}>
                      <div className="ep__test-status">
                        {r.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      </div>
                      <div className="ep__test-info">
                        <div className="ep__test-head">
                          <span className="ep__test-name">Test {i + 1}</span>
                          <span className="ep__test-badge">{r.passed ? 'PASS' : 'FAIL'}</span>
                        </div>
                        {!r.passed && (
                          <div className="ep__test-detail">
                            {r.timedOut && (
                              <div className="ep__test-detail-row">
                                <span className="ep__test-detail-label">Error</span>
                                <span className="ep__test-error-label">Time Limit Exceeded</span>
                              </div>
                            )}
                            {r.stderr && r.stderr.length > 0 && !r.timedOut && (
                              <div className="ep__test-detail-row">
                                <span className="ep__test-detail-label">{errorLabel(r)}</span>
                                <pre className="ep__test-error-value">{r.stderr}</pre>
                              </div>
                            )}
                            {!r.timedOut && (!r.stderr || r.stderr.length === 0) && (
                              <>
                                <div className="ep__test-detail-row">
                                  <span className="ep__test-detail-label">Expected</span>
                                  <pre className="ep__test-detail-value">{r.expectedOutput}</pre>
                                </div>
                                <div className="ep__test-detail-row">
                                  <span className="ep__test-detail-label">Got</span>
                                  <pre className="ep__test-detail-value">{r.actualOutput}</pre>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : output ? (
                <pre className={`ep__output ${output.isError ? 'ep__output--error' : ''}`}>
                  {output.text}
                </pre>
              ) : (
                <div className="ep__output ep__output--empty">
                  Run your code to see output here.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
