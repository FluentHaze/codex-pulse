/**
 * 跨进程共享的数据契约与纯计算函数；Token 字段的 null 表示未知，不等同于 0。
 */
import type { Language, LanguagePreference } from './i18n.js';
export interface QuotaWindow {
  usedPercent: number | null;
  windowDurationMins: number | null;
  resetsAt: number | null;
}
export interface Bucket {
  limitId: string;
  limitName?: string | null;
  primary?: QuotaWindow | null;
  secondary?: QuotaWindow | null;
}
export interface Limits {
  rateLimits?: Bucket | null;
  rateLimitsByLimitId?: Record<string, Bucket> | null;
}
export interface Account {
  type: string;
  email?: string;
  planType?: string;
  id?: string;
}
export type MenuBarDisplay = 'remaining' | 'used' | 'both' | 'tokens' | 'icon';
export interface Settings {
  language: LanguagePreference;
  menuBarDisplay: MenuBarDisplay;
  menuBarHover: boolean;
  interval: number;
  startup: boolean;
  showOnLaunch: boolean;
  alwaysOnTop: boolean;
  locked: boolean;
  clickThrough: boolean;
  opacity: number;
  lowAlerts: boolean;
  recoveryAlerts: boolean;
  theme: 'system' | 'dark' | 'light';
  quotaDisplay: 'remaining' | 'used';
  codexPath: string;
  sessionPath: string;
  watchedSessionId: string;
}
export interface State {
  locale?: Language;
  settings: Settings;
  account: string | null;
  plan: string | null;
  buckets: Bucket[];
  updatedAt: number | null;
  refreshing: boolean;
  status: string;
  error: string | null;
  executable: string | null;
  live: LiveTokens | null;
}
export const defaults: Settings = {
  language: 'system',
  menuBarDisplay: 'remaining',
  menuBarHover: true,
  interval: 5,
  startup: false,
  showOnLaunch: true,
  alwaysOnTop: true,
  locked: false,
  clickThrough: false,
  opacity: 1,
  lowAlerts: true,
  recoveryAlerts: true,
  theme: 'dark',
  quotaDisplay: 'remaining',
  codexPath: '',
  sessionPath: '',
  watchedSessionId: '',
};
export interface TokenCounts {
  input: number | null;
  cachedInput: number | null;
  output: number | null;
  reasoning: number | null;
  total: number | null;
}
export interface TurnMessage {
  role: 'user' | 'assistant';
  text: string;
  phase: 'commentary' | 'final' | null;
  truncated: boolean;
}
export interface TokenTurn {
  id: string;
  number: number;
  startedAt: string | null;
  model: string | null;
  status: 'running' | 'completed' | 'interrupted' | 'unknown';
  tokens: TokenCounts | null;
  complete: boolean;
  messages: TurnMessage[];
}
export interface LocalSession {
  id: string;
  title: string;
  updatedAt: number;
  project?: string;
  projectName?: string;
  cwd?: string;
}
export interface UsageSample {
  key: string;
  turnId: string;
  timestamp: string | null;
  tokens: TokenCounts;
  complete: boolean;
  dedupable: boolean;
}
export interface HourlyUsage {
  hour: number;
  total: number | null;
  records: number;
}
export interface DailyStats {
  date: string;
  timeZone: string;
  tokens: TokenCounts;
  hourly?: HourlyUsage[];
  turnCount: number;
  recordCount: number;
  duplicateRecords: number;
  scannedFiles: number;
  skippedFiles: number;
  warnings: string[];
  updatedAt: number;
}
export interface TokenCatalog {
  root: string;
  sessions: LocalSession[];
  limited: boolean;
  projects?: { id: string; name: string }[];
}
export interface TokenSession {
  id: string;
  turns: TokenTurn[];
  warnings: string[];
  updatedAt: number;
}
export interface LiveTokens {
  titleKey?: string;
  sessionId: string | null;
  title: string;
  turnId: string | null;
  turnNumber: number | null;
  tokens: TokenCounts | null;
  status: 'waiting' | 'collecting' | 'completed' | 'interrupted' | 'unknown' | 'error';
  complete: boolean;
  updatedAt: number;
  error: string | null;
}
export function quotaWindows(bucket?: Bucket | null): QuotaWindow[] {
  return [bucket?.primary, bucket?.secondary].filter(
    (window): window is QuotaWindow => window != null,
  );
}
export function floatingSize(count: number) {
  return { width: 68, height: 68 + Math.max(1, count) * 72 };
}
export function remaining(window?: QuotaWindow | null) {
  return typeof window?.usedPercent === 'number' && Number.isFinite(window.usedPercent)
    ? Math.max(0, Math.min(100, 100 - window.usedPercent))
    : null;
}
export function bucketsFrom(value: Limits): Bucket[] {
  const buckets = Object.values(value.rateLimitsByLimitId ?? {});
  return buckets.length ? buckets : value.rateLimits ? [value.rateLimits] : [];
}
export function severity(value: number) {
  return value <= 0 ? 0 : value <= 10 ? 10 : value <= 20 ? 20 : null;
}

export interface UpdateState {
  currentVersion: string;
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'latest'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'manual';
  version?: string;
  percent?: number;
  error?: string;
  installMode?: 'dmg' | 'restart';
}
