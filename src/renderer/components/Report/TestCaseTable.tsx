import React, { useState, useEffect } from 'react';

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

interface TestCaseTableProps {
  reportId: number;
}

function TestCaseTable({ reportId }: TestCaseTableProps): React.ReactElement {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadTestCases();
  }, [reportId]);

  const loadTestCases = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.testRunnerGetTestCases(reportId);
      if (result.success && result.data) {
        setTestCases(result.data);
      }
    } catch (err) {
      console.error('Failed to load test cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: 'badge badge-pending',
      running: 'badge badge-running',
      passed: 'badge badge-passed',
      failed: 'badge badge-failed',
    };
    const statusLabels: Record<string, string> = {
      pending: '待执行',
      running: '执行中',
      passed: '通过',
      failed: '失败',
    };
    return <span className={statusClasses[status] || 'badge'}>{statusLabels[status] || status}</span>;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (testCases.length === 0) {
    return (
      <div className="test-case-empty">
        <p>暂无测试用例</p>
      </div>
    );
  }

  return (
    <div className="test-case-table">
      <table>
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>名称</th>
            <th>状态</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map(tc => (
            <React.Fragment key={tc.id}>
              <tr
                className={`test-case-row ${expandedId === tc.id ? 'expanded' : ''}`}
                onClick={() => toggleExpand(tc.id)}
              >
                <td className="expand-icon">
                  {expandedId === tc.id ? '▼' : '▶'}
                </td>
                <td>{tc.name}</td>
                <td>{getStatusBadge(tc.status)}</td>
                <td>-</td>
              </tr>
              {expandedId === tc.id && (
                <tr className="test-case-details">
                  <td colSpan={4}>
                    <div className="test-case-detail-content">
                      <div className="detail-section">
                        <h4>前置条件</h4>
                        <p>{tc.preconditions || '无'}</p>
                      </div>

                      <div className="detail-section">
                        <h4>测试步骤</h4>
                        {tc.steps && tc.steps.length > 0 ? (
                          <table className="steps-table">
                            <thead>
                              <tr>
                                <th>步骤</th>
                                <th>SQL</th>
                                <th>预期结果</th>
                                <th>实际结果</th>
                                <th>状态</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tc.steps.map((step, idx) => (
                                <tr key={idx} className={`step-row step-${step.status}`}>
                                  <td>{step.step}</td>
                                  <td>
                                    <code className="sql-code">{step.sql || '-'}</code>
                                  </td>
                                  <td>{step.expected || '-'}</td>
                                  <td>
                                    {step.error ? (
                                      <span className="error-text" title={step.error}>
                                        {step.error}
                                      </span>
                                    ) : (
                                      step.actual || '-'
                                    )}
                                  </td>
                                  <td>
                                    {step.status === 'passed' ? (
                                      <span className="status-icon passed">✓</span>
                                    ) : step.status === 'failed' ? (
                                      <span className="status-icon failed">✗</span>
                                    ) : (
                                      <span className="status-icon pending">○</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p>无测试步骤</p>
                        )}
                      </div>

                      <div className="detail-section">
                        <h4>预期结果</h4>
                        <p>{tc.expected_results || '无'}</p>
                      </div>

                      {tc.notes && (
                        <div className="detail-section">
                          <h4>备注</h4>
                          <p>{tc.notes}</p>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TestCaseTable;