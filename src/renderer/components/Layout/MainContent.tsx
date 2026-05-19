import React from 'react';
import { ViewType } from './Sidebar';
import ClusterPanel from '../Cluster/ClusterPanel';

interface MainContentProps {
  activeView: ViewType;
}

function MainContent({ activeView }: MainContentProps): React.ReactElement {
  const renderContent = () => {
    switch (activeView) {
      case 'clusters':
        return <ClusterPanel />;
      case 'llm':
        return (
          <div className="card">
            <h2>大模型配置</h2>
            <p>配置大语言模型参数和API</p>
          </div>
        );
      case 'tuning':
        return (
          <div className="card">
            <h2>DWS 调优</h2>
            <p>调整数据库参数和性能优化</p>
          </div>
        );
      case 'report':
        return (
          <div className="card">
            <h2>测试报告</h2>
            <p>查看和导出测试结果报告</p>
          </div>
        );
      case 'history':
        return (
          <div className="card">
            <h2>历史记录</h2>
            <p>查看操作历史和日志</p>
          </div>
        );
      default:
        return (
          <div className="card">
            <p>请选择一个菜单项</p>
          </div>
        );
    }
  };

  return <main className="main-content">{renderContent()}</main>;
}

export default MainContent;
