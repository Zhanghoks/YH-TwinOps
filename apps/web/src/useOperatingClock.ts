import { useEffect, useState } from 'react';

/** Wall clock only. All simulated quantities are derived deterministically from this minute. */
export function useOperatingClock(): Date {
  const minute = () => new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const [now, setNow] = useState(minute);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      const next = minute();
      setNow(previous => previous.getTime() === next.getTime() ? previous : next);
      timer = setTimeout(sync, 60_000 - Date.now() % 60_000);
    };
    const visible = () => { if (document.visibilityState === 'visible') sync(); };
    sync();
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return now;
}
