import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProjectCatalog } from '../electron/project-catalog.js';
test('project names match explicit thread membership before cwd, and support normalized nested paths', () => {
  const catalog = parseProjectCatalog({ 'local-projects': {
    android: { id: 'android', name: '安卓', rootPaths: ['D:\\project\\app\\android-native'] },
    parent: { id: 'parent', name: '应用', rootPaths: ['D:\\project\\app'] }
  }, 'thread-project-assignments': { moved: { projectKind: 'local', projectId: 'android' } } });
  assert.equal(catalog.match('moved', 'C:\\unrelated')?.name, '安卓');
  assert.equal(catalog.match('nested', 'd:/PROJECT/app/android-native/src/')?.name, '安卓');
  assert.equal(catalog.match('other', 'D:\\project\\application'), undefined);
  assert.equal(catalog.projects.length, 2);
  assert.equal(parseProjectCatalog(null).match('x', 'x'), undefined);
});
