import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { MacUpdateDownload, newerMacVersion } from './mac-update.js';
import updater from 'electron-updater';
import { fetchUpdate } from './update-fetch.js';
import type { UpdateState } from './types.js';

export function initializeUpdater() {
  const { autoUpdater } = updater;
  const isMac = process.platform === 'darwin';
  const supported = app.isPackaged && (isMac || (process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE));
  let state: UpdateState = { currentVersion: app.getVersion(), status: supported ? 'idle' : 'manual', installMode: isMac ? 'dmg' : 'restart' };
  const publish = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('update-state', state);
  };
  const macDownload = isMac ? new MacUpdateDownload(join(app.getPath('userData'), 'mac-update'), process.arch, app.getVersion(), fetchUpdate, percent => publish({ status: 'downloading', percent })) : undefined;
  // Mac uses the manifest checker only; Squirrel would require a signing identity.
  autoUpdater.autoDownload = !isMac;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => publish({ status: 'checking', error: undefined, percent: undefined }));
  autoUpdater.on('update-available', info => publish({ status: 'downloading', version: info.version, percent: 0, error: undefined }));
  autoUpdater.on('update-not-available', () => publish({ status: 'latest', version: undefined }));
  autoUpdater.on('download-progress', info => publish({ status: 'downloading', percent: Math.max(0, Math.min(100, info.percent)) }));
  autoUpdater.on('update-downloaded', info => publish({ status: 'downloaded', version: info.version, percent: 100 }));
  let busy = false;
  const fail = () => { busy = false; publish({ status: 'error', error: '更新失败，请检查网络或前往下载页面' }); };
  autoUpdater.on('error', fail);
  const restored = supported && macDownload ? macDownload.restore().then(version => {
    if (version) publish({ status: 'downloaded', version, percent: 100 });
  }) : Promise.resolve();
  const check = async () => {
    await restored;
    if (!supported || busy || ['available', 'downloading', 'downloaded'].includes(state.status)) return;
    busy = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.isUpdateAvailable && macDownload && newerMacVersion(result.updateInfo.version, app.getVersion())) {
        const version = await macDownload.download(result.updateInfo);
        publish({ status: 'downloaded', version, percent: 100 });
      } else await result?.downloadPromise;
    } catch { fail(); } finally { busy = false; }
  };
  ipcMain.handle('update-state', async () => { await restored; return state; });
  ipcMain.handle('update-action', async (event, action: unknown) => {
    if (!event.senderFrame?.url.startsWith('file:')) throw new Error('无效的更新请求');
    if (action === 'manual') { await shell.openExternal('https://github.com/FluentHaze/codex-pulse/releases/latest'); return; }
    if (!supported) return;
    await restored;
    if (action === 'check') await check();
    if (!isMac && action === 'download' && state.status === 'available' && !busy) {
      busy = true;
      publish({ status: 'downloading', percent: 0 });
      try { await autoUpdater.downloadUpdate(); } catch { fail(); } finally { busy = false; }
    }
    if (action === 'install' && state.status === 'downloaded' && !busy) {
      busy = true;
      try {
        if (macDownload) {
          const error = await shell.openPath(await macDownload.installerPath());
          if (error) throw new Error(error);
          // Keep Pulse running until the user quits it and replaces the app in Finder.
          busy = false;
        } else autoUpdater.quitAndInstall(true, true);
      } catch { busy = false; fail(); }
    }
  });
  if (supported) {
    const startup = setTimeout(() => void check(), 15_000);
    const interval = setInterval(() => void check(), 6 * 60 * 60_000);
    startup.unref(); interval.unref();
    app.once('before-quit', () => { clearTimeout(startup); clearInterval(interval); macDownload?.cancel(); });
  }
}
