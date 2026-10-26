// Use the same bundled Electron renderer as create-icon.cjs; no extra dependency.
const { app, BrowserWindow } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

app.whenReady().then(async () => {
  const assets = join(__dirname, '../assets/dmg');
  const source = await readFile(join(assets, 'background.svg'), 'utf8');
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await window.loadURL('data:text/html,<html><body></body></html>');
    for (const scale of [1, 2]) {
      const image = await window.webContents.executeJavaScript(`(async () => {
        const image = new Image();
        image.src = ${JSON.stringify('data:image/svg+xml;base64,' + Buffer.from(source).toString('base64'))};
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 800 * ${scale};
        canvas.height = 640 * ${scale};
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png').split(',')[1];
      })()`);
      await writeFile(join(assets, scale === 1 ? 'background.png' : 'background@2x.png'), Buffer.from(image, 'base64'));
    }
    console.log('Generated DMG background (800×640 and Retina 1600×1280)');
  } finally {
    window.destroy();
  }
}).then(() => app.quit()).catch(error => { console.error(error); app.exit(1); });
