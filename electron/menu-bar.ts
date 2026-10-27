/**
 * 根据用户选择生成菜单栏内容；额度未知时不推断剩余值。
 */
import { remaining, type State } from './types.js';

export const menuBarOptions = [
  { value: 'remaining', label: '主要窗口剩余百分比' },
  { value: 'used', label: '主要窗口已用百分比' },
  { value: 'both', label: '主要 / 次要窗口剩余百分比' },
  { value: 'tokens', label: '本轮 Token' },
  { value: 'icon', label: '仅图标' },
] as const;

export function menuBarTitle(state: State): string {
  const bucket = state.buckets.find((b) => b.limitId === 'codex') ?? state.buckets[0];
  const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value)}%`);
  const primary = remaining(bucket?.primary);
  switch (state.settings.menuBarDisplay) {
    case 'icon':
      return '';
    case 'used':
      return percent(primary === null ? null : 100 - primary);
    case 'both':
      return `${percent(primary)} / ${percent(remaining(bucket?.secondary))}`;
    case 'tokens': {
      const total = state.live?.tokens?.total;
      return typeof total === 'number' && Number.isFinite(total)
        ? `${Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(total)} tok`
        : '— tok';
    }
    default:
      return percent(primary);
  }
}
