// Render every platform asset from the same SVG mark, using the bundled Electron.
const { app, BrowserWindow } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const assets = join(__dirname, '../assets');
const sizes = [16, 24, 32, 48, 64, 128, 256];

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index] % 256;
    header[entry + 1] = sizes[index] % 256;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  return Buffer.concat([header, ...images]);
}

app
  .whenReady()
  .then(async () => {
    const mark = await readFile(join(assets, 'mark.svg'), 'utf8');
    const glyph = mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 128 128" fill="none">
  <defs>
    <linearGradient id="tile" x1="64" y1="6" x2="64" y2="122" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset="1" stop-color="#e5e9ef"/></linearGradient>
    <linearGradient id="blue" x1="40" y1="30" x2="90" y2="100" gradientUnits="userSpaceOnUse"><stop stop-color="#32a5ff"/><stop offset="1" stop-color="#0055d4"/></linearGradient>
  </defs>
  <rect x="6" y="8" width="116" height="116" rx="27" fill="#101e38" opacity=".12"/>
  <rect x="6" y="6" width="116" height="116" rx="27" fill="url(#tile)"/>
  <rect x="6.75" y="6.75" width="114.5" height="114.5" rx="26.25" stroke="#fff" stroke-width="1.5"/>
  <g stroke="url(#blue)">${glyph.replaceAll('stroke="currentColor"', '')}</g>
</svg>\n`;
    const window = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    try {
      await window.loadURL('data:text/html,<html><body></body></html>');
      const render = async (svg, size) => {
        const data = await window.webContents.executeJavaScript(`(async () => {
        const image = new Image();
        image.src = ${JSON.stringify('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'))};
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = ${size};
        canvas.getContext('2d').drawImage(image, 0, 0, ${size}, ${size});
        return canvas.toDataURL('image/png').split(',')[1];
      })()`);
        return Buffer.from(data, 'base64');
      };
      await writeFile(join(assets, 'app.svg'), icon);
      await writeFile(join(assets, 'app.png'), await render(icon, 1024));
      const images = [];
      for (const size of sizes) images.push(await render(icon, size));
      await writeFile(join(assets, 'app.ico'), ico(images));
      await writeFile(join(assets, 'trayTemplate.png'), await render(mark, 36));
      console.log('Generated SVG, 1024px PNG, multi-resolution ICO and monochrome tray icon');
    } finally {
      window.destroy();
    }
  })
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
