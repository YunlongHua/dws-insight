import { ipcMain } from 'electron';
import log from 'electron-log';
import testRunner, { TestCase, TestStep } from '../services/TestRunner';

interface ParseRequest {
  requirement: string;
}

interface ExecuteRequest {
  testCase: TestCase;
  reportId: number;
}

interface TestCaseCreateRequest {
  reportId: number;
  testCase: {
    name: string;
    preconditions: string;
    steps: TestStep[];
    expected_results: string;
    notes?: string;
  };
}

export function registerTestRunnerIPC(): void {
  // Parse natural language requirements into test case structure
  ipcMain.handle('testRunner:parseRequirements', async (_event, request: ParseRequest) => {
    log.info('TestRunner parse requirements request received');
    return await testRunner.parseRequirements(request.requirement);
  });

  // Execute a test case
  ipcMain.handle('testRunner:execute', async (_event, request: ExecuteRequest) => {
    log.info('TestRunner execute request received for:', request.testCase.name);
    return await testRunner.executeTestCase(request.testCase, request.reportId);
  });

  // Get test cases for a report
  ipcMain.handle('testRunner:getTestCases', async (_event, reportId: number) => {
    log.info('TestRunner get test cases request received for report:', reportId);
    try {
      const testCases = await testRunner.getTestCasesByReport(reportId);
      return { success: true, data: testCases };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Create a new test case
  ipcMain.handle('testRunner:createTestCase', async (_event, request: TestCaseCreateRequest) => {
    log.info('TestRunner create test case request received');
    try {
      const testCaseInput = {
        ...request.testCase,
        notes: request.testCase.notes || ''
      };
      const result = await testRunner.executeTestCase(
        {
          id: '',
          ...testCaseInput,
          status: 'pending'
        },
        request.reportId
      );
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Suggest fix for SQL error
  ipcMain.handle('testRunner:suggestFix', async (_event, sql: string, error: string) => {
    log.info('TestRunner suggest fix request received');
    try {
      const fix = await testRunner.suggestFix(sql, error);
      return { success: true, suggestedFix: fix };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  log.info('TestRunner IPC handlers registered');
}