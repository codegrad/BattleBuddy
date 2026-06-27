import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { ApiConfig } from '../config';

export type ApiStatus = 'ok' | 'unreachable' | 'credits' | 'error';

export function useApiHealth() {
  const [status, setStatus] = useState<ApiStatus>('ok');
  const [message, setMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${ApiConfig.CHAT_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setStatus('ok');
        setMessage(null);
      } else {
        setStatus('error');
        setMessage('BB is having trouble connecting');
      }
    } catch {
      setStatus('unreachable');
      setMessage('BB is having trouble connecting');
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 60000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [check]);

  return { status, message, recheckNow: check };
}
