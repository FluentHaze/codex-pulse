import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(new URL('../website/src/scripts/hero-scroll.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function createHero() {
  const events: { type: string; detail?: { from: string; to: string; mix: number } }[] = [];
  const frames: (() => void)[] = [];
  const reduced = { matches: false, addEventListener() {} };
  const tall = { matches: true, addEventListener() {} };
  const classes = new Set<string>();
  const workspace = {
    inert: false,
    dispatchEvent(event: (typeof events)[number]) {
      events.push(event);
    },
  };
  const hero = {
    style: { setProperty() {}, removeProperty() {} },
    dataset: {},
    offsetHeight: 800,
    clientWidth: 1440,
    clientHeight: 800,
  };
  const track = {
    classList: {
      contains: (name: string) => classes.has(name),
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    offsetHeight: 4800,
    getBoundingClientRect: () => ({ top: -context.scrollY }),
    querySelector: (selector: string) =>
      selector === '.pulse-hero' ? hero : selector === '[data-demo-workspace]' ? workspace : null,
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    exports: {},
    document: { querySelector: () => track },
    window: { scrollY: 0, addEventListener() {} },
    scrollY: 0,
    innerWidth: 1440,
    matchMedia: (query: string) => (query.includes('min-height') ? tall : reduced),
    getComputedStyle: () => ({ top: '0' }),
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
    ResizeObserver: class {
      observe() {}
    },
    CustomEvent: class {
      constructor(
        public type: string,
        public options?: { detail?: unknown },
      ) {}
      get detail() {
        return this.options?.detail;
      }
    },
  });
  vm.runInContext(source, context);
  const flush = () => {
    while (frames.length) frames.shift()!();
  };
  flush();
  return {
    workspace,
    events,
    reduced,
    tall,
    scrollTo(value: number) {
      context.window.scrollY = context.scrollY = value;
      vm.runInContext('scheduleHero()', context);
      flush();
    },
    configure() {
      vm.runInContext('configureHero()', context);
      flush();
    },
  };
}

test('scroll jumps settle both endpoints without repeatedly overriding an offscreen demo', () => {
  const page = createHero();
  page.scrollTo(2920);
  assert.ok(Math.abs(page.events.at(-1)!.detail!.mix - 0.5) < 0.001);
  page.scrollTo(4400);
  assert.equal(page.events.at(-1)?.detail?.from, 'tokens');
  assert.equal(page.events.at(-1)?.detail?.mix, 0);
  const count = page.events.length;
  page.scrollTo(4500);
  assert.equal(page.events.length, count);
  page.scrollTo(2920);
  page.scrollTo(-10);
  assert.equal(page.events.at(-1)?.detail?.from, 'overview');
  assert.equal(page.events.at(-1)?.detail?.mix, 0);
});

test('demo controls become interactive only after opening and recover in static layouts', () => {
  const page = createHero();
  assert.equal(page.workspace.inert, true);
  page.scrollTo(1800);
  assert.equal(page.workspace.inert, true);
  page.scrollTo(2400);
  assert.equal(page.workspace.inert, false);
  page.scrollTo(0);
  assert.equal(page.workspace.inert, true);
  page.reduced.matches = true;
  page.configure();
  assert.equal(page.workspace.inert, false);
  page.reduced.matches = false;
  page.configure();
  assert.equal(page.workspace.inert, true);
  page.tall.matches = false;
  page.configure();
  assert.equal(page.workspace.inert, false);
});
