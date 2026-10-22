import { contextBridge, ipcRenderer } from 'electron';
import type { State, Settings, TokenCatalog, TokenSession, DailyStats } from './types.js';
ipcRenderer.on('navigate', (_event, tab: string) => window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: tab })));
contextBridge.exposeInMainWorld('pulse', {
  getState: (): Promise<State> => ipcRenderer.invoke('get-state'),
  tokenCatalog: (force = false): Promise<TokenCatalog> => ipcRenderer.invoke('token-catalog', force),
  tokenSession: (id: string): Promise<TokenSession> => ipcRenderer.invoke('token-session', id),
  todayUsage: (force = false): Promise<DailyStats> => ipcRenderer.invoke('today-usage', force),
  scopeUsage: (ids: string[]): Promise<DailyStats> => ipcRenderer.invoke('scope-usage', ids),
  peek: (expanded: boolean): Promise<void> => ipcRenderer.invoke('float-peek', expanded),
  refresh: () => ipcRenderer.invoke('refresh'),
  settings: (patch: Partial<Settings>) => ipcRenderer.invoke('settings', patch),
  action: (action: string) => ipcRenderer.invoke('action', action),
  drag: (phase: 'start' | 'move' | 'end', x: number, y: number) => ipcRenderer.send('drag', phase, x, y),
  subscribe: (callback: (state: State) => void) => { const listener = (_event: Electron.IpcRendererEvent, state: State) => callback(state); ipcRenderer.on('state', listener); return () => ipcRenderer.removeListener('state', listener); }
});
