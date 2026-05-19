import React, { useState } from 'react';

interface TestStep {
  step: string;
  sql?: string;
  expected?: string;
  actual?: string;
  status: 'pending' | 'passed' | 'failed';
  error?: string;
}

interface TestCase {
  id: string;
  name: string;
  preconditions: string;
  steps: TestStep[];
  expected_results: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  notes: string;
}

interface TestRunnerProps {
  reportId: number;
  onClose: () => void;
  onTestCaseCreated: () => void;
}

function TestRunner({ reportId, onClose, onTestCaseCreated }: TestRunnerProps): React.ReactElement {
  const [requirement, setRequirement] = useState('');
  const [parsedCase, setParsedCase] = useState<Partial<TestCase> | null>(null);
  const [editableCase, setEditableCase] = useState<Partial<TestCase> | null>(null);
  const [parsing, setParsing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const handleParse = async () => {
    if (!requirement.trim()) {
      setError('请输入需求描述');
      return;
    }

    setParsing(true);
    setError(null);
    setProgress('正在解析需求...');

    try {
      const result = await window.electronAPI.testRunnerParseRequirements(requirement);
      if (result.success && result.testCase) {
        setParsedCase(result.testCase);
        setEditableCase({ ...result.testCase });
        setProgress('需求解析完成');
      } else {
        setError(result.error || '解析失败');
        setProgress('');
      }
    } catch (err: any) {
      setError(err.message || '解析失败');
      setProgress('');
    } finally {
      setParsing(false);
    }
  };

  const handleExecute = async () => {
    if (!editableCase || !editableCase.name) {
      setError('请先解析需求');
      return;
    }

    setExecuting(true);
    setError(null);
    setProgress('正在执行测试...');

    try {
      const testCaseToExecute: TestCase = {
        id: '',
        name: editableCase.name || '',
        preconditions: editableCase.preconditions || '',
        steps: editableCase.steps || [],
        expected_results: editableCase.expected_results || '',
        status: 'running',
        notes: editableCase.notes || '',
      };

      const result = await window.electronAPI.testRunnerExecute(testCaseToExecute, reportId);

      if (result.success) {
        setProgress('测试执行完成');
        onTestCaseCreated();
      } else {
        setError(result.error || '执行失败');
        setProgress('');
      }
    } catch (err: any) {
      setError(err.message || '执行失败');
      setProgress('');
    } finally {
      setExecuting(false);
    }
  };

  const updateEditableStep = (index: number, field: keyof TestStep, value: string) => {
    if (!editableCase || !editableCase.steps) return;

    const newSteps = [...editableCase.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setEditableCase({ ...editableCase, steps: newSteps });
  };

  const handleFieldChange = (field: keyof TestCase, value: string) => {
    if (!editableCase) return;
    setEditableCase({ ...editableCase, [field]: value });
  };

  return (
    <div className="modal-overlay">
      <div className="modal test-runner-modal">
        <div className="modal-header">
          <h3>AI 测试用例生成器</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="requirement">需求描述</label>
            <textarea
              id="requirement"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="用自然语言描述你的测试需求，例如：验证用户能够成功登录系统，密码错误时应该提示错误..."
              rows={4}
              disabled={parsing || executing}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleParse}
            disabled={parsing || executing || !requirement.trim()}
          >
            {parsing ? '解析中...' : '解析需求'}
          </button>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {progress && !error && (
            <div className="progress-message">
              {progress}
            </div>
          )}

          {editableCase && (
            <div className="parsed-case">
              <h4>解析结果（可编辑）</h4>

              <div className="form-group">
                <label htmlFor="caseName">测试用例名称</label>
                <input
                  id="caseName"
                  type="text"
                  value={editableCase.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  disabled={executing}
                />
              </div>

              <div className="form-group">
                <label htmlFor="preconditions">前置条件</label>
                <textarea
                  id="preconditions"
                  value={editableCase.preconditions || ''}
                  onChange={(e) => handleFieldChange('preconditions', e.target.value)}
                  rows={2}
                  disabled={executing}
                />
              </div>

              <div className="form-group">
                <label>测试步骤</label>
                {editableCase.steps && editableCase.steps.length > 0 ? (
                  <div className="steps-editor">
                    {editableCase.steps.map((step, idx) => (
                      <div key={idx} className="step-editor">
                        <span className="step-number">{idx + 1}</span>
                        <div className="step-fields">
                          <input
                            type="text"
                            placeholder="步骤描述"
                            value={step.step}
                            onChange={(e) => updateEditableStep(idx, 'step', e.target.value)}
                            disabled={executing}
                          />
                          <textarea
                            placeholder="SQL 查询（可选）"
                            value={step.sql || ''}
                            onChange={(e) => updateEditableStep(idx, 'sql', e.target.value)}
                            rows={2}
                            disabled={executing}
                          />
                          <input
                            type="text"
                            placeholder="预期结果"
                            value={step.expected || ''}
                            onChange={(e) => updateEditableStep(idx, 'expected', e.target.value)}
                            disabled={executing}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-steps">无测试步骤</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="expectedResults">预期结果</label>
                <textarea
                  id="expectedResults"
                  value={editableCase.expected_results || ''}
                  onChange={(e) => handleFieldChange('expected_results', e.target.value)}
                  rows={2}
                  disabled={executing}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">备注</label>
                <textarea
                  id="notes"
                  value={editableCase.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  rows={2}
                  disabled={executing}
                />
              </div>

              <button
                className="btn btn-success"
                onClick={handleExecute}
                disabled={executing || parsing}
              >
                {executing ? '执行中...' : '确认并执行'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TestRunner;