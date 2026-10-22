import { useEffect, useState } from 'react';
import type { DailyStats } from '../electron/types';

export function useTodayUsage(sessionPath: string) {
  const [stats, setStats] = useState<DailyStats>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => { setStats(undefined); setError(''); }, [sessionPath]);
  useEffect(() => {
    let current = true, running = false;
    const read = async (force = false) => {
      if (running) return;
      running = true; setBusy(true);
      try { const result = await window.pulse!.todayUsage(force); if (current) { setStats(result); setError(''); } }
      catch { if (current) setError('今日统计读取失败，请检查会话目录后刷新'); }
      finally { running = false; if (current) setBusy(false); }
    };
    void read(true);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 30000);
    return () => { current = false; clearInterval(timer); };
  }, [sessionPath, reload]);
  return { stats, busy, error, refresh: () => setReload(value => value + 1) };
}
