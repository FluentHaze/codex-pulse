import { messages } from './locales/messages.js';
export const languages = [{ value: 'zh-CN', label: '简体中文' }, { value: 'zh-TW', label: '繁體中文' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }, { value: 'ko', label: '한국어' }] as const;
export type Language = typeof languages[number]['value'];
export type LanguagePreference = Language | 'system';
export function resolveLanguage(preference: string | undefined, system = 'en'): Language {
  if (languages.some(item => item.value === preference)) return preference as Language;
  const value = system.toLowerCase();
  if (/^zh(?:-|$)/.test(value)) return /hant|tw|hk|mo/.test(value) ? 'zh-TW' : 'zh-CN';
  return value.startsWith('ja') ? 'ja' : value.startsWith('ko') ? 'ko' : 'en';
}
let language: Language = 'zh-CN';
const listeners = new Set<() => void>();
export function getLanguage() { return language; }
export function setLanguage(value: Language) { if (value === language) return; language = value; listeners.forEach(listener => listener()); }
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(messages).filter(key => /\{\d+\}/.test(key)).map(key => ({ key, regex: new RegExp('^' + key.split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part) ? '([\\s\\S]*?)' : escape(part)).join('') + '$'), slots: [...key.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1])) }));
export function t(key: string, values: readonly unknown[] = []): string {
  let canonical = key, parameters = values;
  if (!(key in messages) && /[\u3400-\u9fff]/u.test(key)) {
    for (const pattern of patterns) { const match = pattern.regex.exec(key); if (match) { canonical = pattern.key; const captured: string[] = []; pattern.slots.forEach((slot, index) => { captured[slot] = match[index + 1]; }); parameters = captured; break; } }
  }
  const index = ['en', 'zh-TW', 'ja', 'ko'].indexOf(language);
  const text = language === 'zh-CN' ? canonical : messages[canonical]?.[index] ?? canonical;
  // Substitute only once: user text containing braces is never interpreted as a message.
  return text.replace(/\{(\d+)\}/g, (placeholder, index) => parameters[Number(index)] == null ? placeholder : String(parameters[Number(index)]));
}
