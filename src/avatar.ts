/** 默认头像在本机生成，不向外部服务发送邮箱。 */
export function avatarDataUrl(account: string): string {
  const first = [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(account.trim()),
  ][0];
  const letter = (first?.segment ?? '?')
    .toLocaleUpperCase()
    .replace(
      /[&<>"']/g,
      (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[value]!,
    );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="blue" x2="0" y2="1"><stop stop-color="#55aaf5"/><stop offset="1" stop-color="#2478d4"/></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#blue)"/><text x="64" y="65" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Segoe UI,Arial,sans-serif" font-size="64" font-weight="600">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
