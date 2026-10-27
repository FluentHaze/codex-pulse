/**
 * 根据支持的语言和站点基址生成 sitemap，避免手工维护多语言页面地址。
 */
import type { APIRoute } from 'astro';
import { locales, localePath } from '../i18n';
export const prerender = true;
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
export const GET: APIRoute = ({ site }) => {
  const pages = locales.map((locale) => ({
    ...locale,
    url: new URL(localePath(locale.code), site).href,
  }));
  const alternates =
    pages
      .map(
        (page) =>
          `<xhtml:link rel="alternate" hreflang="${page.code}" href="${escape(page.url)}"/>`,
      )
      .join('') +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${escape(pages.find((page) => page.code === 'en')!.url)}"/>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${pages.map((page) => `<url><loc>${escape(page.url)}</loc>${alternates}</url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
