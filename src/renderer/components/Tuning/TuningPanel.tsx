import React, { useState } from 'react';
import CompareView from './CompareView';

interface TuningSuggestion {
  type: 'index' | 'sql_rewrite' | 'config' | 'partition';
  original: string;
  suggested: string;
  reason: string;
  impact?: 'high' | 'medium' | 'low';
}

interface CompareData {
  originalSql: string;
  optimizedSql: string;
  originalResult?: any;
  optimizedResult?: any;
  comparison?: any;
}

function TuningPanel(): React.ReactElement {
  const [sql, setSql] = useState('');
  const [suggestions, setSuggestions] = useState<TuningSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<TuningSuggestion | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [comparing, setComparing] = useState(false);

  const handleAnalyze = async () => {
    if (!sql.trim()) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await window.electronAPI.tuningAnalyze(sql);

      if (response.success) {
        setSuggestions(response.suggestions || []);
        if (!response.suggestions || response.suggestions.length === 0) {
          setError('No optimization suggestions found. Your SQL may already be optimized.');
        }
      } else {
        setError(response.error || 'Analysis failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAndCompare = async (suggestion: TuningSuggestion) => {
    setSelectedSuggestion(suggestion);
    setComparing(true);

    try {
      const response = await window.electronAPI.sqlCompare(suggestion.original, suggestion.suggested);

      if (response.success && response.comparison) {
        setCompareData({
          originalSql: suggestion.original,
          optimizedSql: suggestion.suggested,
          originalResult: response.comparison.original,
          optimizedResult: response.comparison.optimized,
          comparison: response.comparison,
        });
        setShowCompare(true);
      } else {
        setError(response.error || 'Comparison failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setComparing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const getTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'index':
        return 'badge badge-blue';
      case 'sql_rewrite':
        return 'badge badge-green';
      case 'config':
        return 'badge badge-orange';
      case 'partition':
        return 'badge badge-purple';
      default:
        return 'badge';
    }
  };

  const getImpactBadgeClass = (impact?: string): string => {
    switch (impact) {
      case 'high':
        return 'impact-badge impact-high';
      case 'medium':
        return 'impact-badge impact-medium';
      case 'low':
        return 'impact-badge impact-low';
      default:
        return 'impact-badge';
    }
  };

  const closeCompare = () => {
    setShowCompare(false);
    setCompareData(null);
    setSelectedSuggestion(null);
  };

  return (
    <div className="tuning-panel">
      <div className="tuning-header">
        <h2>SQL Tuning Advisor</h2>
        <p>Analyze and optimize your SQL queries with rule-based and AI-powered suggestions</p>
      </div>

      <div className="tuning-input-section">
        <div className="input-group">
          <label htmlFor="sql-input">Enter SQL Query</label>
          <textarea
            id="sql-input"
            className="sql-textarea"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="SELECT * FROM users WHERE email = 'test@example.com';"
            rows={6}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleAnalyze}
          disabled={loading || !sql.trim()}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="alert alert-warning">
          <span className="alert-icon">!</span>
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggestions-section">
          <h3>Optimization Suggestions ({suggestions.length})</h3>
          <div className="suggestions-list">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="suggestion-card">
                <div className="suggestion-header">
                  <div className="suggestion-badges">
                    <span className={getTypeBadgeClass(suggestion.type)}>
                      {suggestion.type.replace('_', ' ')}
                    </span>
                    {suggestion.impact && (
                      <span className={getImpactBadgeClass(suggestion.impact)}>
                        {suggestion.impact} impact
                      </span>
                    )}
                  </div>
                </div>

                <div className="suggestion-body">
                  <div className="suggestion-reason">
                    <strong>Reason:</strong> {suggestion.reason}
                  </div>

                  {suggestion.original !== suggestion.suggested && (
                    <div className="suggestion-diff">
                      <div className="diff-original">
                        <label>Original:</label>
                        <pre>{suggestion.original}</pre>
                      </div>
                      <div className="diff-arrow">-&gt;</div>
                      <div className="diff-suggested">
                        <label>Suggested:</label>
                        <pre>{suggestion.suggested}</pre>
                      </div>
                    </div>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={() => handleApplyAndCompare(suggestion)}
                    disabled={comparing || suggestion.original === suggestion.suggested}
                  >
                    {comparing && selectedSuggestion === suggestion
                      ? 'Comparing...'
                      : 'Apply and Compare'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && suggestions.length === 0 && sql.trim() && !error && (
        <div className="no-suggestions">
          <p>Click "Analyze" to get optimization suggestions for your SQL query.</p>
        </div>
      )}

      {showCompare && compareData && (
        <CompareView
          data={compareData}
          onClose={closeCompare}
        />
      )}
    </div>
  );
}

export default TuningPanel;
