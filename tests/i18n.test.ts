import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  resolveLanguage,
  setLanguage,
  getLanguage,
  t,
  subscribeLanguage,
  languages,
} from '../electron/i18n';
import { messages } from '../electron/locales/messages';
import { defaults } from '../electron/types';

test('system locale resolves all five languages and unsupported locales fall back to English', () => {
  assert.equal(defaults.language, 'system');
  for (const [system, expected] of [
    ['zh-CN', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-HK', 'zh-TW'],
    ['zh-Hant-TW', 'zh-TW'],
    ['en-GB', 'en'],
    ['ja-JP', 'ja'],
    ['ko-KR', 'ko'],
    ['de-DE', 'en'],
  ] as const)
    assert.equal(resolveLanguage('system', system), expected);
  assert.equal(resolveLanguage('ko', 'zh-CN'), 'ko');
  assert.equal(resolveLanguage('invalid', 'ja-JP'), 'ja');
});

test('all translated messages preserve placeholders, and UI keys have four complete translations', () => {
  for (const [source, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 4, source);
    const slots = (value: string) =>
      [...value.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
    for (const translation of translations) {
      assert.ok(translation.trim(), source);
      assert.deepEqual(slots(translation), slots(source), source);
    }
  }
  const sources = [
    'main',
    'Floating',
    'Quota',
    'TokenDetails',
    'TodayUsage',
    'HourlyUsage',
    'ResetTracker',
    'CommandPalette',
    'DesktopChrome',
    'AppUpdate',
    'StarGuide',
  ];
  for (const name of sources) {
    // 使用语法树读取字符串值，避免换行、单双引号和转义字符影响翻译键扫描。
    const source = ts.createSourceFile(
      `${name}.tsx`,
      readFileSync(new URL(`../src/${name}.tsx`, import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 't' &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        const key = node.arguments[0].text;
        assert.ok(key in messages, `${name}: missing ${key}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
});

test('live switches notify memoized views and do not translate substituted user content', () => {
  setLanguage('zh-CN');
  let renders = 0;
  const unsubscribe = subscribeLanguage(() => renders++);
  setLanguage('en');
  assert.equal(t('偏好设置'), 'Preferences');
  setLanguage('ja');
  assert.equal(t('偏好设置'), '環境設定');
  setLanguage('ko');
  assert.equal(t('偏好设置'), '환경설정');
  const userText = '我的聊天 {0} $& <script>';
  assert.equal(t('来源：{0}', [userText]), `출처: ${userText}`);
  setLanguage('ko');
  assert.equal(renders, 3);
  unsubscribe();
  setLanguage('zh-TW');
  assert.equal(t('偏好设置'), '偏好設定');
  assert.equal(getLanguage(), 'zh-TW');
  setLanguage('zh-CN');
});

test('canonical backend diagnostics are localized without changing their error classification', () => {
  for (const language of languages) {
    setLanguage(language.value);
    const rendered = t('选择的 codex.exe 不存在或不可执行');
    assert.ok(rendered.includes('codex.exe'));
    if (language.value === 'en')
      assert.equal(rendered, 'Selected codex.exe does not exist or is not executable');
  }
  setLanguage('zh-CN');
});
