import log from 'electron-log';
import { llmGateway, Message } from './LLMGateway';
import { dwsDirector } from './DWSDirector';
import { saveTestCase, getTestCases, updateTestCase, TestCase as DbTestCase } from '../storage/database';

export interface TestStep {
  step: string;
  sql?: string;
  expected?: string;
  actual?: string;
  status: 'pending' | 'passed' | 'failed';
  error?: string;
}

export interface TestCase {
  id: string;
  name: string;
  preconditions: string;
  steps: TestStep[];
  expected_results: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  notes: string;
}

export interface TestCaseCreateInput {
  name: string;
  preconditions: string;
  steps: TestStep[];
  expected_results: string;
}

const PARSE_REQUIREMENTS_PROMPT = `You are a test case parser. Parse the following natural language requirement into a structured test case.

Return a JSON object with this exact structure:
{
  "name": "Test case name",
  "preconditions": "Preconditions for the test",
  "steps": [
    {
      "step": "Description of step 1",
      "sql": "SQL query to execute (if applicable)",
      "expected": "Expected result"
    }
  ],
  "expected_results": "Overall expected results"
}

If the requirement doesn't mention SQL, create reasonable test steps based on typical database testing scenarios.

Requirement:
`;

const SUGGEST_FIX_PROMPT = `The following SQL query failed with an error:
SQL: {sql}
Error: {error}

Please suggest a corrected version of the SQL query that fixes this error. Return ONLY the corrected SQL query, nothing else.`;

const testRunner = {
  async parseRequirements(requirement: string): Promise<{ success: boolean; testCase?: Partial<TestCase>; error?: string }> {
    try {
      const messages: Message[] = [
        { role: 'user', content: PARSE_REQUIREMENTS_PROMPT + requirement }
      ];

      const response = await llmGateway.chat(messages);

      if (!response.success || !response.content) {
        return { success: false, error: response.error || 'Failed to parse requirements' };
      }

      // Extract JSON from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, error: 'Failed to parse LLM response as JSON' };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Ensure steps have proper structure
      if (parsed.steps && Array.isArray(parsed.steps)) {
        parsed.steps = parsed.steps.map((step: any) => ({
          step: step.step || '',
          sql: step.sql || '',
          expected: step.expected || '',
          actual: '',
          status: 'pending' as const,
          error: undefined
        }));
      }

      log.info('Parsed requirements into test case:', parsed.name);
      return { success: true, testCase: parsed };
    } catch (err: any) {
      log.error('Error parsing requirements:', err);
      return { success: false, error: err.message };
    }
  },

  async executeTestCase(
    testCase: TestCase,
    reportId: number
  ): Promise<{ success: boolean; executedCase?: TestCase; error?: string }> {
    try {
      const executedSteps: TestStep[] = [];
      let overallStatus: 'passed' | 'failed' = 'passed';

      for (const step of testCase.steps) {
        const executedStep: TestStep = { ...step };

        if (!step.sql) {
          executedStep.status = 'passed';
          executedSteps.push(executedStep);
          continue;
        }

        try {
          const result = await dwsDirector.executeQuery(step.sql);

          if (!result.success) {
            executedStep.status = 'failed';
            executedStep.error = result.error;
            executedStep.actual = result.error || 'Error executing SQL';
            overallStatus = 'failed';

            // Try to suggest a fix
            const suggestedFix = await this.suggestFix(step.sql, result.error || 'Unknown error');
            if (suggestedFix) {
              executedStep.error += `\nSuggested fix: ${suggestedFix}`;
            }
          } else {
            executedStep.actual = JSON.stringify(result.result?.rows || [], null, 2);

            // Check if actual matches expected
            if (step.expected) {
              // Simple string comparison - could be enhanced with more sophisticated matching
              const expectedNormalized = step.expected.toLowerCase().trim();
              const actualNormalized = executedStep.actual.toLowerCase();

              if (actualNormalized.includes(expectedNormalized) || expectedNormalized.includes('any') || expectedNormalized === '') {
                executedStep.status = 'passed';
              } else {
                executedStep.status = 'failed';
                overallStatus = 'failed';
              }
            } else {
              executedStep.status = 'passed';
            }
          }
        } catch (err: any) {
          executedStep.status = 'failed';
          executedStep.error = err.message;
          executedStep.actual = err.message;
          overallStatus = 'failed';
        }

        executedSteps.push(executedStep);
      }

      const executedCase: TestCase = {
        ...testCase,
        id: testCase.id || `tc_${Date.now()}`,
        steps: executedSteps,
        status: overallStatus
      };

      // Save to database
      const dbTestCase: Omit<DbTestCase, 'id' | 'created_at' | 'updated_at'> = {
        report_id: reportId,
        name: testCase.name,
        preconditions: testCase.preconditions,
        steps: JSON.stringify(executedSteps),
        expected_results: testCase.expected_results,
        actual_results: JSON.stringify(executedSteps.map(s => ({ step: s.step, status: s.status, actual: s.actual }))),
        status: overallStatus,
        notes: testCase.notes
      };

      saveTestCase(dbTestCase);

      log.info(`Test case executed: ${testCase.name}, status: ${overallStatus}`);
      return { success: true, executedCase };
    } catch (err: any) {
      log.error('Error executing test case:', err);
      return { success: false, error: err.message };
    }
  },

  async suggestFix(sql: string, error: string): Promise<string | null> {
    try {
      const prompt = SUGGEST_FIX_PROMPT.replace('{sql}', sql).replace('{error}', error);

      const messages: Message[] = [
        { role: 'user', content: prompt }
      ];

      const response = await llmGateway.chat(messages);

      if (!response.success || !response.content) {
        return null;
      }

      // Return the suggested fix, trimmed
      return response.content.trim();
    } catch (err: any) {
      log.error('Error suggesting fix:', err);
      return null;
    }
  },

  async getTestCasesByReport(reportId: number): Promise<TestCase[]> {
    const dbTestCases = getTestCases(reportId);

    return dbTestCases.map(tc => {
      let steps: TestStep[] = [];
      try {
        steps = JSON.parse(tc.steps);
      } catch {
        steps = [];
      }

      return {
        id: String(tc.id),
        name: tc.name,
        preconditions: tc.preconditions,
        steps,
        expected_results: tc.expected_results,
        status: tc.status as TestCase['status'],
        notes: tc.notes || ''
      };
    });
  },

  async updateTestCaseStatus(
    id: number,
    status: 'pending' | 'passed' | 'failed' | 'skipped',
    notes?: string
  ): Promise<boolean> {
    try {
      const updates: Partial<DbTestCase> = { status };
      if (notes !== undefined) {
        updates.notes = notes;
      }
      const result = updateTestCase(id, updates);
      return result !== null;
    } catch (err) {
      log.error('Error updating test case status:', err);
      return false;
    }
  }
};

export default testRunner;