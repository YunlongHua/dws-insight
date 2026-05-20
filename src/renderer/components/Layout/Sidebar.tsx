import React from 'react';

export type ViewType = 'clusters' | 'llm' | 'tuning' | 'report' | 'history';

interface NavItem {
  id: ViewType;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'clusters', label: '集群管理', icon: '☰' },
  { id: 'llm', label: '大模型配置', icon: '🤖' },
  { id: 'tuning', label: 'DWS 调优', icon: '⚙' },
  { id: 'report', label: '测试报告', icon: '📊' },
  { id: 'history', label: '历史记录', icon: '📋' },
];

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
}

function Sidebar({ activeView, onNavigate }: SidebarProps): React.ReactElement {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">DWS Insight</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onNavigate(item.id);
              }
            }}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span className="nav-item-label">{item.label}</span>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
