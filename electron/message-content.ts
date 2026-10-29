/** Extract only explicit local image references; never render conversation text as HTML. */
export function messageContent(text: string, user = false) {
  const images = new Set<string>();
  const add = (path: string) => {
    if (/^(?:\/|[a-z]:[\\/])/i.test(path) && /\.(?:png|jpe?g|gif|webp|bmp)$/i.test(path))
      images.add(path);
  };
  for (const match of text.matchAll(/<image\b[^>]*\bpath=["']([^"']+)["'][^>]*>/g)) add(match[1]);
  for (const match of text.matchAll(/!\[[^\]]*\]\((?:<([^>]+)>|([^\n)]+))\)/g))
    add(match[1] ?? match[2]);
  const wrapper = text.split(/(?:^|\n)## My request:\s*\n/);
  if (user && wrapper.length > 1 && /Image attachment: true/.test(wrapper[0])) {
    for (const match of wrapper[0].matchAll(/^## .+?: (.+)$/gm)) add(match[1].trim());
  }
  let body = user && wrapper.length > 1 ? wrapper.slice(1).join('\n') : text;
  body = body
    .replace(/<image\b[^>]*>[\s\S]*?<\/image>/g, '')
    .replace(/!\[[^\]]*\]\((?:<[^>]+>|[^\n)]+)\)/g, (value) => {
      return [...images].some((path) => value.includes(path)) ? '' : value;
    });
  if (images.size) body = body.replace(/\[图片附件\]/g, '');
  return { text: body.trim(), images: [...images].slice(0, 12) };
}
