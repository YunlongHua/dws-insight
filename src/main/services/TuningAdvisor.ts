import { dwsDirector } from './DWSDirector';
import { llmGateway, Message } from './LLMGateway';
import log from 'electron-log';

export interface TuningSuggestion {
  type: 'index' | 'sql_rewrite' | 'config' | 'partition';
  original: string;
  suggested: string;
  reason: string;
  impact?: 'high' | 'medium' | 'low';
}

interface AnalysisResult {
  success: boolean;
  suggestions?: TuningSuggestion[];
  error?: string;
}

// Pattern detectors for rule-based analysis
const PATTERNS = {
  // Detect SELECT *
  SELECT_STAR: /\bSELECT\s+\*/gi,
  // Detect missing WHERE clause
  MISSING_WHERE: /\bSELECT\s+.+?\bFROM\s+\w+(\s+WHERE)?(?!.*\bWHERE\b)/gi,
  // Detect LIKE without leading wildcard (can use index)
  LIKE_NO_LEADING_WILDCARD: /\bLIKE\s+'[^%*]/gi,
  // Detect OR conditions that might benefit from UNION
  OR_CONDITIONS: /\bOR\b/gi,
  // Detect NOT IN with subquery (can often be rewritten)
  NOT_IN_SUBQUERY: /\bNOT\s+IN\s*\(\s*SELECT/gi,
  // Detect correlated subqueries
  CORRELATED_SUBQUERY: /\bWHERE\s+.+?\s*=\s*\(\s*SELECT\s+.+?\s+FROM\s+.+?\s+WHERE\s+.+?\.\w+\s*=\s*.+\)/gi,
  // Detect functions on indexed columns in WHERE
  FUNCTION_ON_COLUMN: /\bWHERE\s+\w+\s*\(\s*\w+\s*\)/gi,
  // Detect DISTINCT used unnecessarily
  UNNECESSARY_DISTINCT: /\bSELECT\s+DISTINCT\b/gi,
  // Detect COUNT(*) which may benefit from index
  COUNT_STAR: /\bCOUNT\s*\(\s*\*\s*\)/gi,
  // Detect JOIN without proper indexes hint
  JOIN_WITHOUT_INDEX_HINT: /\bJOIN\b.*\bON\b/gi,
  // Detect ORDER BY with many columns
  MANY_ORDER_BY: /\bORDER\s+BY\s+[\w,\s]+(?:\s+LIMIT)?/gi,
  // Detect missing LIMIT
  MISSING_LIMIT: /\bSELECT\b(?!\s+.*\bLIMIT\b).*\bFROM\b/gi,
};

export const tuningAdvisor = {
  /**
   * Main analysis entry point - combines rule-based and LLM analysis
   */
  async analyze(sql: string): Promise<AnalysisResult> {
    try {
      log.info('Starting SQL analysis for:', sql.substring(0, 100));

      // Step 1: Rule-based analysis
      const ruleSuggestions = this.ruleBasedAnalysis(sql);
      log.info(`Rule-based analysis found ${ruleSuggestions.length} suggestions`);

      // Step 2: Get execution plan via DWSDirector
      const planResult = await dwsDirector.getExecutionPlan(sql);
      if (!planResult.success) {
        log.warn('Could not get execution plan:', planResult.error);
      }

      // Step 3: LLM analysis
      let llmSuggestions: TuningSuggestion[] = [];
      if (planResult.success && planResult.plan) {
        llmSuggestions = await this.llmAnalysis(sql, planResult.plan.plan);
        log.info(`LLM analysis found ${llmSuggestions.length} suggestions`);
      }

      // Step 4: Combine and deduplicate suggestions
      const allSuggestions = this.combineSuggestions(ruleSuggestions, llmSuggestions);

      return {
        success: true,
        suggestions: allSuggestions,
      };
    } catch (err: any) {
      log.error('Analysis failed:', err);
      return {
        success: false,
        error: err.message || 'Analysis failed',
      };
    }
  },

  /**
   * Rule-based SQL analysis
   */
  ruleBasedAnalysis(sql: string): TuningSuggestion[] {
    const suggestions: TuningSuggestion[] = [];
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    // Check for SELECT *
    if (PATTERNS.SELECT_STAR.test(normalizedSql)) {
      suggestions.push({
        type: 'sql_rewrite',
        original: sql,
        suggested: sql.replace(/\*$/, 'column_list'),
        reason: 'Avoid SELECT * - retrieve only needed columns to reduce network transfer and memory usage.',
        impact: 'medium',
      });
    }

    // Check for missing WHERE in SELECT
    if (/\bSELECT\b.*\bFROM\b.*\bWHERE\b/gi.test(normalizedSql) === false &&
        /\bSELECT\b.*\bFROM\b/gi.test(normalizedSql)) {
      // It's a SELECT without WHERE - check if it's intentionally without WHERE
      if (!/\bWHERE\b/.test(normalizedSql) && /\bSELECT\b.*\bFROM\b/gi.test(normalizedSql)) {
        // Only suggest if it looks like a full table scan risk
        if (!/\bLIMIT\b/i.test(normalizedSql)) {
          suggestions.push({
            type: 'sql_rewrite',
            original: sql,
            suggested: sql,
            reason: 'Consider adding a WHERE clause or LIMIT to avoid full table scans.',
            impact: 'high',
          });
        }
      }
    }

    // Check for LIKE without leading wildcard
    if (PATTERNS.LIKE_NO_LEADING_WILDCARD.test(normalizedSql)) {
      suggestions.push({
        type: 'sql_rewrite',
        original: sql,
        suggested: sql,
        reason: 'LIKE patterns without leading wildcard cannot use indexes efficiently. Consider using range queries or full-text search.',
        impact: 'medium',
      });
    }

    // Check for OR conditions - suggest UNION
    const orMatches = normalizedSql.match(PATTERNS.OR_CONDITIONS);
    if (orMatches && orMatches.length >= 2) {
      // Check if OR is in WHERE clause
      const whereMatch = normalizedSql.match(/\bWHERE\b(.+)/i);
      if (whereMatch && whereMatch[1].includes(' OR ')) {
        suggestions.push({
          type: 'sql_rewrite',
          original: sql,
          suggested: sql,
          reason: 'Multiple OR conditions may benefit from UNION ALL or UNION for better index utilization.',
          impact: 'medium',
        });
      }
    }

    // Check for NOT IN with subquery
    if (PATTERNS.NOT_IN_SUBQUERY.test(normalizedSql)) {
      suggestions.push({
        type: 'sql_rewrite',
        original: sql,
        suggested: sql.replace(/\bNOT\s+IN\s*\(\s*SELECT/gi, 'NOT EXISTS (SELECT 1 FROM'),
        reason: 'NOT IN with subquery can be slow. Consider rewriting as NOT EXISTS or LEFT JOIN with NULL check.',
        impact: 'high',
      });
    }

    // Check for correlated subqueries
    if (PATTERNS.CORRELATED_SUBQUERY.test(normalizedSql)) {
      suggestions.push({
        type: 'sql_rewrite',
        original: sql,
        suggested: sql,
        reason: 'Correlated subqueries execute once per row. Consider rewriting as JOIN or using window functions.',
        impact: 'high',
      });
    }

    // Check for functions on columns in WHERE
    if (PATTERNS.FUNCTION_ON_COLUMN.test(normalizedSql)) {
      suggestions.push({
        type: 'sql_rewrite',
        original: sql,
        suggested: sql,
        reason: 'Functions on columns in WHERE clause prevent index usage. Consider expression indexes or rewriting.',
        impact: 'high',
      });
    }

    // Check for unnecessary DISTINCT
    if (PATTERNS.UNNECESSARY_DISTINCT.test(normalizedSql)) {
      // Check if there's aggregation that makes DISTINCT unnecessary
      if (!/\bGROUP\s+BY\b/i.test(normalizedSql) && !/\bDISTINCT\b.*\bJOIN\b/i.test(normalizedSql)) {
        suggestions.push({
          type: 'sql_rewrite',
          original: sql,
          suggested: sql,
          reason: 'DISTINCT can be expensive. Consider if it is necessary or if aggregation can achieve the same result.',
          impact: 'low',
        });
      }
    }

    // Check for COUNT(*) that could use index
    if (PATTERNS.COUNT_STAR.test(normalizedSql)) {
      suggestions.push({
        type: 'index',
        original: sql,
        suggested: sql,
        reason: 'COUNT(*) can benefit from covering indexes. Ensure the table has appropriate indexes.',
        impact: 'medium',
      });
    }

    // Check for missing LIMIT on SELECT
    if (PATTERNS.MISSING_LIMIT.test(normalizedSql) && !/\bLIMIT\b/i.test(normalizedSql)) {
      // Only suggest if it's a simple SELECT (not INSERT, UPDATE, DELETE)
      if (/^\s*SELECT\b/i.test(normalizedSql)) {
        suggestions.push({
          type: 'sql_rewrite',
          original: sql,
          suggested: sql + ' LIMIT 100',
          reason: 'Consider adding LIMIT to prevent returning too many rows and to allow query plan optimization.',
          impact: 'medium',
        });
      }
    }

    // Check for ORDER BY with many columns
    const orderByMatch = normalizedSql.match(PATTERNS.MANY_ORDER_BY);
    if (orderByMatch) {
      const orderCols = orderByMatch[0].match(/[\w]+(?=\s*(,|$|\s+LIMIT))/gi);
      if (orderCols && orderCols.length > 3) {
        suggestions.push({
          type: 'sql_rewrite',
          original: sql,
          suggested: sql,
          reason: `ORDER BY with ${orderCols.length} columns may be slow. Consider reducing or creating a composite index.`,
          impact: 'low',
        });
      }
    }

    // Check for implicit type conversion (string to number comparison)
    if (/\bWHERE\s+\w+\s*=\s*\d+/gi.test(normalizedSql)) {
      // Check if the column might be VARCHAR
      suggestions.push({
        type: 'config',
        original: sql,
        suggested: sql,
        reason: 'Implicit type conversion can prevent index usage. Ensure column types match comparison types.',
        impact: 'medium',
      });
    }

    return suggestions;
  },

  /**
   * LLM-based analysis using execution plan
   */
  async llmAnalysis(sql: string, plan: any): Promise<TuningSuggestion[]> {
    try {
      const messages: Message[] = [
        {
          role: 'system',
          content: `You are a PostgreSQL performance expert. Analyze SQL queries and execution plans to provide optimization suggestions.

For each suggestion, respond with a JSON array of suggestions. Each suggestion should have:
- type: "index" | "sql_rewrite" | "config" | "partition"
- original: the original SQL
- suggested: the optimized SQL (or same as original if suggestion doesn't change SQL)
- reason: explanation of why this helps
- impact: "high" | "medium" | "low"

Analyze for:
1. Sequential scans that could use indexes
2. Hash joins that could be replaced with index joins
3. Sort operations that could be eliminated
4. Missing index suggestions
5. Partitioning opportunities for large tables
6. Configuration parameter recommendations

If no improvements needed, return an empty array.`,
        },
        {
          role: 'user',
          content: `Analyze this SQL query and its execution plan:

SQL:
${sql}

Execution Plan:
${JSON.stringify(plan, null, 2)}

Provide optimization suggestions in JSON format.`,
        },
      ];

      const response = await llmGateway.chat(messages);

      if (!response.success || !response.content) {
        log.warn('LLM analysis failed:', response.error);
        return [];
      }

      // Try to parse JSON from response
      try {
        // Look for JSON array in response
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]) as TuningSuggestion[];
          return suggestions.filter(
            (s) => s.type && s.original !== undefined && s.suggested !== undefined && s.reason
          );
        }
      } catch (parseErr) {
        log.warn('Failed to parse LLM response as JSON:', parseErr);
      }

      return [];
    } catch (err: any) {
      log.error('LLM analysis error:', err);
      return [];
    }
  },

  /**
   * Combine rule-based and LLM suggestions, removing duplicates
   */
  combineSuggestions(
    ruleSuggestions: TuningSuggestion[],
    llmSuggestions: TuningSuggestion[]
  ): TuningSuggestion[] {
    const combined = [...ruleSuggestions];

    for (const llm of llmSuggestions) {
      // Check if this LLM suggestion is essentially the same as a rule suggestion
      const isDuplicate = ruleSuggestions.some(
        (rule) =>
          rule.type === llm.type &&
          rule.reason.toLowerCase().includes(llm.reason.toLowerCase().substring(0, 20))
      );

      if (!isDuplicate) {
        combined.push(llm);
      }
    }

    // Sort by impact (high first)
    const impactOrder = { high: 0, medium: 1, low: 2 };
    combined.sort((a, b) => {
      const aOrder = impactOrder[a.impact || 'low'];
      const bOrder = impactOrder[b.impact || 'low'];
      return aOrder - bOrder;
    });

    return combined;
  },
};

export default tuningAdvisor;
