import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

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
  steps: string;
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

export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) {
    return db;
  }

  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'dws.db');

  log.info(`Initializing database at: ${dbPath}`);

  // Locate the wasm file - in dev it's in node_modules, in packaged app it's next to the js
  let wasmPath: string;
  if (app.isPackaged) {
    // In packaged app, wasm is at app.asar/dist/main/sql-wasm.wasm
    wasmPath = path.join(__dirname, 'sql-wasm.wasm');
  } else {
    wasmPath = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }

  log.info(`Looking for WASM at: ${wasmPath}`);

  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });

  // Try to load existing database
  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      log.info('Loaded existing database');
    } else {
      db = new SQL.Database();
      log.info('Created new database');
    }
  } catch (err) {
    log.error('Error loading database, creating new:', err);
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_test_cases_report_id ON test_cases(report_id)`);

  db.run(`
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
    )
  `);

  saveDatabase();
  log.info('Database tables initialized successfully');

  return db;
}

function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Helper to convert query results to objects
function queryToObjects<T>(result: any): T[] {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// Chat message operations
export function saveMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessage {
  const database = getDatabase();
  database.run(
    'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
    [message.session_id, message.role, message.content]
  );
  const result = database.exec('SELECT last_insert_rowid() as id');
  const id = result[0]?.values[0]?.[0] as number;
  saveDatabase();
  return { ...message, id };
}

export function getMessages(sessionId: string): ChatMessage[] {
  const database = getDatabase();
  const result = database.exec(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
  return queryToObjects<ChatMessage>(result);
}

export function clearMessages(sessionId: string): void {
  const database = getDatabase();
  database.run('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]);
  saveDatabase();
}

// Report operations
export function createReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at'>): Report {
  const database = getDatabase();
  database.run('INSERT INTO reports (name, description) VALUES (?, ?)', [report.name, report.description]);
  const result = database.exec('SELECT last_insert_rowid() as id');
  const id = result[0]?.values[0]?.[0] as number;
  saveDatabase();
  return { ...report, id };
}

export function getReports(): Report[] {
  const database = getDatabase();
  const result = database.exec('SELECT * FROM reports ORDER BY created_at DESC');
  return queryToObjects<Report>(result);
}

export function getReportById(id: number): Report | undefined {
  const database = getDatabase();
  const result = database.exec('SELECT * FROM reports WHERE id = ?', [id]);
  const reports = queryToObjects<Report>(result);
  return reports[0];
}

export function updateReport(id: number, updates: Partial<Report>): Report | null {
  const database = getDatabase();
  const existing = getReportById(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  database.run(
    'UPDATE reports SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    [updated.name, updated.description, updated.updated_at, id]
  );
  saveDatabase();
  return updated;
}

export function deleteReport(id: number): boolean {
  const database = getDatabase();
  const before = database.exec('SELECT COUNT(*) as count FROM reports WHERE id = ?', [id]);
  const countBefore = before[0]?.values[0]?.[0] as number;
  if (countBefore === 0) return false;

  database.run('DELETE FROM reports WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

// Test case operations
export function saveTestCase(testCase: Omit<TestCase, 'id' | 'created_at' | 'updated_at'>): TestCase {
  const database = getDatabase();
  database.run(
    `INSERT INTO test_cases (report_id, name, preconditions, steps, expected_results, actual_results, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testCase.report_id,
      testCase.name,
      testCase.preconditions,
      testCase.steps,
      testCase.expected_results,
      testCase.actual_results || null,
      testCase.status,
      testCase.notes || null
    ]
  );
  const result = database.exec('SELECT last_insert_rowid() as id');
  const id = result[0]?.values[0]?.[0] as number;
  saveDatabase();
  return { ...testCase, id };
}

export function getTestCases(reportId: number): TestCase[] {
  const database = getDatabase();
  const result = database.exec(
    'SELECT * FROM test_cases WHERE report_id = ? ORDER BY created_at ASC',
    [reportId]
  );
  return queryToObjects<TestCase>(result);
}

export function updateTestCase(id: number, updates: Partial<TestCase>): TestCase | null {
  const database = getDatabase();
  const result = database.exec('SELECT * FROM test_cases WHERE id = ?', [id]);
  const existing = queryToObjects<TestCase>(result)[0];
  if (!existing) return null;

  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  database.run(
    `UPDATE test_cases SET name = ?, preconditions = ?, steps = ?, expected_results = ?,
     actual_results = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [
      updated.name,
      updated.preconditions,
      updated.steps,
      updated.expected_results,
      updated.actual_results,
      updated.status,
      updated.notes,
      updated.updated_at,
      id
    ]
  );
  saveDatabase();
  return updated;
}

export function deleteTestCase(id: number): boolean {
  const database = getDatabase();
  const before = database.exec('SELECT COUNT(*) as count FROM test_cases WHERE id = ?', [id]);
  const countBefore = before[0]?.values[0]?.[0] as number;
  if (countBefore === 0) return false;

  database.run('DELETE FROM test_cases WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

// Tuning record operations
export function saveTuningRecord(record: Omit<TuningRecord, 'id' | 'created_at'>): TuningRecord {
  const database = getDatabase();
  database.run(
    `INSERT INTO tuning_records (original_sql, optimized_sql, original_plan, optimized_plan,
     original_result, optimized_result, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.original_sql,
      record.optimized_sql,
      record.original_plan,
      record.optimized_plan,
      record.original_result,
      record.optimized_result,
      record.status
    ]
  );
  const result = database.exec('SELECT last_insert_rowid() as id');
  const id = result[0]?.values[0]?.[0] as number;
  saveDatabase();
  return { ...record, id };
}

export function getTuningRecords(): TuningRecord[] {
  const database = getDatabase();
  const result = database.exec('SELECT * FROM tuning_records ORDER BY created_at DESC');
  return queryToObjects<TuningRecord>(result);
}

export function updateTuningRecord(id: number, updates: Partial<TuningRecord>): TuningRecord | null {
  const database = getDatabase();
  const result = database.exec('SELECT * FROM tuning_records WHERE id = ?', [id]);
  const existing = queryToObjects<TuningRecord>(result)[0];
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  database.run(
    `UPDATE tuning_records SET optimized_sql = ?, optimized_plan = ?,
     optimized_result = ?, status = ? WHERE id = ?`,
    [updated.optimized_sql, updated.optimized_plan, updated.optimized_result, updated.status, id]
  );
  saveDatabase();
  return updated;
}

export function deleteTuningRecord(id: number): boolean {
  const database = getDatabase();
  const before = database.exec('SELECT COUNT(*) as count FROM tuning_records WHERE id = ?', [id]);
  const countBefore = before[0]?.values[0]?.[0] as number;
  if (countBefore === 0) return false;

  database.run('DELETE FROM tuning_records WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    log.info('Database closed');
  }
}
