import React, { useState, useEffect } from 'react';
import TestCaseTable from './TestCaseTable';
import TestRunner from './TestRunner';

interface Report {
  id: number;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

declare global {
  interface Window {
    electronAPI: {
      // Existing methods
      getAppVersion: () => Promise<string>;
      getAppPath: () => Promise<string>;
      getClusters: () => Promise<any[]>;
      addCluster: (cluster: any) => Promise<any>;
      updateCluster: (id: string, cluster: any) => Promise<any>;
      deleteCluster: (id: string) => Promise<boolean>;
      testCluster: (cluster: any) => Promise<{ success: boolean; message: string }>;
      platform: string;
      // LLM methods
      llmGetConfig: () => Promise<{ success: boolean; data?: any; error?: string }>;
      llmSetConfig: (config: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      llmChat: (request: any) => Promise<{ success: boolean; content?: string; error?: string }>;
      llmGetMessages: (sessionId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
      // SQL methods
      sqlConnect: (config: any) => Promise<{ success: boolean; error?: string }>;
      sqlExecute: (sql: string) => Promise<{ success: boolean; result?: any; error?: string }>;
      sqlPlan: (sql: string) => Promise<{ success: boolean; plan?: any; error?: string }>;
      sqlCompare: (originalSql: string, optimizedSql: string) => Promise<{ success: boolean; comparison?: any; error?: string }>;
      sqlDisconnect: () => Promise<{ success: boolean }>;
      // Tuning methods
      tuningAnalyze: (sql: string) => Promise<{ success: boolean; suggestions?: any[]; error?: string }>;
      tuningSaveRecord: (record: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      tuningGetRecords: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
      // TestRunner methods
      testRunnerParseRequirements: (requirement: string) => Promise<{ success: boolean; testCase?: any; error?: string }>;
      testRunnerExecute: (testCase: any, reportId: number) => Promise<{ success: boolean; executedCase?: any; error?: string }>;
      testRunnerGetTestCases: (reportId: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
      testRunnerCreateTestCase: (reportId: number, testCase: any) => Promise<{ success: boolean; executedCase?: any; error?: string }>;
      testRunnerSuggestFix: (sql: string, error: string) => Promise<{ success: boolean; suggestedFix?: string; error?: string }>;
      // Report methods
      reportGetAll: () => Promise<{ success: boolean; data?: Report[]; error?: string }>;
      reportCreate: (name: string, description: string) => Promise<{ success: boolean; data?: Report; error?: string }>;
      reportDelete: (id: number) => Promise<{ success: boolean; error?: string }>;
      reportExportWord: (reportId: string, outputPath: string) => Promise<{ success: boolean; error?: string }>;
      reportExportMarkdown: (reportId: string, outputPath: string) => Promise<{ success: boolean; error?: string }>;
      reportExportPDF: (reportId: string, outputPath: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

function ReportPanel(): React.ReactElement {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.reportGetAll();
      if (result.success && result.data) {
        setReports(result.data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = async () => {
    const name = prompt('请输入报告名称:');
    if (!name) return;

    const description = prompt('请输入报告描述:') || '';

    try {
      const result = await window.electronAPI.reportCreate(name, description);
      if (result.success && result.data) {
        setReports([result.data, ...reports]);
      }
    } catch (err) {
      console.error('Failed to create report:', err);
    }
  };

  const handleDeleteReport = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个报告吗？')) return;

    try {
      const result = await window.electronAPI.reportDelete(id);
      if (result.success) {
        setReports(reports.filter(r => r.id !== id));
        if (selectedReport?.id === id) {
          setSelectedReport(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleAddTestCase = () => {
    if (selectedReport) {
      setShowTestRunner(true);
    }
  };

  const handleTestCaseCreated = () => {
    setShowTestRunner(false);
    // Refresh will happen automatically via TestCaseTable
  };

  const handleExport = async (format: 'word' | 'markdown' | 'pdf') => {
    if (!selectedReport) return;

    const extension = format === 'word' ? 'docx' : format === 'markdown' ? 'md' : 'pdf';
    const defaultPath = `${selectedReport.name.replace(/[^a-zA-Z0-9一-龥]/g, '_')}.${extension}`;

    // For Electron, we'd typically use dialog.showSaveDialog, but for simplicity
    // we'll use a prompt to get the path. In production, you'd integrate with Electron's dialog API.
    const outputPath = prompt(`Enter output path for ${format.toUpperCase}:`, defaultPath);
    if (!outputPath) return;

    try {
      let result;
      switch (format) {
        case 'word':
          result = await window.electronAPI.reportExportWord(String(selectedReport.id), outputPath);
          break;
        case 'markdown':
          result = await window.electronAPI.reportExportMarkdown(String(selectedReport.id), outputPath);
          break;
        case 'pdf':
          result = await window.electronAPI.reportExportPDF(String(selectedReport.id), outputPath);
          break;
      }

      if (result?.success) {
        alert(`Report exported successfully to ${outputPath}`);
      } else {
        alert(`Export failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed');
    }
  };

  return (
    <div className="report-panel">
      <div className="report-header">
        <h2>测试报告</h2>
        <button className="btn btn-primary" onClick={handleCreateReport}>
          新建报告
        </button>
      </div>

      <div className="report-content">
        <div className="report-list">
          <h3>报告列表</h3>
          {loading ? (
            <p>加载中...</p>
          ) : reports.length === 0 ? (
            <p className="empty-state">暂无报告</p>
          ) : (
            <ul className="report-items">
              {reports.map(report => (
                <li
                  key={report.id}
                  className={`report-item ${selectedReport?.id === report.id ? 'active' : ''}`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="report-info">
                    <span className="report-name">{report.name}</span>
                    <span className="report-desc">{report.description}</span>
                    <span className="report-date">
                      {report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => handleDeleteReport(report.id, e)}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="report-detail">
          {selectedReport ? (
            <>
              <div className="detail-header">
                <h3>{selectedReport.name}</h3>
                <div className="detail-actions">
                  <button className="btn btn-primary" onClick={handleAddTestCase}>
                    添加测试用例
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleExport('word')}>
                    导出Word
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleExport('markdown')}>
                    导出Markdown
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleExport('pdf')}>
                    导出PDF
                  </button>
                </div>
              </div>
              <p className="detail-description">{selectedReport.description}</p>
              <TestCaseTable reportId={selectedReport.id} />
            </>
          ) : (
            <div className="empty-state">
              <p>请选择一个报告查看详情</p>
            </div>
          )}
        </div>
      </div>

      {showTestRunner && selectedReport && (
        <TestRunner
          reportId={selectedReport.id}
          onClose={() => setShowTestRunner(false)}
          onTestCaseCreated={handleTestCaseCreated}
        />
      )}
    </div>
  );
}

export default ReportPanel;