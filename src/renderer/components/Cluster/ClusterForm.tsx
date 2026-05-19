import React, { useState } from 'react';

interface Cluster {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
}

interface ClusterFormProps {
  cluster: Cluster | null;
  onSave: (cluster: Omit<Cluster, 'id'>) => void;
  onCancel: () => void;
}

function ClusterForm({ cluster, onSave, onCancel }: ClusterFormProps): React.ReactElement {
  const [formData, setFormData] = useState({
    name: cluster?.name || '',
    host: cluster?.host || 'localhost',
    port: cluster?.port || 5432,
    database: cluster?.database || '',
    username: cluster?.username || '',
    password: ''
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.database || !formData.username) {
      alert('请填写所有必填字段');
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{cluster ? '编辑集群' : '添加集群'}</h3>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">集群名称 *</label>
            <input
              type="text"
              id="name"
              name="name"
              className="input"
              value={formData.name}
              onChange={handleChange}
              placeholder="例如: 生产环境集群"
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="host">主机地址 *</label>
              <input
                type="text"
                id="host"
                name="host"
                className="input"
                value={formData.host}
                onChange={handleChange}
                placeholder="localhost"
                required
              />
            </div>
            <div className="form-group form-group-small">
              <label htmlFor="port">端口 *</label>
              <input
                type="number"
                id="port"
                name="port"
                className="input"
                value={formData.port}
                onChange={handleChange}
                placeholder="5432"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="database">数据库名 *</label>
            <input
              type="text"
              id="database"
              name="database"
              className="input"
              value={formData.database}
              onChange={handleChange}
              placeholder="postgres"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="username">用户名 *</label>
            <input
              type="text"
              id="username"
              name="username"
              className="input"
              value={formData.username}
              onChange={handleChange}
              placeholder="postgres"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">密码 {cluster ? '(不修改请留空)' : '*'}</label>
            <input
              type="password"
              id="password"
              name="password"
              className="input"
              value={formData.password}
              onChange={handleChange}
              placeholder={cluster ? '••••••••' : ''}
              required={!cluster}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background-color: var(--color-surface);
          border-radius: 4px;
          width: 480px;
          max-width: 90vw;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
        }
        .modal-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text);
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--color-text-secondary);
          padding: 0;
          line-height: 1;
        }
        .modal-close:hover {
          color: var(--color-text);
        }
        form {
          padding: 20px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          margin-bottom: 6px;
        }
        .form-group .input {
          width: 100%;
        }
        .form-row {
          display: flex;
          gap: 16px;
        }
        .form-row .form-group {
          flex: 1;
        }
        .form-row .form-group-small {
          flex: 0 0 120px;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
        }
      `}</style>
    </div>
  );
}

export default ClusterForm;
