import { useState, useEffect } from 'react';
import { checkBackendConnection } from '../services/api';

// 🆕 연결 상태 표시 컴포넌트에서 사용할 훅
export const useBackendStatus = () => {
  const [status, setStatus] = useState({ connected: false, checking: true });

  useEffect(() => {
    const checkStatus = async () => {
      setStatus(prev => ({ ...prev, checking: true }));
      const result = await checkBackendConnection();
      setStatus({ connected: result.connected, checking: false, lastCheck: new Date() });
    };

    checkStatus();

    // 30초마다 상태 체크
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  return status;
};