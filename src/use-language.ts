/**
 * 把共享语言订阅接入 React，使 memo 组件也能在切换语言时重新渲染。
 */
import { useSyncExternalStore } from 'react';
import { subscribeLanguage, getLanguage } from '../electron/i18n';
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}
