/**
 * 官网语言、路由与文案插值的统一入口，供 Astro 页面及浏览器交互脚本共用。
 */
import messages from './messages.json';
export const locales = [
  { code: 'zh-CN', label: '简体中文', slug: '' },
  { code: 'zh-TW', label: '繁體中文', slug: 'zh-TW' },
  { code: 'en', label: 'English', slug: 'en' },
  { code: 'ja', label: '日本語', slug: 'ja' },
  { code: 'ko', label: '한국어', slug: 'ko' },
] as const;
export type Locale = (typeof locales)[number]['code'];
export function localePath(locale: Locale) {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const slug = locales.find((item) => item.code === locale)?.slug;
  return `${base}${slug ? `${slug}/` : ''}`;
}
export function translator(locale: Locale) {
  const index = ['en', 'zh-TW', 'ja', 'ko'].indexOf(locale);
  return (key: string) =>
    locale === 'zh-CN' ? key : ((messages as Record<string, string[]>)[key]?.[index] ?? key);
}
