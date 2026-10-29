// Render every platform asset from the same SVG mark, using the bundled Electron.
const { app, BrowserWindow } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const assets = join(__dirname, '../assets');
// Include 125% and 150% Windows scale factors without relying on OS resampling.
const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

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
  <defs><linearGradient id="tile" x1="22" y1="1" x2="100" y2="127" gradientUnits="userSpaceOnUse"><stop stop-color="#38adff"/><stop offset=".5" stop-color="#087fff"/><stop offset="1" stop-color="#0759dc"/></linearGradient></defs>
  <path id="tile-shape" d="M40 1h48c26 0 39 13 39 39v48c0 26-13 39-39 39H40C14 127 1 114 1 88V40C1 14 14 1 40 1Z" fill="url(#tile)"/>
  <use href="#tile-shape" fill="none" stroke="#ffffff" stroke-opacity=".2" stroke-width="1"/>
  <g color="#fff">${glyph}</g>
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
      const { syncBrand } = await import('./sync-brand.mjs');
      await syncBrand();
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
