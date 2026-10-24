import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuBarTitle } from '../electron/menu-bar.js';
import { defaults, type State } from '../electron/types.js';

test('menu bar shows missing data honestly and distinguishes quota windows and display modes', () => {
  const state: State = { settings: { ...defaults }, account: null, plan: null, buckets: [], updatedAt: null, refreshing: false, status: '', error: null, executable: null, live: null };
  assert.equal(menuBarTitle(state), '—');
  state.buckets = [{ limitId: 'other', primary: { usedPercent: 90, windowDurationMins: 300, resetsAt: null } }, { limitId: 'codex', primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: null }, secondary: { usedPercent: 35, windowDurationMins: 10080, resetsAt: null } }];
  assert.equal(menuBarTitle(state), '88%');
  state.settings.menuBarDisplay = 'used';
  assert.equal(menuBarTitle(state), '12%');
  state.settings.menuBarDisplay = 'both';
  assert.equal(menuBarTitle(state), '88% / 65%');
  state.buckets[1].secondary = null;
  assert.equal(menuBarTitle(state), '88% / —');
  state.settings.menuBarDisplay = 'tokens';
  assert.equal(menuBarTitle(state), '— tok');
  state.live = { sessionId: null, title: '', turnId: null, turnNumber: null, tokens: { input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0 }, status: 'completed', complete: true, updatedAt: 0, error: null };
  assert.equal(menuBarTitle(state), '0 tok');
  state.settings.menuBarDisplay = 'icon';
  assert.equal(menuBarTitle(state), '');
});
