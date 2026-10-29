/**
 * 隔离环境下的最小 IPC 桥接层。只暴露明确的方法，不向页面开放 ipcRenderer 或 Node API。
 */
import { contextBridge, ipcRenderer } from 'electron';
import type {
  UpdateState,
  State,
  Settings,
  TokenCatalog,
  TokenSession,
  DailyStats,
} from './types.js';
import type { ResetData } from './reset-data.js';
ipcRenderer.on('navigate', (_event, tab: string) =>
  window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: tab })),
);
contextBridge.exposeInMainWorld('pulse', {
  platform: process.platform,
  getUpdate: (): Promise<UpdateState> => ipcRenderer.invoke('update-state'),
  update: (action: 'check' | 'download' | 'install' | 'manual'): Promise<void> =>
    ipcRenderer.invoke('update-action', action),
  subscribeUpdate: (callback: (state: UpdateState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
  windowMenus: (): Promise<string[]> => ipcRenderer.invoke('window-menus'),
  windowMenu: (label: string, x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('window-menu', label, x, y),
  getState: (): Promise<State> => ipcRenderer.invoke('get-state'),
  claimStarGuide: (): Promise<boolean> => ipcRenderer.invoke('claim-star-guide'),
  resetData: (): Promise<ResetData> => ipcRenderer.invoke('reset-data'),
  resetSource: (url: string): Promise<void> => ipcRenderer.invoke('reset-source', url),
  tokenCatalog: (force = false): Promise<TokenCatalog> =>
    ipcRenderer.invoke('token-catalog', force),
  tokenSession: (id: string): Promise<TokenSession> => ipcRenderer.invoke('token-session', id),
  todayUsage: (force = false): Promise<DailyStats> => ipcRenderer.invoke('today-usage', force),
  scopeUsage: (ids: string[]): Promise<DailyStats> => ipcRenderer.invoke('scope-usage', ids),
  peekSize: (height: number): Promise<void> => ipcRenderer.invoke('peek-size', height),
  peek: (expanded: boolean): Promise<void> => ipcRenderer.invoke('float-peek', expanded),
  refresh: () => ipcRenderer.invoke('refresh'),
  settings: (patch: Partial<Settings>) => ipcRenderer.invoke('settings', patch),
  action: (action: string) => ipcRenderer.invoke('action', action),
  drag: (phase: 'start' | 'move' | 'end', x: number, y: number) =>
    ipcRenderer.send('drag', phase, x, y),
  subscribe: (callback: (state: State) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: State) => callback(state);
    ipcRenderer.on('state', listener);
    return () => ipcRenderer.removeListener('state', listener);
  },
});
