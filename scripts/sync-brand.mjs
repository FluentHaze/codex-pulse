/** Keep website icons byte-identical to the application's generated platform assets. */
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function syncBrand() {
  const destination = join(project, 'website/public/assets');
  await mkdir(destination, { recursive: true });
  for (const name of ['mark.svg', 'app.svg', 'app.png', 'app.ico']) {
    await copyFile(join(project, 'assets', name), join(destination, name));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncBrand();
  console.log('Website brand assets synchronized with macOS and Windows icons');
}
