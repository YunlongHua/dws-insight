import React from 'react';

interface CompareData {
  originalSql: string;
  optimizedSql: string;
  originalResult?: any;
  optimizedResult?: any;
  comparison?: any;
}

interface CompareViewProps {
  data: CompareData;
  onClose: () => void;
}

function CompareView({ data, onClose }: CompareViewProps): React.ReactElement {
  const { originalSql, optimizedSql, comparison } = data;

  const getConsistencyStatus = (): { label: string; className: string } => {
    if (!comparison) return { label: 'Unknown', className: 'status-unknown' };
    if (comparison.resultDiff) {
      return { label: 'Results Differ', className: 'status-different' };
    }
    return { label: 'Results Match', className: 'status-match' };
  };

  const status = getConsistencyStatus();

  return (
    <div className="compare-modal-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compare-header">
          <h2>SQL Comparison</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="compare-body">
          <div className="compare-section">
            <h3>Original SQL</h3>
            <pre className="sql-code">{originalSql}</pre>
          </div>

          <div className="compare-section">
            <h3>Optimized SQL</h3>
            <pre className="sql-code optimized">{optimizedSql}</pre>
          </div>

          {comparison && (
            <>
              <div className="compare-timing">
                <h3>Execution Time Comparison</h3>
                <div className="timing-grid">
                  <div className="timing-item">
                    <label>Original:</label>
                    <span className="time-value">{comparison.original?.executionTime || 'N/A'} ms</span>
                  </div>
                  <div className="timing-item">
                    <label>Optimized:</label>
                    <span className="time-value">{comparison.optimized?.executionTime || 'N/A'} ms</span>
                  </div>
                  <div className="timing-item highlight">
                    <label>Difference:</label>
                    <span className={`time-value ${comparison.timeDiff < 0 ? 'faster' : comparison.timeDiff > 0 ? 'slower' : ''}`}>
                      {comparison.timeDiff > 0 ? '+' : ''}{comparison.timeDiff || 0} ms
                    </span>
                  </div>
                </div>
              </div>

              <div className="compare-results">
                <h3>Results Comparison</h3>
                <div className="result-status">
                  <span className={`status-badge ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="result-details">
                  <div className="result-item">
                    <label>Original Rows:</label>
                    <span>{comparison.original?.rowCount || 0}</span>
                  </div>
                  <div className="result-item">
                    <label>Optimized Rows:</label>
                    <span>{comparison.optimized?.rowCount || 0}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="compare-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompareView;
