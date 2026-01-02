import { useEffect, useState } from 'react';
import { getWebSocketUrl } from '@/lib/ip-config';

export function useWebSocket(port: number = 6790) {
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    getWebSocketUrl(port).then(url => {
      setWsUrl(url);
    });
  }, [port]);

  return wsUrl;
}



