import { useState } from 'react';
import { Plus, Trash2, Code2 } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { generateTemplates, RETURN_TYPES, PARAM_TYPES } from '../utils/templateGenerator';

// Pure presentational form for question fields + test cases. Takes
// controlled values and setters as props so it has no opinion on
// whether it's being used to create or edit a question.

const EMPTY_PARAM = { name: '', type: '' };

function isArrayType(type) {
  return type?.endsWith('[]');
}

function parseInputToParamValues(inputStr, params) {
  if (!inputStr || !params?.length) return params?.map(() => '') ?? [];
  try {
    const parsed = JSON.parse(inputStr);
    if (!Array.isArray(parsed)) return params.map(() => inputStr);
    return params.map((p, i) => {
      const val = parsed[i];
      if (val === undefined || val === null) return '';
      if (isArrayType(p.type)) {
        if (Array.isArray(val)) return val.join(' ');
        return String(val);
      }
      if (p.type === 'String') return String(val);
      if (p.type === 'boolean') return val ? 'true' : 'false';
      return String(val);
    });
  } catch {
    return params.map(() => inputStr);
  }
}

function combineParamValuesToInput(values, params) {
  if (!params?.length) return values[0] ?? '';
  const allEmpty = values.every((v) => !v?.trim());
  if (allEmpty) return '';
  const parsed = params.map((p, i) => {
    const raw = (values[i] ?? '').trim();
    if (raw === '') return null;
    if (isArrayType(p.type)) {
      const items = raw.split(/[\s,]+/).filter(Boolean);
      return items.map((item) => coerceScalar(item, p.type));
    }
    return coerceScalar(raw, p.type);
  });
  return JSON.stringify(parsed);
}

function coerceScalar(raw, type) {
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

export default function QuestionFormFields({
  title, setTitle,
  statement, setStatement,
  points, setPoints,
  timeAllottedMinutes, setTimeAllottedMinutes,
  difficulty, setDifficulty,
  questionType = 'CODING',
  modelAnswer, setModelAnswer,
  timeLimitSecs, setTimeLimitSecs,
  memoryLimitMB, setMemoryLimitMB,
  testRows, setTestRows,
  functionSignature, setFunctionSignature,
  functionTemplates, setFunctionTemplates,
}) {
  const [showPreview, setShowPreview] = useState(false);

  const handleFuncChange = (field, value) => {
    const updated = { ...functionSignature, [field]: value };
    setFunctionSignature(updated);
    const templates = generateTemplates(updated);
    setFunctionTemplates(templates);
  };

  const updateParam = (index, field, value) => {
    const params = [...(functionSignature?.params || [])];
    params[index] = { ...params[index], [field]: value };
    handleFuncChange('params', params);
  };

  const addParam = () => {
    const params = [...(functionSignature?.params || []), { ...EMPTY_PARAM }];
    handleFuncChange('params', params);
  };

  const removeParam = (index) => {
    const params = (functionSignature?.params || []).filter((_, i) => i !== index);
    handleFuncChange('params', params);
  };

  const sig = functionSignature || {};
  const templates = (sig.name ? generateTemplates(sig) : null) || functionTemplates || {};
  const updateRow = (index, field, value) => {
    setTestRows((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };
  const addRow = () => setTestRows((prev) => [...prev, { input: '', output: '', isSample: false }]);
  const removeRow = (index) => setTestRows((prev) => prev.filter((_, i) => i !== index));

  return (
    <>
      <label className="aqm__label">Question title</label>
      <input
        className="aqm__input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Two Sum"
      />

      <label className="aqm__label">Problem statement</label>
      <textarea
        className="aqm__textarea"
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="Describe the problem, including examples and edge cases…"
      />

      <div className="aqm__row">
        <div className="aqm__field">
          <label className="aqm__label">Points</label>
          <input
            className="aqm__input"
            type="number"
            min="0"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div className="aqm__field">
          <label className="aqm__label">Time allotted (min)</label>
          <input
            className="aqm__input"
            type="number"
            min="1"
            value={timeAllottedMinutes}
            onChange={(e) => setTimeAllottedMinutes(e.target.value)}
          />
        </div>
        <div className="aqm__field">
          <label className="aqm__label">Difficulty</label>
          <CustomSelect
            options={[
              { value: 'EASY', label: 'Easy' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HARD', label: 'Hard' },
            ]}
            value={difficulty}
            onChange={(v) => setDifficulty(v)}
            placeholder="Select difficulty"
          />
        </div>
      </div>

      {questionType === 'CODING' && (
        <div className="aqm__row">
          <div className="aqm__field">
            <label className="aqm__label">Time limit (sec)</label>
            <input
              className="aqm__input"
              type="number"
              min="1"
              max="30"
              value={timeLimitSecs}
              onChange={(e) => setTimeLimitSecs?.(e.target.value)}
            />
          </div>
          <div className="aqm__field">
            <label className="aqm__label">Memory limit (MB)</label>
            <input
              className="aqm__input"
              type="number"
              min="32"
              max="1024"
              value={memoryLimitMB}
              onChange={(e) => setMemoryLimitMB?.(e.target.value)}
            />
          </div>
        </div>
      )}

      {questionType === 'SUBJECTIVE' ? (
        <>
          <label className="aqm__label">Model answer</label>
          <textarea
            className="aqm__textarea"
            value={modelAnswer ?? ''}
            onChange={(e) => setModelAnswer?.(e.target.value)}
            placeholder="Provide a reference answer for this subjective question…"
            style={{ minHeight: '120px' }}
          />
        </>
      ) : (
        <>
          <div className="aqm__section-divider" />

          <div className="aqm__func-header">
            <Code2 size={16} />
            <span>Function template</span>
            <label className="aqm__toggle">
              <input
                type="checkbox"
                checked={sig.name !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    const restored = { ...(functionSignature || {}), name: functionSignature?.name ?? '' };
                    setFunctionSignature(restored);
                    setFunctionTemplates(generateTemplates(restored));
                  } else {
                    if (functionSignature) {
                      setFunctionSignature({ ...functionSignature, name: undefined, _savedName: functionSignature.name });
                    }
                    setFunctionTemplates(null);
                  }
                }}
              />
              Enable
            </label>
          </div>

          {sig.name !== undefined && (
            <div className="aqm__func-body">
              <div className="aqm__row">
                <div className="aqm__field aqm__field--func-name">
                  <label className="aqm__label">Function name</label>
                  <input
                    className="aqm__input"
                    value={sig.name || ''}
                    onChange={(e) => handleFuncChange('name', e.target.value)}
                    placeholder="e.g. twoSum"
                  />
                </div>
                <div className="aqm__field aqm__field--ret-type">
                  <label className="aqm__label">Return type</label>
                  <CustomSelect
                    options={RETURN_TYPES.map((t) => ({ value: t, label: t }))}
                    value={sig.returnType || ''}
                    onChange={(v) => handleFuncChange('returnType', v)}
                    placeholder="Select type"
                  />
                </div>
              </div>

              <label className="aqm__label">Parameters</label>
              {(sig.params || []).map((p, i) => (
                <div className="aqm__param-row" key={i}>
                  <input
                    className="aqm__input aqm__input--param-name"
                    value={p.name}
                    onChange={(e) => updateParam(i, 'name', e.target.value)}
                    placeholder="name"
                  />
                  <CustomSelect
                    options={PARAM_TYPES.map((t) => ({ value: t, label: t }))}
                    value={p.type}
                    onChange={(v) => updateParam(i, 'type', v)}
                    placeholder="Select type"
                  />
                  <button className="aqm__param-remove" onClick={() => removeParam(i)} type="button" aria-label="Remove parameter">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button className="aqm__add-param" onClick={addParam} type="button">
                <Plus size={13} /> Add parameter
              </button>

              {templates.python && (
                <div className="aqm__func-preview">
                  <div className="aqm__preview-header">
                    <span>Generated templates</span>
                    <button
                      className="aqm__preview-toggle"
                      onClick={() => setShowPreview(!showPreview)}
                      type="button"
                    >
                      {showPreview ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showPreview && ['python', 'javascript', 'java', 'cpp', 'c'].map((lang) => (
                    <div className="aqm__preview-lang" key={lang}>
                      <span className="aqm__preview-lang-label">{lang}</span>
                      <pre className="aqm__preview-code">{templates[lang]}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="aqm__section-divider" />

          <label className="aqm__label">Test cases</label>
          <p className="aqm__sublabel">Mark a case "Sample" to show it to students on the problem page. Unmarked cases are used only for grading.</p>
          {testRows.map((t, i) => {
            const hasParams = sig.name !== undefined && sig.params?.length > 0;
            const paramValues = hasParams ? parseInputToParamValues(t.input, sig.params) : null;
            return (
              <div className="aqm__testrow-wrap" key={i}>
                <div className="aqm__testrow">
                  {hasParams ? (
                    <div className="aqm__testrow-params">
                      {sig.params.map((p, pi) => (
                        <div className="aqm__testrow-param" key={pi}>
                          <span className="aqm__testrow-param-label">{p.name || `arg${pi}`}: {p.type}</span>
                          <input
                            className="aqm__input aqm__input--mono aqm__input--param-val"
                            placeholder={isArrayType(p.type) ? `e.g. ${p.type === 'String[]' ? 'a b c' : '1 2 3'}` : `e.g. ${p.type === 'String' ? '"hello"' : p.type === 'boolean' ? 'true' : '42'}`}
                            value={paramValues[pi] ?? ''}
                            onChange={(e) => {
                              const next = [...paramValues];
                              next[pi] = e.target.value;
                              updateRow(i, 'input', combineParamValuesToInput(next, sig.params));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="aqm__input aqm__input--mono"
                      placeholder="Input"
                      value={t.input}
                      onChange={(e) => updateRow(i, 'input', e.target.value)}
                    />
                  )}
                  <input
                    className="aqm__input aqm__input--mono"
                    placeholder="Expected output"
                    value={t.output}
                    onChange={(e) => updateRow(i, 'output', e.target.value)}
                  />
                  <label className="aqm__sample-toggle">
                    <input type="checkbox" checked={t.isSample} onChange={(e) => updateRow(i, 'isSample', e.target.checked)} />
                    Sample
                  </label>
                  <button
                    className="aqm__testrow-remove"
                    onClick={() => removeRow(i)}
                    disabled={testRows.length === 1}
                    aria-label="Remove test case"
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          <button className="aqm__add-test" onClick={addRow} type="button">
            <Plus size={13} /> Add another test case
          </button>
        </>
      )}
    </>
  );
}
