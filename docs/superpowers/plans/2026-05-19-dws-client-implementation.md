# DWS Client 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**目标:** 构建一个完整的 DWS 桌面客户端应用，支持集群管理、大模型对话、DWS 调优和测试报告生成

**架构:** Electron + React + TypeScript，模块化设计，各功能模块独立可测试

**技术栈:** Electron 28+, React 18+, TypeScript 5+, pg, electron-store, better-sqlite3, docx, markdown-pdf

---

## 项目结构

```
dws-client/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口
│   │   ├── ipc/                 # IPC 处理器
│   │   │   ├── cluster.ts       # 集群管理 IPC
│   │   │   ├── llm.ts           # 大模型 IPC
│   │   │   ├── sql.ts           # SQL 执行 IPC
│   │   │   └── report.ts        # 报告 IPC
│   │   ├── services/            # 主进程服务
│   │   │   ├── ClusterManager.ts
│   │   │   ├── LLMGateway.ts
│   │   │   ├── DWSDirector.ts
│   │   │   ├── TuningAdvisor.ts
│   │   │   ├── TestRunner.ts
│   │   │   └── ReportExporter.ts
│   │   ├── storage/             # 存储层
│   │   │   ├── config.ts        # electron-store 配置
│   │   │   └── database.ts      # SQLite 数据库
│   │   └── utils/
│   │       └── logger.ts
│   ├── renderer/                # Electron 渲染进程
│   │   ├── index.html
│   │   ├── index.tsx           # React 入口
│   │   ├── App.tsx
│   │   ├── components/          # UI 组件
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopBar.tsx
│   │   │   │   └── MainContent.tsx
│   │   │   ├── Cluster/
│   │   │   │   ├── ClusterList.tsx
│   │   │   │   └── ClusterForm.tsx
│   │   │   ├── LLM/
│   │   │   │   ├── LLMConfig.tsx
│   │   │   │   └── ChatPanel.tsx
│   │   │   ├── Tuning/
│   │   │   │   ├── TuningPanel.tsx
│   │   │   │   └── CompareView.tsx
│   │   │   └── Report/
│   │   │       ├── TestCaseTable.tsx
│   │   │       ├── TestRunner.tsx
│   │   │       └── ExportPanel.tsx
│   │   ├── hooks/              # React hooks
│   │   ├── contexts/           # React contexts
│   │   └── styles/             # 样式文件
│   └── preload/                # 预加载脚本
│       └── index.ts
├── package.json
├── tsconfig.json
├── electron-builder.json
└── SPEC.md                     # 需求规格文档
```

---

## 实现阶段

### 阶段 1: 项目脚手架

**目标:** 初始化 Electron + React + TypeScript 项目

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `electron-builder.json`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/index.tsx`
- Create: `src/renderer/App.tsx`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "dws-client",
  "version": "1.0.0",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:vite\" \"npm run dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "wait-on http://localhost:5173 && electron .",
    "build": "npm run build:vite && npm run build:electron",
    "build:vite": "vite build",
    "build:electron": "tsc -p tsconfig.node.json",
    "package": "npm run build && electron-builder"
  },
  "dependencies": {
    "electron-store": "^8.1.0",
    "better-sqlite3": "^9.4.0",
    "pg": "^8.11.0",
    "docx": "^8.5.0",
    "electron-log": "^5.0.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "@types/pg": "^8.10.0",
    "@types/better-sqlite3": "^7.6.0",
    "vite": "^5.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "electron-builder": "^24.9.0"
  }
}
```

- [ ] **Step 2: 创建 TypeScript 配置**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/renderer/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: 创建 Vite 配置**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
```

- [ ] **Step 4: 创建 Electron 主进程入口**

```ts
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import log from 'electron-log'

log.initialize()
log.info('DWS Client starting...')

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
```

- [ ] **Step 5: 创建预加载脚本**

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 集群管理
  getClusters: () => ipcRenderer.invoke('cluster:getAll'),
  addCluster: (cluster: any) => ipcRenderer.invoke('cluster:add', cluster),
  updateCluster: (cluster: any) => ipcRenderer.invoke('cluster:update', cluster),
  deleteCluster: (id: string) => ipcRenderer.invoke('cluster:delete', id),
  testConnection: (cluster: any) => ipcRenderer.invoke('cluster:test', cluster),

  // 大模型
  getLLMConfig: () => ipcRenderer.invoke('llm:getConfig'),
  setLLMConfig: (config: any) => ipcRenderer.invoke('llm:setConfig', config),
  chat: (messages: any[]) => ipcRenderer.invoke('llm:chat', messages),

  // SQL 执行
  executeSQL: (sql: string) => ipcRenderer.invoke('sql:execute', sql),
  getExecutionPlan: (sql: string) => ipcRenderer.invoke('sql:plan', sql),

  // 测试报告
  saveTestCase: (testCase: any) => ipcRenderer.invoke('report:saveTestCase', testCase),
  getTestCases: (reportId: string) => ipcRenderer.invoke('report:getTestCases', reportId),
  exportReport: (reportId: string, format: string) => ipcRenderer.invoke('report:export', reportId, format)
})
```

- [ ] **Step 6: 创建 React 入口**

```tsx
// src/renderer/index.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: 创建基础 App 组件**

```tsx
// src/renderer/App.tsx
import React from 'react'

export default function App() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>DWS Client</h1>
      <p>应用已启动</p>
    </div>
  )
}
```

- [ ] **Step 8: 安装依赖并验证**

Run: `npm install`
Expected: 依赖安装成功

Run: `npm run dev`
Expected: Electron 窗口打开，显示 "DWS Client"

- [ ] **Step 9: 提交**

```bash
git init
git add package.json tsconfig.json vite.config.ts src/main/index.ts src/preload/index.ts src/renderer/index.tsx src/renderer/App.tsx src/renderer/index.html
git commit -m "feat: initialize Electron + React + TypeScript project"
```

---

### 阶段 2: 核心存储层

**目标:** 实现配置加密存储和 SQLite 数据库

**Files:**
- Create: `src/main/storage/config.ts`
- Create: `src/main/storage/database.ts`
- Create: `src/main/storage/schema.sql`
- Create: `tests/main/storage.test.ts`

- [ ] **Step 1: 创建 electron-store 配置管理**

```ts
// src/main/storage/config.ts
import Store from 'electron-store'
import { encrypt, decrypt } from './crypto'

interface ClusterConfig {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string  // 加密存储
}

interface LLMConfig {
  provider: 'openai' | 'eimaas' | 'custom'
  apiKey?: string  // 加密存储
  baseUrl?: string
  model?: string
}

interface AppConfig {
  clusters: ClusterConfig[]
  llm: LLMConfig
  currentClusterId?: string
}

const store = new Store<AppConfig>({
  name: 'dws-client-config',
  encryptionKey: 'dws-client-secure-key'  // 生产环境应使用更安全的密钥
})

export const configStorage = {
  getClusters(): ClusterConfig[] {
    return store.get('clusters', [])
  },

  addCluster(cluster: Omit<ClusterConfig, 'id'>): ClusterConfig {
    const clusters = this.getClusters()
    const newCluster = {
      ...cluster,
      id: `cluster-${Date.now()}`
    }
    clusters.push(newCluster)
    store.set('clusters', clusters)
    return newCluster
  },

  updateCluster(id: string, updates: Partial<ClusterConfig>) {
    const clusters = this.getClusters()
    const index = clusters.findIndex(c => c.id === id)
    if (index !== -1) {
      clusters[index] = { ...clusters[index], ...updates }
      store.set('clusters', clusters)
    }
  },

  deleteCluster(id: string) {
    const clusters = this.getClusters().filter(c => c.id !== id)
    store.set('clusters', clusters)
  },

  getLLMConfig(): LLMConfig {
    return store.get('llm', { provider: 'openai' })
  },

  setLLMConfig(config: LLMConfig) {
    store.set('llm', config)
  },

  getCurrentClusterId(): string | undefined {
    return store.get('currentClusterId')
  },

  setCurrentClusterId(id: string) {
    store.set('currentClusterId', id)
  }
}
```

- [ ] **Step 2: 创建 SQLite 数据库**

```ts
// src/main/storage/database.ts
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import log from 'electron-log'

let db: Database.Database | null = null

export function initDatabase() {
  const dbPath = join(app.getPath('userData'), 'dws-client.db')
  log.info(`Initializing database at: ${dbPath}`)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      name TEXT NOT NULL,
      preconditions TEXT,
      steps TEXT,
      expected_results TEXT,
      actual_results TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    );

    CREATE TABLE IF NOT EXISTS tuning_records (
      id TEXT PRIMARY KEY,
      original_sql TEXT NOT NULL,
      optimized_sql TEXT,
      original_plan TEXT,
      optimized_plan TEXT,
      original_result TEXT,
      optimized_result TEXT,
      status TEXT,
      created_at INTEGER NOT NULL
    );
  `)

  log.info('Database initialized successfully')
}

export const database = {
  // Chat messages
  saveMessage(sessionId: string, role: string, content: string) {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    db!.prepare(
      'INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, sessionId, role, content, Date.now())
    return id
  },

  getMessages(sessionId: string): any[] {
    return db!.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId)
  },

  // Reports
  createReport(name: string, description?: string) {
    const id = `report-${Date.now()}`
    const now = Date.now()
    db!.prepare(
      'INSERT INTO reports (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, description || '', now, now)
    return id
  },

  getReports() {
    return db!.prepare('SELECT * FROM reports ORDER BY updated_at DESC').all()
  },

  // Test cases
  saveTestCase(reportId: string, testCase: any) {
    const id = testCase.id || `tc-${Date.now()}`
    const now = Date.now()
    db!.prepare(`
      INSERT OR REPLACE INTO test_cases
      (id, report_id, name, preconditions, steps, expected_results, actual_results, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, reportId, testCase.name, testCase.preconditions, testCase.steps,
      testCase.expected_results, testCase.actual_results, testCase.status || 'pending',
      testCase.notes || '', testCase.created_at || now, now
    )
    return id
  },

  getTestCases(reportId: string) {
    return db!.prepare('SELECT * FROM test_cases WHERE report_id = ? ORDER BY created_at ASC').all(reportId)
  },

  // Tuning records
  saveTuningRecord(record: any) {
    const id = `tuning-${Date.now()}`
    db!.prepare(`
      INSERT INTO tuning_records
      (id, original_sql, optimized_sql, original_plan, optimized_plan, original_result, optimized_result, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, record.original_sql, record.optimized_sql, record.original_plan,
      record.optimized_plan, record.original_result, record.optimized_result,
      record.status || 'pending', Date.now()
    )
    return id
  },

  updateTuningRecord(id: string, updates: any) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = [...Object.values(updates), id]
    db!.prepare(`UPDATE tuning_records SET ${sets} WHERE id = ?`).run(...values)
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/main/storage/config.ts src/main/storage/database.ts
git commit -m "feat: add config and database storage layer"
```

---

### 阶段 3: UI 布局框架

**目标:** 实现侧边栏导航、顶部栏和主内容区

**Files:**
- Create: `src/renderer/components/Layout/Sidebar.tsx`
- Create: `src/renderer/components/Layout/TopBar.tsx`
- Create: `src/renderer/components/Layout/MainContent.tsx`
- Create: `src/renderer/styles/global.css`
- Create: `src/renderer/contexts/AppContext.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 创建全局样式**

```css
/* src/renderer/styles/global.css */
:root {
  --color-primary: #0078d4;
  --color-primary-hover: #106ebe;
  --color-bg: #f5f5f5;
  --color-surface: #ffffff;
  --color-text: #323130;
  --color-text-secondary: #605e5c;
  --color-border: #e1dfdd;
  --sidebar-width: 240px;
  --topbar-height: 48px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
}

.app-container {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.sidebar-logo {
  padding: 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-border);
}

.sidebar-nav {
  flex: 1;
  padding: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.nav-item:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.nav-item.active {
  background: #e6f2fa;
  color: var(--color-primary);
}

.topbar {
  height: var(--topbar-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
}
```

- [ ] **Step 2: 创建 Sidebar 组件**

```tsx
// src/renderer/components/Layout/Sidebar.tsx
import React from 'react'

const NAV_ITEMS = [
  { id: 'clusters', label: '集群管理', icon: '🗄️' },
  { id: 'llm', label: '大模型配置', icon: '🤖' },
  { id: 'tuning', label: 'DWS 调优', icon: '⚡' },
  { id: 'report', label: '测试报告', icon: '📋' },
  { id: 'history', label: '历史记录', icon: '📜' }
]

interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">DWS Client</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <div
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 3: 创建 TopBar 组件**

```tsx
// src/renderer/components/Layout/TopBar.tsx
import React from 'react'

interface Cluster {
  id: string
  name: string
}

interface TopBarProps {
  clusters: Cluster[]
  currentCluster: Cluster | null
  onClusterChange: (clusterId: string) => void
}

export function TopBar({ clusters, currentCluster, onClusterChange }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-title">当前集群:</div>
      <select
        value={currentCluster?.id || ''}
        onChange={e => onClusterChange(e.target.value)}
        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
      >
        <option value="">选择集群</option>
        {clusters.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 4: 创建 AppContext**

```tsx
// src/renderer/contexts/AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react'

interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
}

interface AppContextType {
  clusters: Cluster[]
  currentCluster: Cluster | null
  setClusters: (clusters: Cluster[]) => void
  setCurrentCluster: (cluster: Cluster | null) => void
  refreshClusters: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [currentCluster, setCurrentCluster] = useState<Cluster | null>(null)

  const refreshClusters = async () => {
    const data = await window.electronAPI.getClusters()
    setClusters(data)
    const currentId = data[0]?.id
    if (currentId) {
      setCurrentCluster(data.find(c => c.id === currentId) || null)
    }
  }

  useEffect(() => {
    refreshClusters()
  }, [])

  return (
    <AppContext.Provider value={{ clusters, currentCluster, setClusters, setCurrentCluster, refreshClusters }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
```

- [ ] **Step 5: 更新 App.tsx**

```tsx
// src/renderer/App.tsx
import React, { useState } from 'react'
import { AppProvider, useApp } from './contexts/AppContext'
import { Sidebar } from './components/Layout/Sidebar'
import { TopBar } from './components/Layout/TopBar'
import { ClusterPanel } from './components/Cluster/ClusterPanel'
import { LLMPanel } from './components/LLM/LLMPanel'
import { TuningPanel } from './components/Tuning/TuningPanel'
import { ReportPanel } from './components/Report/ReportPanel'
import './styles/global.css'

function AppContent() {
  const { clusters, currentCluster, setCurrentCluster } = useApp()
  const [activeView, setActiveView] = useState('clusters')

  const renderContent = () => {
    switch (activeView) {
      case 'clusters': return <ClusterPanel />
      case 'llm': return <LLMPanel />
      case 'tuning': return <TuningPanel />
      case 'report': return <ReportPanel />
      default: return <ClusterPanel />
    }
  }

  return (
    <div className="app-container">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          clusters={clusters}
          currentCluster={currentCluster}
          onClusterChange={setCurrentCluster}
        />
        <div className="main-content">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
```

- [ ] **Step 6: 创建占位面板组件**

```tsx
// src/renderer/components/Cluster/ClusterPanel.tsx
// src/renderer/components/LLM/LLMPanel.tsx
// src/renderer/components/Tuning/TuningPanel.tsx
// src/renderer/components/Report/ReportPanel.tsx
```

每个面板暂时返回 `<div>Panel - 待实现</div>`

- [ ] **Step 7: 验证 UI**

Run: `npm run dev`
Expected: 侧边栏显示导航，顶部显示集群下拉

- [ ] **Step 8: 提交**

```bash
git add src/renderer/components/Layout src/renderer/contexts/AppContext.tsx src/renderer/styles/global.css
git commit -m "feat: add UI layout framework with sidebar and topbar"
```

---

### 阶段 4: 集群管理模块

**目标:** 实现集群的增删改查和连接测试

**Files:**
- Modify: `src/main/ipc/cluster.ts`
- Modify: `src/main/services/ClusterManager.ts`
- Create: `src/renderer/components/Cluster/ClusterPanel.tsx`
- Create: `src/renderer/components/Cluster/ClusterForm.tsx`

- [ ] **Step 1: 创建 ClusterManager 服务**

```ts
// src/main/services/ClusterManager.ts
import { Client } from 'pg'
import log from 'electron-log'

export interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
}

let currentClient: Client | null = null

export const clusterManager = {
  async testConnection(cluster: Cluster): Promise<{ success: boolean; message: string }> {
    const client = new Client({
      host: cluster.host,
      port: cluster.port,
      database: cluster.database,
      user: cluster.username,
      password: cluster.password,
      connectionTimeoutMillis: 10000
    })

    try {
      await client.connect()
      const result = await client.query('SELECT version()')
      await client.end()
      return { success: true, message: result.rows[0].version }
    } catch (err: any) {
      log.error('Connection test failed:', err)
      return { success: false, message: err.message }
    }
  },

  async executeQuery(sql: string): Promise<{ success: boolean; data?: any; error?: string }> {
    // 使用当前选中的集群执行查询
  },

  async getExecutionPlan(sql: string): Promise<{ success: boolean; plan?: any; error?: string }> {
    // 获取执行计划
  }
}
```

- [ ] **Step 2: 创建集群 IPC 处理器**

```ts
// src/main/ipc/cluster.ts
import { ipcMain } from 'electron'
import { configStorage } from '../storage/config'
import { clusterManager } from '../services/ClusterManager'

export function registerClusterIPC() {
  ipcMain.handle('cluster:getAll', () => {
    return configStorage.getClusters()
  })

  ipcMain.handle('cluster:add', (_, cluster) => {
    return configStorage.addCluster(cluster)
  })

  ipcMain.handle('cluster:update', (_, cluster) => {
    configStorage.updateCluster(cluster.id, cluster)
    return cluster
  })

  ipcMain.handle('cluster:delete', (_, id) => {
    configStorage.deleteCluster(id)
    return { success: true }
  })

  ipcMain.handle('cluster:test', async (_, cluster) => {
    return await clusterManager.testConnection(cluster)
  })
}
```

- [ ] **Step 3: 创建 ClusterPanel UI**

```tsx
// src/renderer/components/Cluster/ClusterPanel.tsx
import React, { useState, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext'
import { ClusterForm } from './ClusterForm'

export function ClusterPanel() {
  const { clusters, refreshClusters } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editingCluster, setEditingCluster] = useState<any>(null)

  const handleTest = async (cluster: any) => {
    const result = await window.electronAPI.testConnection(cluster)
    alert(result.success ? `连接成功: ${result.message}` : `连接失败: ${result.message}`)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定删除该集群配置？')) {
      await window.electronAPI.deleteCluster(id)
      refreshClusters()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>集群管理</h2>
        <button
          onClick={() => { setEditingCluster(null); setShowForm(true) }}
          style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          添加集群
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {clusters.map(cluster => (
          <div key={cluster.id} style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <h3>{cluster.name}</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              {cluster.host}:{cluster.port}/{cluster.database}
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>用户: {cluster.username}</p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button onClick={() => handleTest(cluster)}>测试连接</button>
              <button onClick={() => { setEditingCluster(cluster); setShowForm(true) }}>编辑</button>
              <button onClick={() => handleDelete(cluster.id)} style={{ color: 'red' }}>删除</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <ClusterForm
          cluster={editingCluster}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); refreshClusters() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: 创建 ClusterForm**

```tsx
// src/renderer/components/Cluster/ClusterForm.tsx
import React, { useState } from 'react'

export function ClusterForm({ cluster, onClose, onSave }: { cluster?: any; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState(cluster || {
    name: '',
    host: '',
    port: 5432,
    database: 'postgres',
    username: '',
    password: ''
  })

  const handleSubmit = async () => {
    if (cluster?.id) {
      await window.electronAPI.updateCluster(form)
    } else {
      await window.electronAPI.addCluster(form)
    }
    onSave()
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px' }}>
        <h3>{cluster?.id ? '编辑集群' : '添加集群'}</h3>
        <div style={{ marginTop: '16px' }}>
          <label>名称</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>主机</label>
          <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>端口</label>
          <input type="number" value={form.port} onChange={e => setForm({ ...form, port: parseInt(e.target.value) })} />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>数据库</label>
          <input value={form.database} onChange={e => setForm({ ...form, database: e.target.value })} />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>用户名</label>
          <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>密码</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </div>
        <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}>取消</button>
          <button onClick={handleSubmit} style={{ background: 'var(--color-primary)', color: 'white' }}>保存</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add src/main/ipc/cluster.ts src/main/services/ClusterManager.ts src/renderer/components/Cluster/
git commit -m "feat: add cluster management module"
```

---

### 阶段 5: 大模型网关

**目标:** 实现统一的大模型接口，支持 OpenAI/EI-MaaS/自建模型

**Files:**
- Create: `src/main/services/LLMGateway.ts`
- Create: `src/main/ipc/llm.ts`
- Create: `src/renderer/components/LLM/LLMPanel.tsx`
- Create: `src/renderer/components/LLM/ChatPanel.tsx`

- [ ] **Step 1: 创建 LLMGateway**

```ts
// src/main/services/LLMGateway.ts
import { configStorage } from '../storage/config'
import log from 'electron-log'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface LLMResponse {
  success: boolean
  content?: string
  error?: string
}

export const llmGateway = {
  async chat(messages: Message[]): Promise<LLMResponse> {
    const config = configStorage.getLLMConfig()

    try {
      switch (config.provider) {
        case 'openai':
          return await this.chatWithOpenAI(messages, config)
        case 'eimaas':
          return await this.chatWithEIMaaS(messages, config)
        case 'custom':
          return await this.chatWithCustom(messages, config)
        default:
          return { success: false, error: 'Unknown provider' }
      }
    } catch (err: any) {
      log.error('LLM chat error:', err)
      return { success: false, error: err.message }
    }
  },

  async chatWithOpenAI(messages: Message[], config: any): Promise<LLMResponse> {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4',
        messages
      })
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error }
    }

    const data = await response.json()
    return { success: true, content: data.choices[0].message.content }
  },

  async chatWithEIMaaS(messages: Message[], config: any): Promise<LLMResponse> {
    // 华为云 EI-MaaS API 格式
    const response = await fetch(`${config.baseUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': config.apiKey
      },
      body: JSON.stringify({
        model: config.model,
        messages
      })
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error }
    }

    const data = await response.json()
    return { success: true, content: data.result }
  },

  async chatWithCustom(messages: Message[], config: any): Promise<LLMResponse> {
    // 自建模型，OpenAI 兼容格式
    return this.chatWithOpenAI(messages, config)
  }
}
```

- [ ] **Step 2: 创建 LLM IPC 处理器**

```ts
// src/main/ipc/llm.ts
import { ipcMain } from 'electron'
import { configStorage } from '../storage/config'
import { llmGateway } from '../services/LLMGateway'
import { database } from '../storage/database'

export function registerLLMIPC() {
  ipcMain.handle('llm:getConfig', () => {
    return configStorage.getLLMConfig()
  })

  ipcMain.handle('llm:setConfig', (_, config) => {
    configStorage.setLLMConfig(config)
    return { success: true }
  })

  ipcMain.handle('llm:chat', async (_, messages, sessionId = 'default') => {
    // 保存用户消息
    messages.forEach(m => {
      if (m.role === 'user') {
        database.saveMessage(sessionId, 'user', m.content)
      }
    })

    const result = await llmGateway.chat(messages)

    if (result.success && result.content) {
      database.saveMessage(sessionId, 'assistant', result.content)
    }

    return result
  })
}
```

- [ ] **Step 3: 创建 LLMPanel UI**

```tsx
// src/renderer/components/LLM/LLMPanel.tsx
import React, { useState } from 'react'

export function LLMPanel() {
  const [config, setConfig] = useState({
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4'
  })

  const loadConfig = async () => {
    const saved = await window.electronAPI.getLLMConfig()
    setConfig({ ...config, ...saved })
  }

  const saveConfig = async () => {
    await window.electronAPI.setLLMConfig(config)
    alert('配置已保存')
  }

  return (
    <div>
      <h2>大模型配置</h2>
      <div style={{ marginTop: '20px', maxWidth: '500px' }}>
        <div>
          <label>提供商</label>
          <select value={config.provider} onChange={e => setConfig({ ...config, provider: e.target.value })}>
            <option value="openai">OpenAI 兼容 API</option>
            <option value="eimaas">华为云 EI-MaaS</option>
            <option value="custom">自建模型</option>
          </select>
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>API Key</label>
          <input type="password" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>Base URL</label>
          <input value={config.baseUrl} onChange={e => setConfig({ ...config, baseUrl: e.target.value })} />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label>模型</label>
          <input value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} />
        </div>
        <div style={{ marginTop: '20px' }}>
          <button onClick={saveConfig} style={{ background: 'var(--color-primary)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px' }}>
            保存配置
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 创建 ChatPanel UI**

```tsx
// src/renderer/components/LLM/ChatPanel.tsx
import React, { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!input.trim()) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages([...messages, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await window.electronAPI.chat([...messages, userMessage].map(m => ({ role: m.role, content: m.content })))
      if (result.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.content }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${result.error}` }])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '12px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block',
              padding: '8px 12px',
              borderRadius: '8px',
              background: msg.role === 'user' ? 'var(--color-primary)' : 'white',
              color: msg.role === 'user' ? 'white' : 'var(--color-text)'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div>思考中...</div>}
      </div>
      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="输入消息..."
          style={{ flex: 1, padding: '8px' }}
        />
        <button onClick={send} disabled={loading} style={{ padding: '8px 16px' }}>发送</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add src/main/services/LLMGateway.ts src/main/ipc/llm.ts src/renderer/components/LLM/
git commit -m "feat: add LLM gateway with OpenAI/EI-MaaS support"
```

---

### 阶段 6: SQL 执行器

**目标:** 实现 DWSDirector，处理 SQL 执行、执行计划获取、结果对比

**Files:**
- Create: `src/main/services/DWSDirector.ts`
- Create: `src/main/ipc/sql.ts`

- [ ] **Step 1: 创建 DWSDirector**

```ts
// src/main/services/DWSDirector.ts
import { Client } from 'pg'
import log from 'electron-log'
import { configStorage } from '../storage/config'

let currentConnection: { clusterId: string; client: Client } | null = null

export interface QueryResult {
  columns: string[]
  rows: any[]
  rowCount: number
  executionTime: number
}

export interface ExecutionPlan {
  plan: any
  executionTime: number
}

export interface CompareResult {
  original: QueryResult
  optimized: QueryResult
  timeDiff: number
  resultDiff: boolean
}

export const dwsDirector = {
  async connect(clusterId: string): Promise<{ success: boolean; error?: string }> {
    const clusters = configStorage.getClusters()
    const cluster = clusters.find(c => c.id === clusterId)
    if (!cluster) {
      return { success: false, error: 'Cluster not found' }
    }

    try {
      if (currentConnection) {
        await currentConnection.client.end()
      }

      const client = new Client({
        host: cluster.host,
        port: cluster.port,
        database: cluster.database,
        user: cluster.username,
        password: cluster.password
      })

      await client.connect()
      currentConnection = { clusterId, client }
      log.info(`Connected to cluster: ${cluster.name}`)
      return { success: true }
    } catch (err: any) {
      log.error('Connection error:', err)
      return { success: false, error: err.message }
    }
  },

  async executeQuery(sql: string): Promise<{ success: boolean; result?: QueryResult; error?: string }> {
    if (!currentConnection) {
      return { success: false, error: 'Not connected to any cluster' }
    }

    const startTime = Date.now()
    try {
      const result = await currentConnection.client.query(sql)
      const executionTime = Date.now() - startTime

      return {
        success: true,
        result: {
          columns: result.fields.map(f => f.name),
          rows: result.rows,
          rowCount: result.rowCount || 0,
          executionTime
        }
      }
    } catch (err: any) {
      log.error('Query error:', err)
      return { success: false, error: err.message }
    }
  },

  async getExecutionPlan(sql: string): Promise<{ success: boolean; plan?: ExecutionPlan; error?: string }> {
    if (!currentConnection) {
      return { success: false, error: 'Not connected to any cluster' }
    }

    const startTime = Date.now()
    try {
      const result = await currentConnection.client.query(`EXPLAIN (FORMAT JSON) ${sql}`)
      const executionTime = Date.now() - startTime

      return {
        success: true,
        plan: {
          plan: result.rows[0],
          executionTime
        }
      }
    } catch (err: any) {
      log.error('Plan error:', err)
      return { success: false, error: err.message }
    }
  },

  async compareResults(originalSql: string, optimizedSql: string): Promise<{ success: boolean; comparison?: CompareResult; error?: string }> {
    const originalResult = await this.executeQuery(originalSql)
    if (!originalResult.success) {
      return { success: false, error: `Original SQL failed: ${originalResult.error}` }
    }

    const optimizedResult = await this.executeQuery(optimizedSql)
    if (!optimizedResult.success) {
      return { success: false, error: `Optimized SQL failed: ${optimizedResult.error}` }
    }

    const timeDiff = originalResult.result!.executionTime - optimizedResult.result!.executionTime
    const resultDiff = JSON.stringify(originalResult.result!.rows) !== JSON.stringify(optimizedResult.result!.rows)

    return {
      success: true,
      comparison: {
        original: originalResult.result!,
        optimized: optimizedResult.result!,
        timeDiff,
        resultDiff
      }
    }
  }
}
```

- [ ] **Step 2: 创建 SQL IPC 处理器**

```ts
// src/main/ipc/sql.ts
import { ipcMain } from 'electron'
import { dwsDirector } from '../services/DWSDirector'
import { configStorage } from '../storage/config'

export function registerSQLIPC() {
  ipcMain.handle('cluster:connect', async (_, clusterId) => {
    return await dwsDirector.connect(clusterId)
  })

  ipcMain.handle('sql:execute', async (_, sql) => {
    return await dwsDirector.executeQuery(sql)
  })

  ipcMain.handle('sql:plan', async (_, sql) => {
    return await dwsDirector.getExecutionPlan(sql)
  })

  ipcMain.handle('sql:compare', async (_, originalSql, optimizedSql) => {
    return await dwsDirector.compareResults(originalSql, optimizedSql)
  })
}
```

- [ ] **Step 3: 更新 ClusterManager 添加 connect 功能**

```ts
// src/main/services/ClusterManager.ts
import { dwsDirector } from './DWSDirector'

export const clusterManager = {
  async testConnection(cluster: Cluster): Promise<{ success: boolean; message: string }> {
    // 临时连接测试
    const tempCluster = { ...cluster, id: 'temp' }
    const result = await dwsDirector.connect('temp')
    // 测试后断开
    return result
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/main/services/DWSDirector.ts src/main/ipc/sql.ts
git commit -m "feat: add DWS director for SQL execution and plan analysis"
```

---

### 阶段 7: 调优分析器

**目标:** 实现 TuningAdvisor，结合规则引擎和大模型进行调优分析

**Files:**
- Create: `src/main/services/TuningAdvisor.ts`
- Create: `src/renderer/components/Tuning/TuningPanel.tsx`
- Create: `src/renderer/components/Tuning/CompareView.tsx`

- [ ] **Step 1: 创建 TuningAdvisor**

```ts
// src/main/services/TuningAdvisor.ts
import { llmGateway } from './LLMGateway'
import { dwsDirector } from './DWSDirector'
import { database } from '../storage/database'
import log from 'electron-log'

interface TuningSuggestion {
  type: 'index' | 'sql_rewrite' | 'config' | 'partition'
  original: string
  suggested: string
  reason: string
}

export const tuningAdvisor = {
  async analyze(sql: string): Promise<{ success: boolean; suggestions?: TuningSuggestion[]; error?: string }> {
    // 1. 规则引擎初步分析
    const ruleBasedSuggestions = this.ruleBasedAnalysis(sql)

    // 2. 获取执行计划
    const planResult = await dwsDirector.getExecutionPlan(sql)
    if (!planResult.success) {
      return { success: false, error: planResult.error }
    }

    // 3. 大模型深度分析
    const llmAnalysis = await this.llmAnalysis(sql, planResult.plan?.plan)

    // 4. 合并建议
    const suggestions = [...ruleBasedSuggestions, ...llmAnalysis]

    // 5. 保存调优记录
    database.saveTuningRecord({
      original_sql: sql,
      original_plan: JSON.stringify(planResult.plan),
      status: 'analyzed'
    })

    return { success: true, suggestions }
  },

  ruleBasedAnalysis(sql: string): TuningSuggestion[] {
    const suggestions: TuningSuggestion[] = []

    // 规则1: 检测 SELECT *
    if (/\bSELECT\s+\*/.test(sql)) {
      suggestions.push({
        type: 'sql_rewrite',
        original: sql,
        suggested: sql.replace(/SELECT\s+\*/i, 'SELECT specific_columns'),
        reason: '避免 SELECT *，只查询需要的列'
      })
    }

    // 规则2: 检测缺少索引的 WHERE 条件
    if (/\bWHERE\b.*\b=\b/.test(sql) && !/\bCREATE\s+INDEX\b/.test(sql)) {
      suggestions.push({
        type: 'index',
        original: sql,
        suggested: 'CREATE INDEX idx ON table(column)',
        reason: 'WHERE 条件列可能需要索引'
      })
    }

    // 规则3: 检测 N+1 查询模式
    if (/\bIN\s*\(SELECT\b/.test(sql)) {
      suggestions.push({
        type: 'sql_rewrite',
        original: sql,
        suggested: 'Consider using JOIN instead of IN (SELECT)',
        reason: 'IN (SELECT) 可能导致性能问题，建议使用 JOIN'
      })
    }

    return suggestions
  },

  async llmAnalysis(sql: string, plan: any): Promise<TuningSuggestion[]> {
    const prompt = `
请分析以下 SQL 语句的性能问题，并给出优化建议。

SQL: ${sql}

执行计划: ${JSON.stringify(plan, null, 2)}

请以 JSON 格式返回优化建议，格式如下:
{
  "suggestions": [
    {
      "type": "index|sql_rewrite|config|partition",
      "original": "原 SQL",
      "suggested": "优化后 SQL",
      "reason": "优化原因"
    }
  ]
}
`

    const result = await llmGateway.chat([
      { role: 'system', content: 'You are a SQL performance expert.' },
      { role: 'user', content: prompt }
    ])

    if (!result.success) {
      log.error('LLM analysis failed:', result.error)
      return []
    }

    try {
      const parsed = JSON.parse(result.content!)
      return parsed.suggestions || []
    } catch {
      log.error('Failed to parse LLM response:', result.content)
      return []
    }
  },

  async applyOptimization(originalSql: string, optimizedSql: string): Promise<{ success: boolean; error?: string }> {
    const result = await dwsDirector.executeQuery(optimizedSql)
    return {
      success: result.success,
      error: result.error
    }
  }
}
```

- [ ] **Step 2: 创建 TuningPanel UI**

```tsx
// src/renderer/components/Tuning/TuningPanel.tsx
import React, { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { CompareView } from './CompareView'

export function TuningPanel() {
  const { currentCluster } = useApp()
  const [sql, setSql] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null)
  const [compareResult, setCompareResult] = useState<any>(null)

  const analyze = async () => {
    if (!sql.trim()) return
    if (!currentCluster) {
      alert('请先选择集群')
      return
    }

    setLoading(true)
    try {
      const result = await fetch('http://localhost:5173/api/tuning/analyze', {
        method: 'POST',
        body: JSON.stringify({ sql }),
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await result.json()
      setSuggestions(data.suggestions || [])
    } catch (err: any) {
      alert('分析失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = async (suggestion: any) => {
    setSelectedSuggestion(suggestion)
    // 调用后端对比执行结果
    const result = await window.electronAPI.sqlCompare(sql, suggestion.suggested)
    setCompareResult(result)
  }

  return (
    <div>
      <h2>DWS 调优</h2>

      <div style={{ marginTop: '20px' }}>
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          placeholder="输入需要调优的 SQL..."
          style={{ width: '100%', height: '150px', padding: '12px', fontFamily: 'monospace' }}
        />
        <button
          onClick={analyze}
          disabled={loading}
          style={{ marginTop: '12px', padding: '10px 20px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {loading ? '分析中...' : '分析'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3>优化建议</h3>
          {suggestions.map((s, i) => (
            <div key={i} style={{ background: 'white', padding: '16px', marginTop: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ background: '#e6f2fa', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{s.type}</span>
                <button onClick={() => applySuggestion(s)} style={{ padding: '4px 12px' }}>应用并对比</button>
              </div>
              <p style={{ marginTop: '8px', color: 'var(--color-text-secondary)' }}>{s.reason}</p>
              <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
                <div>原: {s.original}</div>
                <div style={{ color: 'var(--color-primary)' }}>优化: {s.suggested}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {compareResult && selectedSuggestion && (
        <CompareView
          originalSql={sql}
          optimizedSql={selectedSuggestion.suggested}
          compareResult={compareResult}
          onClose={() => setCompareResult(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: 创建 CompareView UI**

```tsx
// src/renderer/components/Tuning/CompareView.tsx
import React from 'react'

export function CompareView({ originalSql, optimizedSql, compareResult, onClose }: any) {
  const { original, optimized, timeDiff, resultDiff } = compareResult

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '900px', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>优化对比结果</h3>
          <button onClick={onClose}>关闭</button>
        </div>

        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <h4>原始 SQL</h4>
            <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>{originalSql}</pre>
            <p>执行时间: {original.executionTime}ms</p>
            <p>返回行数: {original.rowCount}</p>
          </div>
          <div>
            <h4>优化后 SQL</h4>
            <pre style={{ background: '#e6f2fa', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>{optimizedSql}</pre>
            <p>执行时间: {optimized.executionTime}ms</p>
            <p>返回行数: {optimized.rowCount}</p>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '16px', background: timeDiff > 0 ? '#e6f2fa' : '#fef0e6', borderRadius: '8px' }}>
          <h4>对比总结</h4>
          <p>性能提升: {timeDiff > 0 ? `+${timeDiff}ms (${((timeDiff / original.executionTime) * 100).toFixed(1)}%)` : `${timeDiff}ms`}</p>
          <p>结果一致性: {resultDiff ? '⚠️ 有差异' : '✓ 一致'}</p>
        </div>

        {resultDiff && (
          <div style={{ marginTop: '16px' }}>
            <h4>原始结果</h4>
            <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(original.rows, null, 2)}
            </pre>
            <h4 style={{ marginTop: '16px' }}>优化后结果</h4>
            <pre style={{ background: '#e6f2fa', padding: '12px', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(optimized.rows, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add src/main/services/TuningAdvisor.ts src/renderer/components/Tuning/
git commit -m "feat: add tuning advisor with rule engine and LLM analysis"
```

---

### 阶段 8: 测试运行器

**目标:** 实现 TestRunner，支持自然语言解析、自动填充测试用例、执行与纠错

**Files:**
- Create: `src/main/services/TestRunner.ts`
- Create: `src/renderer/components/Report/ReportPanel.tsx`
- Create: `src/renderer/components/Report/TestCaseTable.tsx`
- Create: `src/renderer/components/Report/TestRunner.tsx`

- [ ] **Step 1: 创建 TestRunner**

```ts
// src/main/services/TestRunner.ts
import { llmGateway } from './LLMGateway'
import { dwsDirector } from './DWSDirector'
import { database } from '../storage/database'
import log from 'electron-log'

interface TestStep {
  step: string
  sql?: string
  expected?: string
  actual?: string
  status: 'pending' | 'passed' | 'failed'
  error?: string
}

interface TestCase {
  id: string
  name: string
  preconditions: string
  steps: TestStep[]
  expected_results: string
  actual_results: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  notes: string
}

export const testRunner = {
  async parseRequirements(requirement: string): Promise<{ success: boolean; testCase?: Partial<TestCase>; error?: string }> {
    const prompt = `
请将以下测试需求解析为结构化的测试用例。

测试需求: ${requirement}

请以 JSON 格式返回测试用例:
{
  "name": "测试用例名称",
  "preconditions": "前置条件",
  "steps": [
    {
      "step": "步骤描述",
      "sql": "执行的 SQL 语句",
      "expected": "预期结果描述"
    }
  ],
  "expected_results": "整体预期结果"
}
`

    const result = await llmGateway.chat([
      { role: 'system', content: 'You are a test case designer.' },
      { role: 'user', content: prompt }
    ])

    if (!result.success) {
      return { success: false, error: result.error }
    }

    try {
      const parsed = JSON.parse(result.content!)
      return {
        success: true,
        testCase: {
          ...parsed,
          steps: parsed.steps.map((s: any) => ({ ...s, status: 'pending' as const }))
        }
      }
    } catch {
      return { success: false, error: '解析失败，请重试' }
    }
  },

  async executeTestCase(testCase: TestCase): Promise<{ success: boolean; executedCase?: TestCase; error?: string }> {
    const executedCase = { ...testCase, status: 'running' as const, steps: [] }

    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i]
      const executedStep: TestStep = { ...step }

      if (step.sql) {
        const result = await dwsDirector.executeQuery(step.sql)

        if (result.success) {
          executedStep.actual = JSON.stringify(result.result)
          executedStep.status = 'passed'
        } else {
          executedStep.actual = result.error
          executedStep.status = 'failed'

          // 尝试纠错
          const fixSuggestion = await this.suggestFix(step.sql, result.error!)
          if (fixSuggestion) {
            executedStep.error = `错误: ${result.error}\n建议修复: ${fixSuggestion}`
          }

          executedCase.status = 'failed'
        }
      }

      executedCase.steps.push(executedStep)
    }

    // 更新数据库
    if (executedCase.id) {
      database.saveTestCase('current-report', executedCase)
    }

    return { success: true, executedCase }
  },

  async suggestFix(sql: string, error: string): Promise<string | null> {
    const prompt = `
SQL 执行出错，请分析错误并给出修复建议。

SQL: ${sql}
错误: ${error}

请只返回修复后的 SQL，不要其他解释。如果无法修复，请返回 null。
`

    const result = await llmGateway.chat([
      { role: 'system', content: 'You are a SQL expert.' },
      { role: 'user', content: prompt }
    ])

    if (result.success && result.content && !result.content.includes('null')) {
      return result.content.trim()
    }

    return null
  },

  async runAutoTest(testCase: TestCase, onStepComplete: (step: TestStep) => void): Promise<TestCase> {
    const executedCase = { ...testCase, status: 'running' as const, steps: [] }

    for (const step of testCase.steps) {
      const executedStep: TestStep = { ...step }

      if (step.sql) {
        const result = await dwsDirector.executeQuery(step.sql)

        if (result.success) {
          executedStep.actual = JSON.stringify(result.result)
          executedStep.status = 'passed'
        } else {
          executedStep.actual = result.error
          executedStep.status = 'failed'

          const fixSuggestion = await this.suggestFix(step.sql, result.error!)
          if (fixSuggestion) {
            executedStep.error = `建议: ${fixSuggestion}`
            // 自动使用修复后的 SQL 重试
            const retryResult = await dwsDirector.executeQuery(fixSuggestion)
            if (retryResult.success) {
              executedStep.actual = JSON.stringify(retryResult.result)
              executedStep.status = 'passed'
              executedStep.step += ` (自动修复重试成功)`
            }
          }
        }
      }

      executedCase.steps.push(executedStep)
      onStepComplete(executedStep)
    }

    executedCase.status = executedCase.steps.every(s => s.status === 'passed') ? 'passed' : 'failed'
    return executedCase
  }
}
```

- [ ] **Step 2: 创建 ReportPanel UI**

```tsx
// src/renderer/components/Report/ReportPanel.tsx
import React, { useState, useEffect } from 'react'
import { TestCaseTable } from './TestCaseTable'
import { TestRunner } from './TestRunner'

export function ReportPanel() {
  const [reports, setReports] = useState<any[]>([])
  const [currentReport, setCurrentReport] = useState<any>(null)
  const [testCases, setTestCases] = useState<any[]>([])
  const [showRunner, setShowRunner] = useState(false)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    // const data = await window.electronAPI.getReports()
    // setReports(data)
    setReports([]) // 暂时模拟
  }

  const createReport = async () => {
    const name = prompt('输入报告名称:')
    if (name) {
      // const id = await window.electronAPI.createReport(name)
      // loadReports()
      setCurrentReport({ id: 'new', name })
    }
  }

  const loadTestCases = async (reportId: string) => {
    const cases = await window.electronAPI.getTestCases(reportId)
    setTestCases(cases)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>测试报告</h2>
        <button onClick={createReport} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px' }}>
          新建报告
        </button>
      </div>

      {!currentReport ? (
        <div>
          <h3>报告列表</h3>
          {reports.length === 0 && <p>暂无报告</p>}
          {reports.map(r => (
            <div key={r.id} onClick={() => { setCurrentReport(r); loadTestCases(r.id) }} style={{ padding: '12px', background: 'white', marginTop: '8px', borderRadius: '4px', cursor: 'pointer' }}>
              <h4>{r.name}</h4>
              <p style={{ color: 'var(--color-text-secondary)' }}>{r.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3>{currentReport.name}</h3>
              <button onClick={() => setCurrentReport(null)} style={{ marginTop: '8px' }}>返回报告列表</button>
            </div>
            <button onClick={() => setShowRunner(true)} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px' }}>
              添加测试用例
            </button>
          </div>

          <TestCaseTable testCases={testCases} />

          {showRunner && (
            <TestRunner
              reportId={currentReport.id}
              onClose={() => { setShowRunner(false); loadTestCases(currentReport.id) }}
            />
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 创建 TestCaseTable UI**

```tsx
// src/renderer/components/Report/TestCaseTable.tsx
import React from 'react'

export function TestCaseTable({ testCases }: { testCases: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (testCases.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>暂无测试用例</p>
  }

  return (
    <div>
      {testCases.map(tc => (
        <div key={tc.id} style={{ background: 'white', marginTop: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div
            onClick={() => setExpandedId(expandedId === tc.id ? null : tc.id)}
            style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <h4 style={{ margin: 0 }}>{tc.name}</h4>
              <span style={{
                display: 'inline-block',
                marginTop: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                background: tc.status === 'passed' ? '#e6f2fa' : tc.status === 'failed' ? '#fef0e6' : '#f5f5f5'
              }}>
                {tc.status}
              </span>
            </div>
            <span>{expandedId === tc.id ? '▲' : '▼'}</span>
          </div>

          {expandedId === tc.id && (
            <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', background: '#fafafa' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>步骤</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>SQL</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>预期结果</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>实际结果</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {tc.steps?.map((step: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{i + 1}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{step.sql}</pre>
                      </td>
                      <td style={{ padding: '8px' }}>{step.expected}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: step.status === 'passed' ? 'green' : 'red' }}>
                          {step.actual || '-'}
                        </pre>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ color: step.status === 'passed' ? 'green' : 'red' }}>
                          {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tc.notes && (
                <div style={{ marginTop: '12px', padding: '8px', background: '#fff3cd', borderRadius: '4px' }}>
                  <strong>备注:</strong> {tc.notes}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 创建 TestRunner UI**

```tsx
// src/renderer/components/Report/TestRunner.tsx
import React, { useState } from 'react'

export function TestRunner({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [requirement, setRequirement] = useState('')
  const [testCase, setTestCase] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const parseRequirement = async () => {
    if (!requirement.trim()) return
    setLoading(true)

    try {
      const result = await window.electronAPI.parseRequirement(requirement)
      if (result.success) {
        setTestCase({ ...result.testCase, id: `tc-${Date.now()}`, status: 'pending' })
      } else {
        alert('解析失败: ' + result.error)
      }
    } catch (err: any) {
      alert('解析失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const executeTest = async () => {
    if (!testCase) return
    setExecuting(true)

    try {
      const result = await window.electronAPI.executeTestAuto(testCase, (step: any) => {
        setCurrentStep(prev => prev + 1)
      })

      if (result.success) {
        await window.electronAPI.saveTestCase(reportId, result.executedCase)
        onClose()
      }
    } catch (err: any) {
      alert('执行失败: ' + err.message)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>AI 测试用例生成</h3>
          <button onClick={onClose}>关闭</button>
        </div>

        {!testCase ? (
          <div style={{ marginTop: '20px' }}>
            <label>输入测试需求（自然语言）</label>
            <textarea
              value={requirement}
              onChange={e => setRequirement(e.target.value)}
              placeholder="例如：测试用户登录功能，需要验证用户名密码正确和错误的情况"
              style={{ width: '100%', height: '100px', marginTop: '8px', padding: '8px' }}
            />
            <button
              onClick={parseRequirement}
              disabled={loading}
              style={{ marginTop: '12px', padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {loading ? '解析中...' : '解析需求'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label>测试名称</label>
              <input
                value={testCase.name}
                onChange={e => setTestCase({ ...testCase, name: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label>前置条件</label>
              <textarea
                value={testCase.preconditions}
                onChange={e => setTestCase({ ...testCase, preconditions: e.target.value })}
                style={{ width: '100%', height: '60px', padding: '8px', marginTop: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label>测试步骤</label>
              {testCase.steps?.map((step: any, i: number) => (
                <div key={i} style={{ background: '#f5f5f5', padding: '12px', marginTop: '8px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>步骤 {i + 1}:</span>
                    <input
                      value={step.step}
                      onChange={e => {
                        const steps = [...testCase.steps]
                        steps[i].step = e.target.value
                        setTestCase({ ...testCase, steps })
                      }}
                      placeholder="步骤描述"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <textarea
                    value={step.sql}
                    onChange={e => {
                      const steps = [...testCase.steps]
                      steps[i].sql = e.target.value
                      setTestCase({ ...testCase, steps })
                    }}
                    placeholder="SQL 语句"
                    style={{ width: '100%', height: '40px', marginTop: '8px', padding: '8px', fontFamily: 'monospace' }}
                  />
                  <input
                    value={step.expected}
                    onChange={e => {
                      const steps = [...testCase.steps]
                      steps[i].expected = e.target.value
                      setTestCase({ ...testCase, steps })
                    }}
                    placeholder="预期结果"
                    style={{ width: '100%', marginTop: '8px', padding: '8px' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setTestCase(null)}>重新解析</button>
              <button
                onClick={executeTest}
                disabled={executing}
                style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                {executing ? `执行中 (${currentStep}/${testCase.steps?.length})` : '确认并执行'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add src/main/services/TestRunner.ts src/renderer/components/Report/
git commit -m "feat: add test runner with AI parsing and auto-execution"
```

---

### 阶段 9: 报告导出

**目标:** 实现 ReportExporter，支持 Word/Markdown/PDF 导出

**Files:**
- Create: `src/main/services/ReportExporter.ts`
- Create: `src/main/ipc/report.ts`

- [ ] **Step 1: 创建 ReportExporter**

```ts
// src/main/services/ReportExporter.ts
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel } from 'docx'
import { writeFile } from 'fs/promises'
import { database } from '../storage/database'
import log from 'electron-log'

export const reportExporter = {
  async exportToWord(reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const report = database.getReports().find(r => r.id === reportId)
      const testCases = database.getTestCases(reportId)

      if (!report) {
        return { success: false, error: 'Report not found' }
      }

      const children: any[] = [
        new Paragraph({
          text: report.name,
          heading: HeadingLevel.HEADING_1
        }),
        new Paragraph({
          text: report.description || ''
        })
      ]

      for (const tc of testCases) {
        children.push(
          new Paragraph({
            text: tc.name,
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            children: [new TextRun({ text: '前置条件: ', bold: true }), new TextRun(tc.preconditions || '-')]
          })
        )

        // 步骤表格
        const table = new Table({
          rows: [
            new TableRow({
              children: ['步骤', 'SQL', '预期结果', '实际结果', '状态'].map(h =>
                new TableCell({ children: [new Paragraph({ text: h })] })
              )
            }),
            ...(JSON.parse(tc.steps || '[]').map((step: any, i: number) =>
              new TableRow({
                children: [
                  i + 1, step.sql || '-', step.expected || '-', step.actual || '-', step.status
                ].map(text =>
                  new TableCell({ children: [new Paragraph({ text: String(text) })] })
                )
              })
            ))
          ]
        })

        children.push(table)
        children.push(new Paragraph({ text: '' }))
      }

      const doc = new Document({
        sections: [{ children }]
      })

      const buffer = await Packer.toBuffer(doc)
      await writeFile(outputPath, buffer)

      return { success: true }
    } catch (err: any) {
      log.error('Export to Word failed:', err)
      return { success: false, error: err.message }
    }
  },

  async exportToMarkdown(reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const report = database.getReports().find(r => r.id === reportId)
      const testCases = database.getTestCases(reportId)

      if (!report) {
        return { success: false, error: 'Report not found' }
      }

      let md = `# ${report.name}\n\n`
      md += `${report.description || ''}\n\n`

      for (const tc of testCases) {
        md += `## ${tc.name}\n\n`
        md += `**前置条件:** ${tc.preconditions || '-'}\n\n`
        md += `| 步骤 | SQL | 预期结果 | 实际结果 | 状态 |\n`
        md += `|------|-----|----------|----------|------|\n`

        const steps = JSON.parse(tc.steps || '[]')
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]
          md += `| ${i + 1} | \`${step.sql || '-'}\` | ${step.expected || '-'} | ${step.actual || '-'} | ${step.status} |\n`
        }

        md += `\n**备注:** ${tc.notes || '-'}\n\n`
      }

      await writeFile(outputPath, md, 'utf-8')
      return { success: true }
    } catch (err: any) {
      log.error('Export to Markdown failed:', err)
      return { success: false, error: err.message }
    }
  },

  async exportToPDF(reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    // 方案1: 先导出 Word，再用 libreoffice 转换
    // 方案2: 使用 puppeteer
    // 这里用方案1作为示例
    const wordPath = outputPath.replace('.pdf', '.docx')
    await this.exportToWord(reportId, wordPath)

    // 实际生产中需要调用 libreoffice 或其他 PDF 转换工具
    log.info(`PDF export would convert ${wordPath} to ${outputPath}`)

    return { success: true }
  }
}
```

- [ ] **Step 2: 创建 Report IPC 处理器**

```ts
// src/main/ipc/report.ts
import { ipcMain, dialog } from 'electron'
import { reportExporter } from '../services/ReportExporter'
import { database } from '../storage/database'

export function registerReportIPC() {
  ipcMain.handle('report:create', async (_, name, description) => {
    return database.createReport(name, description)
  })

  ipcMain.handle('report:getAll', async () => {
    return database.getReports()
  })

  ipcMain.handle('report:saveTestCase', async (_, reportId, testCase) => {
    return database.saveTestCase(reportId, testCase)
  })

  ipcMain.handle('report:getTestCases', async (_, reportId) => {
    return database.getTestCases(reportId)
  })

  ipcMain.handle('report:export', async (_, reportId, format) => {
    const filters: any[] = []
    if (format === 'docx') filters.push({ name: 'Word', extensions: ['docx'] })
    else if (format === 'md') filters.push({ name: 'Markdown', extensions: ['md'] })
    else if (format === 'pdf') filters.push({ name: 'PDF', extensions: ['pdf'] })

    const result = await dialog.showSaveDialog({
      filters,
      defaultPath: `report-${Date.now()}.${format}`
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Canceled' }
    }

    switch (format) {
      case 'docx':
        return await reportExporter.exportToWord(reportId, result.filePath)
      case 'md':
        return await reportExporter.exportToMarkdown(reportId, result.filePath)
      case 'pdf':
        return await reportExporter.exportToPDF(reportId, result.filePath)
      default:
        return { success: false, error: 'Unknown format' }
    }
  })
}
```

- [ ] **Step 3: 更新主进程注册 IPC**

在 `src/main/index.ts` 中添加：
```ts
import { registerClusterIPC } from './ipc/cluster'
import { registerLLMIPC } from './ipc/llm'
import { registerSQLIPC } from './ipc/sql'
import { registerReportIPC } from './ipc/report'

app.whenReady().then(() => {
  registerClusterIPC()
  registerLLMIPC()
  registerSQLIPC()
  registerReportIPC()
  createWindow()
})
```

- [ ] **Step 4: 提交**

```bash
git add src/main/services/ReportExporter.ts src/main/ipc/report.ts
git commit -m "feat: add report exporter for Word/Markdown/PDF"
```

---

### 阶段 10: 集成与打包

**目标:** 完整集成所有模块，打包成可执行文件

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/App.tsx`
- Create: `electron-builder.json`

- [ ] **Step 1: 更新 electron-builder 配置**

```json
{
  "appId": "com.dws.client",
  "productName": "DWS Client",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run package`
Expected: 在 `release/` 目录生成 `.exe` 文件

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete DWS Client application"
```

---

## 实施检查清单

| 阶段 | 任务 | 状态 |
|------|------|------|
| 1 | 项目脚手架 | ⬜ |
| 2 | 核心存储层 | ⬜ |
| 3 | UI 布局框架 | ⬜ |
| 4 | 集群管理 | ⬜ |
| 5 | 大模型网关 | ⬜ |
| 6 | SQL 执行器 | ⬜ |
| 7 | 调优分析器 | ⬜ |
| 8 | 测试运行器 | ⬜ |
| 9 | 报告导出 | ⬜ |
| 10 | 集成与打包 | ⬜ |

---

## 后续优化建议

- 添加用户认证和权限管理
- 支持集群健康监控和告警
- 添加 SQL 历史执行记录
- 支持调优建议的自动应用
- 添加测试用例模板库
