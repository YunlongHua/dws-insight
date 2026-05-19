import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import log from 'electron-log';

let db: Database.Database | null = null;

export interface ChatMessage {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface Report {
  id?: number;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface TestCase {
  id?: number;
  report_id: number;
  name: string;
  preconditions: string;
  steps: string; // JSON string
  expected_results: string;
  actual_results?: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TuningRecord {
  id?: number;
  original_sql: string;
  optimized_sql: string;
  original_plan: string;
  optimized_plan: string;
  original_result: string;
  optimized_result: string;
  status: 'pending' | 'optimized' | 'failed';
  created_at?: string;
}

export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'dws.db');

  log.info(`Initializing database at: ${dbPath}`);

  db = new Database(dbPath);

  // Enable WAL journal mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      preconditions TEXT NOT NULL,
      steps TEXT NOT NULL,
      expected_results TEXT NOT NULL,
      actual_results TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_test_cases_report_id ON test_cases(report_id);

    CREATE TABLE IF NOT EXISTS tuning_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_sql TEXT NOT NULL,
      optimized_sql TEXT NOT NULL,
      original_plan TEXT NOT NULL,
      optimized_plan TEXT NOT NULL,
      original_result TEXT NOT NULL,
      optimized_result TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'optimized', 'failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  log.info('Database tables initialized successfully');

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Chat message operations
export function saveMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessage {
  const database = getDatabase();
  const stmt = database.prepare(
    'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
  );
  const result = stmt.run(message.session_id, message.role, message.content);
  return { ...message, id: result.lastInsertRowid as number };
}

export function getMessages(sessionId: string): ChatMessage[] {
  const database = getDatabase();
  const stmt = database.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  );
  return stmt.all(sessionId) as ChatMessage[];
}

export function clearMessages(sessionId: string): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM chat_messages WHERE session_id = ?');
  stmt.run(sessionId);
}

// Report operations
export function createReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at'>): Report {
  const database = getDatabase();
  const stmt = database.prepare(
    'INSERT INTO reports (name, description) VALUES (?, ?)'
  );
  const result = stmt.run(report.name, report.description);
  return { ...report, id: result.lastInsertRowid as number };
}

export function getReports(): Report[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM reports ORDER BY created_at DESC');
  return stmt.all() as Report[];
}

export function getReportById(id: number): Report | undefined {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM reports WHERE id = ?');
  return stmt.get(id) as Report | undefined;
}

export function updateReport(id: number, updates: Partial<Report>): Report | null {
  const database = getDatabase();
  const existing = getReportById(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  const stmt = database.prepare(
    'UPDATE reports SET name = ?, description = ?, updated_at = ? WHERE id = ?'
  );
  stmt.run(updated.name, updated.description, updated.updated_at, id);
  return updated;
}

export function deleteReport(id: number): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM reports WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Test case operations
export function saveTestCase(testCase: Omit<TestCase, 'id' | 'created_at' | 'updated_at'>): TestCase {
  const database = getDatabase();
  const stmt = database.prepare(
    `INSERT INTO test_cases (report_id, name, preconditions, steps, expected_results, actual_results, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    testCase.report_id,
    testCase.name,
    testCase.preconditions,
    testCase.steps,
    testCase.expected_results,
    testCase.actual_results || null,
    testCase.status,
    testCase.notes || null
  );
  return { ...testCase, id: result.lastInsertRowid as number };
}

export function getTestCases(reportId: number): TestCase[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM test_cases WHERE report_id = ? ORDER BY created_at ASC');
  return stmt.all(reportId) as TestCase[];
}

export function updateTestCase(id: number, updates: Partial<TestCase>): TestCase | null {
  const database = getDatabase();
  const existing = database.prepare('SELECT * FROM test_cases WHERE id = ?').get(id) as TestCase | undefined;
  if (!existing) return null;

  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  const stmt = database.prepare(
    `UPDATE test_cases SET name = ?, preconditions = ?, steps = ?, expected_results = ?,
     actual_results = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`
  );
  stmt.run(
    updated.name,
    updated.preconditions,
    updated.steps,
    updated.expected_results,
    updated.actual_results,
    updated.status,
    updated.notes,
    updated.updated_at,
    id
  );
  return updated;
}

export function deleteTestCase(id: number): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM test_cases WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Tuning record operations
export function saveTuningRecord(record: Omit<TuningRecord, 'id' | 'created_at'>): TuningRecord {
  const database = getDatabase();
  const stmt = database.prepare(
    `INSERT INTO tuning_records (original_sql, optimized_sql, original_plan, optimized_plan,
     original_result, optimized_result, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    record.original_sql,
    record.optimized_sql,
    record.original_plan,
    record.optimized_plan,
    record.original_result,
    record.optimized_result,
    record.status
  );
  return { ...record, id: result.lastInsertRowid as number };
}

export function getTuningRecords(): TuningRecord[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM tuning_records ORDER BY created_at DESC');
  return stmt.all() as TuningRecord[];
}

export function updateTuningRecord(id: number, updates: Partial<TuningRecord>): TuningRecord | null {
  const database = getDatabase();
  const existing = database.prepare('SELECT * FROM tuning_records WHERE id = ?').get(id) as TuningRecord | undefined;
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  const stmt = database.prepare(
    `UPDATE tuning_records SET optimized_sql = ?, optimized_plan = ?,
     optimized_result = ?, status = ? WHERE id = ?`
  );
  stmt.run(
    updated.optimized_sql,
    updated.optimized_plan,
    updated.optimized_result,
    updated.status,
    id
  );
  return updated;
}

export function deleteTuningRecord(id: number): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM tuning_records WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export default db;
