import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getAppPath: () => Promise<string>;
      platform: string;
    };
  }
}

function App(): React.ReactElement {
  const [appVersion, setAppVersion] = useState<string>('');
  const [appPath, setAppPath] = useState<string>('');

  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const version = await window.electronAPI.getAppVersion();
        const path = await window.electronAPI.getAppPath();
        setAppVersion(version);
        setAppPath(path);
      } catch (error) {
        console.error('Failed to load app info:', error);
      }
    };

    loadAppInfo();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>DWS Client</h1>
      <p>Welcome to the Data Warehouse Service Client</p>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <p><strong>Version:</strong> {appVersion || 'Loading...'}</p>
        <p><strong>Platform:</strong> {window.electronAPI.platform}</p>
        <p><strong>App Path:</strong> {appPath || 'Loading...'}</p>
      </div>
    </div>
  );
}

export default App;
