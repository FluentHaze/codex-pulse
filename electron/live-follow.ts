/** 自动跟随保留当前轮次，仅在其他会话确认进入进行中后接续。 */
import type { LiveTokens, LocalSession } from './types.js';

export class LiveSessionFollower {
  private current: string | null = null;
  private observed = new Map<string, { modified: number; live: LiveTokens }>();
  private pending = new Map<string, string | null>();

  async read(sessions: LocalSession[], read: (id: string) => Promise<LiveTokens>) {
    const ids = new Set(sessions.map((session) => session.id));
    for (const id of this.observed.keys()) {
      if (!ids.has(id)) {
        this.observed.delete(id);
        this.pending.delete(id);
      }
    }
    if (!this.current || !ids.has(this.current)) this.current = sessions[0]?.id ?? null;
    if (!this.current) return null;
    // 当前会话每次都增量读取，不依赖目录扫描或列表顺序。
    let current = await read(this.current);
    for (const session of sessions) {
      const previous = this.observed.get(session.id);
      if (session.id === this.current) {
        this.observed.set(session.id, { modified: session.updatedAt, live: current });
        continue;
      }
      // 旧记录不会因索引排序变化成为候选；近期有写入的记录才需读取状态。
      if (Date.now() - session.updatedAt > 120_000) continue;
      if (previous?.modified === session.updatedAt && previous.live.status !== 'waiting') continue;
      let live: LiveTokens;
      try {
        live = await read(session.id);
      } catch {
        continue;
      }
      this.observed.set(session.id, { modified: session.updatedAt, live });
      if (live.status !== 'collecting') this.pending.delete(session.id);
      else if (
        (previous && previous.live.turnId !== live.turnId) ||
        (!previous && live.turnStartedAt && Date.now() - Date.parse(live.turnStartedAt) <= 120_000)
      )
        this.pending.set(session.id, live.turnId);
    }
    // 当前轮次仍在运行时优先持续读取，候选会话等当前轮次结束后再确认。
    if (current.status === 'collecting' || current.status === 'waiting') return current;
    for (const session of sessions) {
      if (session.id === this.current || !this.pending.has(session.id)) continue;
      const candidate = await read(session.id);
      if (candidate.status !== 'collecting' || candidate.turnId !== this.pending.get(session.id)) {
        this.pending.delete(session.id);
        continue;
      }
      this.pending.delete(session.id);
      this.current = session.id;
      current = candidate;
      break;
    }
    return current;
  }
}
