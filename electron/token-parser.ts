/**
 * 兼容不同版本 rollout 事件的逐行解析器。
 * 累计计数用于计算本轮增量，消息正文仅保留在内存中，不执行或另存。
 */
import type { TokenCounts, TokenTurn, TurnMessage, UsageSample } from './types.js';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const fields = {
  input: 'input_tokens',
  cachedInput: 'cached_input_tokens',
  output: 'output_tokens',
  reasoning: 'reasoning_output_tokens',
  total: 'total_tokens',
} as const;
function counts(value: unknown): TokenCounts | null {
  const source = record(value);
  const result = Object.fromEntries(
    Object.entries(fields).map(([key, name]) => [
      key,
      typeof source[name] === 'number' && Number.isSafeInteger(source[name]) && source[name] >= 0
        ? source[name]
        : null,
    ]),
  ) as unknown as TokenCounts;
  return result.total === null || result.input === null || result.output === null ? null : result;
}
function subtract(current: TokenCounts, previous: TokenCounts): TokenCounts {
  return Object.fromEntries(
    (Object.keys(fields) as (keyof TokenCounts)[]).map((key) => [
      key,
      current[key] === null || previous[key] === null ? null : current[key]! - previous[key]!,
    ]),
  ) as unknown as TokenCounts;
}
// User/assistant text is kept in memory for display, never executed or written to disk.
export class TokenParser {
  constructor(
    private includeMessages = true,
    private onUsage?: (sample: UsageSample) => void,
  ) {}
  readonly turns: TokenTurn[] = [];
  readonly warnings = new Set<string>();
  private byId = new Map<string, TokenTurn>();
  private current?: TokenTurn;
  private previous: TokenCounts | null = null;
  private synthetic = 0;
  private messageSources = new WeakMap<TokenTurn, Set<string>>();
  private messageIds = new Set<string>();
  private textBudget = 2_000_000;
  private start(id: string, timestamp: unknown) {
    let turn = this.byId.get(id);
    if (!turn) {
      turn = {
        id,
        number: this.turns.length + 1,
        startedAt:
          typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))
            ? timestamp
            : null,
        model: null,
        status: 'running',
        tokens: null,
        complete: true,
        messages: [],
      };
      this.byId.set(id, turn);
      this.turns.push(turn);
    }
    this.current = turn;
    return turn;
  }
  // 正规 response_item 优先于兼容事件，避免同一段正文在两种日志格式中重复出现。
  private message(
    turn: TokenTurn,
    role: TurnMessage['role'],
    text: string,
    phase: TurnMessage['phase'],
    canonical: boolean,
    id?: string,
  ) {
    if (!text.trim()) return;
    const sources = this.messageSources.get(turn) ?? new Set<string>();
    this.messageSources.set(turn, sources);
    if (!canonical && sources.has(role)) return;
    if (canonical && !sources.has(role)) {
      turn.messages = turn.messages.filter((message) => message.role !== role);
      sources.add(role);
    }
    const key = id ? `${turn.id}:${role}:${id}` : null;
    if (key && this.messageIds.has(key)) return;
    if (key) this.messageIds.add(key);
    if (turn.messages.length >= 100 || this.textBudget <= 0) {
      this.warnings.add('消息内容较多，部分正文未加载；Token 统计不受影响');
      return;
    }
    const max = Math.min(32_000, this.textBudget);
    const clipped = text.slice(0, max);
    this.textBudget -= clipped.length;
    turn.messages.push({ role, text: clipped, phase, truncated: text.length > max });
  }
  push(line: string) {
    if (!this.includeMessages && /"type"\s*:\s*"response_item"/.test(line.slice(0, 200))) return;
    if (
      !/"(?:token_count|turn_context|task_started|task_complete|turn_aborted|user_message|agent_message|response_item)"/.test(
        line,
      )
    )
      return;
    let entry: RecordValue;
    try {
      entry = record(JSON.parse(line));
    } catch {
      this.warnings.add('发现未完整写入或损坏的记录，部分统计可能缺失');
      if (this.current) this.current.complete = false;
      return;
    }
    const payload = record(entry.payload);
    if (
      entry.type === 'response_item' &&
      payload.type === 'message' &&
      (payload.role === 'user' || payload.role === 'assistant')
    ) {
      const metadata = record(payload.internal_chat_message_metadata_passthrough);
      const kinds = Array.isArray(metadata.content_item_kinds) ? metadata.content_item_kinds : null;
      const parts = Array.isArray(payload.content) ? payload.content : [];
      const text = parts
        .flatMap((part, index) => {
          const content = record(part);
          if (
            payload.role === 'user' &&
            kinds &&
            (typeof kinds[index] !== 'string' || !kinds[index].startsWith('user.'))
          )
            return [];
          if (
            (content.type === 'input_text' ||
              content.type === 'output_text' ||
              content.type === 'text') &&
            typeof content.text === 'string'
          ) {
            if (
              payload.role === 'user' &&
              !kinds &&
              /^(?:# AGENTS\.md instructions|<environment_context>|<external_codex_apps_open_page>)/.test(
                content.text.trim(),
              )
            )
              return [];
            return [content.text];
          }
          return content.type === 'input_image' ||
            content.type === 'image' ||
            content.type === 'local_image'
            ? ['[图片附件]']
            : [];
        })
        .join('\n\n');
      if (!text.trim()) return;
      const turnId =
        typeof metadata.turn_id === 'string'
          ? metadata.turn_id
          : typeof payload.turn_id === 'string'
            ? payload.turn_id
            : null;
      let turn = turnId ? this.byId.get(turnId) : this.current;
      if (!turn && payload.role === 'user') {
        if (turnId && this.current?.id.startsWith('legacy-')) {
          this.byId.delete(this.current.id);
          this.current.id = turnId;
          this.byId.set(turnId, this.current);
          turn = this.current;
        } else turn = this.start(turnId ?? `legacy-${++this.synthetic}`, entry.timestamp);
      }
      if (turn)
        this.message(
          turn,
          payload.role,
          text,
          payload.phase === 'commentary'
            ? 'commentary'
            : payload.phase === 'final_answer' || payload.phase === 'final'
              ? 'final'
              : null,
          true,
          typeof payload.id === 'string' ? payload.id : undefined,
        );
      return;
    }
    if (entry.type === 'turn_context') {
      if (
        typeof payload.turn_id === 'string' &&
        !this.byId.has(payload.turn_id) &&
        this.current?.id.startsWith('legacy-') &&
        this.current.status === 'running'
      ) {
        this.byId.delete(this.current.id);
        this.current.id = payload.turn_id;
        this.byId.set(payload.turn_id, this.current);
      }
      const turn =
        typeof payload.turn_id === 'string'
          ? this.start(payload.turn_id, entry.timestamp)
          : this.current;
      if (turn && typeof payload.model === 'string') turn.model = payload.model;
      return;
    }
    if (entry.type !== 'event_msg') return;
    if (payload.type === 'task_started') {
      if (
        typeof payload.turn_id === 'string' &&
        !this.byId.has(payload.turn_id) &&
        this.current?.id.startsWith('legacy-') &&
        this.current.status === 'running' &&
        !this.current.tokens
      ) {
        this.byId.delete(this.current.id);
        this.current.id = payload.turn_id;
        this.byId.set(payload.turn_id, this.current);
      }
      this.start(
        typeof payload.turn_id === 'string' ? payload.turn_id : `legacy-${++this.synthetic}`,
        entry.timestamp,
      ).status = 'running';
      return;
    }
    if (payload.type === 'user_message') {
      const turn =
        typeof payload.turn_id === 'string'
          ? (this.byId.get(payload.turn_id) ?? this.start(payload.turn_id, entry.timestamp))
          : this.current?.status === 'running'
            ? this.current
            : this.start(`legacy-${++this.synthetic}`, entry.timestamp);
      if (this.includeMessages && typeof payload.message === 'string')
        this.message(turn, 'user', payload.message, null, false);
      return;
    }
    if (payload.type === 'agent_message') {
      const turn =
        typeof payload.turn_id === 'string' ? this.byId.get(payload.turn_id) : this.current;
      if (this.includeMessages && turn && typeof payload.message === 'string')
        this.message(
          turn,
          'assistant',
          payload.message,
          payload.phase === 'commentary' ? 'commentary' : null,
          false,
        );
      return;
    }
    if (payload.type === 'task_complete' || payload.type === 'turn_aborted') {
      const turn =
        typeof payload.turn_id === 'string' ? this.byId.get(payload.turn_id) : this.current;
      if (turn) {
        turn.status = payload.type === 'task_complete' ? 'completed' : 'interrupted';
        if (
          this.includeMessages &&
          typeof payload.last_agent_message === 'string' &&
          !turn.messages.some((message) => message.role === 'assistant')
        )
          this.message(turn, 'assistant', payload.last_agent_message, 'final', false);
      }
      if (this.current === turn) this.current = undefined;
      return;
    }
    if (payload.type !== 'token_count') return;
    const info = record(payload.info);
    // 累计计数可能包含继承上下文；本轮只取与上一份的差值，或明确提供的 last 用量。
    const total = counts(info.total_token_usage);
    if (!total) return; // Rate-limit-only events have no token information.
    const turn =
      typeof payload.turn_id === 'string' ? this.byId.get(payload.turn_id) : this.current;
    const last = counts(info.last_token_usage);
    const previous = this.previous;
    const delta = previous
      ? subtract(total, previous)
      : last &&
          Object.keys(fields).every((key) => {
            const field = key as keyof TokenCounts;
            return last[field] === null || total[field] === null || last[field]! <= total[field]!;
          })
        ? last
        : null;
    this.previous = total;
    if (!turn) {
      this.warnings.add('部分用量没有轮次标识，未分配给任何轮次');
      return;
    }
    if (
      !delta ||
      delta.total === null ||
      delta.input === null ||
      delta.output === null ||
      Object.values(delta).some((value) => value !== null && value < 0)
    ) {
      turn.complete = false;
      this.warnings.add('部分累计计数缺失或发生重置，对应轮次仅展示已确认统计');
      return;
    }
    if (previous && !delta.total && !delta.input && !delta.output) return; // Repeated events must not count twice.
    const timestamp =
      typeof entry.timestamp === 'string' && Number.isFinite(Date.parse(entry.timestamp))
        ? entry.timestamp
        : null;
    this.onUsage?.({
      key: JSON.stringify([turn.id, timestamp, total]),
      turnId: turn.id,
      timestamp,
      tokens: { ...delta },
      complete: turn.complete,
      dedupable: timestamp !== null && !turn.id.startsWith('legacy-'),
    });
    if (!turn.tokens) turn.tokens = delta;
    else
      for (const key of Object.keys(fields) as (keyof TokenCounts)[])
        turn.tokens[key] =
          turn.tokens[key] === null || delta[key] === null ? null : turn.tokens[key]! + delta[key]!;
  }
  finish() {
    for (const turn of this.turns) if (turn.status === 'running') turn.status = 'unknown';
    return { turns: this.turns, warnings: [...this.warnings] };
  }
}
