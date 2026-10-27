/**
 * 会话列表的纯筛选逻辑，统一处理标题、项目和本地时间范围。
 */
import type { LocalSession } from '../electron/types';
export type DateFilter = 'all' | 'today' | '7d' | '30d';
export function filterSessions(
  sessions: LocalSession[],
  query: string,
  project: string,
  period: DateFilter,
  now = new Date(),
) {
  const keyword = query.trim().toLocaleLowerCase();
  const days = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return sessions.filter(
    (session) =>
      (!keyword ||
        `${session.title}\n${session.projectName ?? ''}\n${session.cwd ?? session.project ?? ''}`
          .toLocaleLowerCase()
          .includes(keyword)) &&
      (project === '*' || (session.project ?? '') === project) &&
      (period === 'all' || (session.updatedAt >= start && session.updatedAt < end)),
  );
}
