import { useEffect, useRef } from 'react';

export function useAppResume(refresh: () => void | Promise<unknown>) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let lastRefreshAt = 0;

    const refreshOnResume = () => {
      if (document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (now - lastRefreshAt < 1000) return;
      lastRefreshAt = now;

      try {
        void Promise.resolve(refreshRef.current()).catch(error => {
          console.error('Failed to refresh app data after resuming:', error);
        });
      } catch (error) {
        console.error('Failed to refresh app data after resuming:', error);
      }
    };

    window.addEventListener('focus', refreshOnResume);
    window.addEventListener('pageshow', refreshOnResume);
    window.addEventListener('online', refreshOnResume);
    document.addEventListener('visibilitychange', refreshOnResume);

    return () => {
      window.removeEventListener('focus', refreshOnResume);
      window.removeEventListener('pageshow', refreshOnResume);
      window.removeEventListener('online', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnResume);
    };
  }, []);
}
