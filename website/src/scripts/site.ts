/**
 * 官网交互入口：管理语言菜单、移动导航及 Release 下载链接回填。
 */
import { translator, locales, type Locale } from '../i18n';
import { detectDownloadPlatform, downloadRules, releaseDownloadUrl } from './downloads';
const locale = (document.documentElement.lang || 'en') as Locale;
const t = translator(locale);
const backdrop = document.querySelector<HTMLButtonElement>('[data-nav-backdrop]');
function syncNavigationSurface() {
  const open = !!document.querySelector(
    '.nav-links.is-open, .preference-trigger[aria-expanded="true"]',
  );
  if (backdrop) backdrop.hidden = !open || !matchMedia('(max-width: 767px)').matches;
}
const preferenceMenus = document.querySelectorAll<HTMLElement>('.preference-menu');
function closePreferences(restoreFocus = false) {
  preferenceMenus.forEach((menu) => {
    const trigger = menu.querySelector<HTMLButtonElement>('.preference-trigger');
    const wasOpen = trigger?.getAttribute('aria-expanded') === 'true';
    trigger?.setAttribute('aria-expanded', 'false');
    const panel = menu.querySelector<HTMLElement>('.preference-options');
    if (panel) panel.hidden = true;
    if (restoreFocus && wasOpen) trigger?.focus();
  });
  syncNavigationSurface();
}
preferenceMenus.forEach((menu) => {
  const trigger = menu.querySelector<HTMLButtonElement>('.preference-trigger');
  const panel = menu.querySelector<HTMLElement>('.preference-options');
  function openMenu(focusLast = false) {
    closePreferences();
    closeMenu();
    trigger?.setAttribute('aria-expanded', 'true');
    if (panel) panel.hidden = false;
    syncNavigationSurface();
    const items = panel?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    const selected = panel?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (focusLast) items?.[items.length - 1]?.focus();
    else (selected ?? items?.[0])?.focus();
  }
  trigger?.addEventListener('click', () =>
    trigger.getAttribute('aria-expanded') === 'true' ? closePreferences() : openMenu(),
  );
  trigger?.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      openMenu(event.key === 'ArrowUp');
    }
  });
  panel?.addEventListener('keydown', (event) => {
    const items = Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      closePreferences(true);
    }
    if (event.key === 'Tab') closePreferences();
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
    if (event.key === ' ' && document.activeElement instanceof HTMLAnchorElement) {
      event.preventDefault();
      document.activeElement.click();
    }
  });
});
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && !event.target.closest('.preference-menu'))
    closePreferences();
});
document.addEventListener('focusin', (event) => {
  if (event.target instanceof Element && !event.target.closest('.preference-menu'))
    closePreferences();
});
document.querySelectorAll<HTMLAnchorElement>('[data-language]').forEach((link) =>
  link.addEventListener('click', (event) => {
    const code = locales.find((item) => item.code === link.dataset.language)?.code;
    if (!code) return;
    try {
      localStorage.setItem('pulse-language', code);
    } catch {}
    link.hash = location.hash;
    link.search = location.search;
    if (code === locale) {
      event.preventDefault();
      closePreferences(true);
    }
  }),
);
const nav = document.querySelector<HTMLElement>('.nav-links');
const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
function closeMenu() {
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', t('展开导航'));
  nav?.classList.remove('is-open');
  syncNavigationSurface();
}
toggle?.addEventListener('click', () => {
  closePreferences();
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? t('收起导航') : t('展开导航'));
  nav?.classList.toggle('is-open', open);
  syncNavigationSurface();
});
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const wasOpen = toggle?.getAttribute('aria-expanded') === 'true';
    closeMenu();
    closePreferences(true);
    if (wasOpen) toggle?.focus();
  }
});
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && !event.target.closest('.nav-shell')) closeMenu();
});

backdrop?.addEventListener('click', () => {
  closeMenu();
  closePreferences();
});
matchMedia('(max-width: 767px)').addEventListener('change', () => {
  closeMenu();
  closePreferences();
});

const demo = document.querySelector<HTMLElement>('#product-demo');
const platformButtons = document.querySelectorAll<HTMLButtonElement>('[data-platform-button]');
platformButtons.forEach((button) =>
  button.addEventListener('click', () => {
    if (demo) demo.dataset.platform = button.dataset.platformButton;
    platformButtons.forEach((other) =>
      other.setAttribute('aria-pressed', String(other === button)),
    );
  }),
);
const clientPlatform =
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
  '';
const detectedPlatform = detectDownloadPlatform(clientPlatform, navigator.userAgent);
document.querySelectorAll<HTMLElement>('[data-download-card]').forEach((card) => {
  // Browsers do not reliably expose Mac CPU architecture; do not guess Apple Silicon.
  const recommended = detectedPlatform === 'windows' && card.dataset.downloadCard === 'win-x64';
  card.querySelector('.button')?.classList.toggle('button-secondary', !recommended);
});
if (detectedPlatform === 'windows') {
  const primary = document.querySelector('[data-primary-download]');
  const secondary = document.querySelector('[data-secondary-download]');
  if (primary) primary.textContent = t('下载 Windows 版');
  if (secondary) secondary.textContent = t('Mac 版');
  document.querySelector<HTMLButtonElement>('[data-platform-button="windows"]')?.click();
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}
interface PublicRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}
async function loadDownloads() {
  // Only public release assets are used. Drafts and unavailable APIs retain the working Releases link.
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(
      'https://api.github.com/repos/FluentHaze/codex-pulse/releases/latest',
      {
        signal: controller.signal,
        headers: { Accept: 'application/vnd.github+json' },
      },
    );
    if (!response.ok) return;
    const release: PublicRelease = await response.json();
    if (release.draft || release.prerelease || !Array.isArray(release.assets)) return;
    const matched = new Set<string>();
    function applyRelease(item: PublicRelease) {
      if (!item || item.draft || item.prerelease || !Array.isArray(item.assets)) return;
      document.querySelectorAll<HTMLAnchorElement>('a[data-download]').forEach((link) => {
        const key = link.dataset.download ?? '';
        if (matched.has(key)) return;
        const rule = downloadRules[key];
        const asset = item.assets.find(
          (asset) =>
            asset &&
            typeof asset.name === 'string' &&
            rule?.test(asset.name) &&
            releaseDownloadUrl(asset.browser_download_url),
        );
        const url = asset && releaseDownloadUrl(asset.browser_download_url);
        if (!url) return;
        link.href = url;
        if (link.classList.contains('button')) {
          const text = link.firstChild;
          if (text?.nodeType === Node.TEXT_NODE) text.textContent = t('下载安装包') + ' ';
          const version = link
            .closest('[data-download-card]')
            ?.querySelector('[data-download-version]');
          if (version) version.textContent = item.tag_name;
        }
        matched.add(key);
      });
    }
    applyRelease(release);
    // Platforms can ship independently; label each package's actual release version.
    if (matched.size < Object.keys(downloadRules).length) {
      const history = await fetch(
        'https://api.github.com/repos/FluentHaze/codex-pulse/releases?per_page=10',
        {
          signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json' },
        },
      ).catch(() => null);
      if (history?.ok) {
        const items: unknown = await history.json();
        if (Array.isArray(items)) items.forEach(applyRelease);
      }
    }
    const status = document.querySelector('#release-status');
    if (matched.size && status)
      status.textContent = t('最新公开版本 {version} · 完整更新记录见 GitHub Releases').replace(
        '{version}',
        release.tag_name,
      );
  } catch {
    /* Downloads still link to the repository's public release list. */
  } finally {
    window.clearTimeout(timeout);
  }
}
void loadDownloads();

// A fresh visitor stays on a stable, crawlable URL; suggest their browser language.
const suggestion = document.querySelector<HTMLElement>('.language-suggestion');
try {
  const base = document.documentElement.dataset.base || '/';
  if (
    suggestion &&
    location.pathname === base &&
    !localStorage.getItem('pulse-language') &&
    !sessionStorage.getItem('pulse-language-suggestion-dismissed')
  ) {
    const preferred =
      (navigator.languages || [navigator.language])
        .map((value) => {
          const language = value.toLowerCase();
          if (/^zh(?:-|$)/.test(language))
            return /hant|tw|hk|mo/.test(language) ? 'zh-TW' : 'zh-CN';
          return (
            ['en', 'ja', 'ko'].find(
              (code) => language === code || language.startsWith(code + '-'),
            ) || ''
          );
        })
        .find(Boolean) || 'en';
    const target = locales.find((item) => item.code === preferred && item.code !== locale);
    if (target) {
      const prompts: Record<string, string> = {
        'zh-TW': '以繁體中文瀏覽此頁？',
        en: 'Read this page in English?',
        ja: '日本語で表示しますか？',
        ko: '한국어로 보시겠어요?',
      };
      suggestion.querySelector('[data-language-suggestion-text]')!.textContent =
        prompts[target.code];
      const link = suggestion.querySelector<HTMLAnchorElement>('[data-language-suggestion-link]')!;
      link.href = `${base}${target.slug}/` + location.search + location.hash;
      link.textContent = target.label;
      link.lang = target.code;
      link.addEventListener('click', () => {
        try {
          localStorage.setItem('pulse-language', target.code);
        } catch {}
      });
      suggestion.hidden = false;
    }
  }
} catch {
  /* Storage can be unavailable; all locale links remain usable. */
}
document.querySelector('[data-language-suggestion-close]')?.addEventListener('click', () => {
  if (suggestion) suggestion.hidden = true;
  try {
    sessionStorage.setItem('pulse-language-suggestion-dismissed', '1');
  } catch {}
});

// The showcase runs entirely on fixed sample data, with no local account access.
const workspace = document.querySelector<HTMLElement>('[data-demo-workspace]');
const demoTabs = Array.from(
  workspace?.querySelectorAll<HTMLButtonElement>('[data-demo-tab]') ?? [],
);
function clearDemoMorph() {
  workspace?.classList.remove('demo-scroll-morph');
  workspace?.querySelectorAll<HTMLElement>('[data-demo-panel]').forEach((panel) => {
    panel.style.removeProperty('--morph-opacity');
    panel.style.removeProperty('--morph-y');
    panel.style.removeProperty('--morph-scale');
    panel.style.removeProperty('--morph-blur');
    panel.removeAttribute('aria-hidden');
    panel.inert = false;
  });
}
function switchDemo(button: HTMLButtonElement) {
  clearDemoMorph();
  const selected = button.dataset.demoTab;
  demoTabs.forEach((tab) => {
    tab.classList.toggle('active', tab === button);
    tab.setAttribute('aria-selected', String(tab === button));
    tab.tabIndex = tab === button ? 0 : -1;
  });
  workspace
    ?.querySelectorAll<HTMLElement>('[data-demo-panel]')
    .forEach((panel) => (panel.hidden = panel.dataset.demoPanel !== selected));
  closeDemoMessages(false);
}
demoTabs.forEach((button, index) => {
  button.addEventListener('click', () => switchDemo(button));
  button.addEventListener('keydown', (event) => {
    const next =
      event.key === 'ArrowDown'
        ? (index + 1) % demoTabs.length
        : event.key === 'ArrowUp'
          ? (index + demoTabs.length - 1) % demoTabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? demoTabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    switchDemo(demoTabs[next]);
    demoTabs[next].focus();
  });
});
workspace?.querySelectorAll<HTMLButtonElement>('[data-demo-display]').forEach((button) =>
  button.addEventListener('click', () => {
    const used = button.dataset.demoDisplay === 'used';
    workspace
      .querySelectorAll('[data-demo-display]')
      .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    workspace
      .querySelectorAll<HTMLElement>('[data-demo-value]')
      .forEach(
        (item) =>
          (item.textContent = `${used ? 100 - Number(item.dataset.demoValue) : item.dataset.demoValue}%`),
      );
    workspace
      .querySelectorAll<HTMLElement>('[data-demo-ring]')
      .forEach((item) =>
        item.style.setProperty(
          '--percent',
          String(used ? 100 - Number(item.dataset.demoRing) : item.dataset.demoRing),
        ),
      );
    workspace
      .querySelectorAll('[data-demo-display-label]')
      .forEach((item) => (item.textContent = used ? t('已用') : t('剩余')));
  }),
);
workspace?.querySelectorAll<HTMLButtonElement>('[data-demo-day]').forEach((button) =>
  button.addEventListener('click', () => {
    workspace
      .querySelectorAll('[data-demo-day]')
      .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    const day = Number(button.dataset.demoDay);
    const label = workspace.querySelector('[data-demo-selected-day]');
    const record = workspace.querySelector('[data-demo-day-record]');
    if (label) label.textContent = `2026 / 11 / ${String(day).padStart(2, '0')}`;
    if (record)
      record.textContent =
        day === 2
          ? t('个人窗口到期')
          : button.classList.contains('marked')
            ? t('已确认重置')
            : t('这一天暂无匹配记录');
  }),
);
workspace?.querySelectorAll<HTMLButtonElement>('[data-demo-conversation]').forEach((button) =>
  button.addEventListener('click', () => {
    workspace
      .querySelectorAll('[data-demo-conversation]')
      .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    const title = workspace.querySelector('[data-demo-conversation-title]');
    if (title) title.textContent = button.dataset.demoConversation ?? '';
  }),
);
const messagePanel = workspace?.querySelector<HTMLElement>('.demo-message-panel');
let messageTrigger: HTMLButtonElement | undefined;
function closeDemoMessages(restoreFocus = true) {
  if (messagePanel) messagePanel.hidden = true;
  if (restoreFocus) messageTrigger?.focus();
}
workspace?.querySelectorAll<HTMLButtonElement>('[data-demo-message]').forEach((button) =>
  button.addEventListener('click', () => {
    messageTrigger = button;
    if (messagePanel) messagePanel.hidden = false;
    workspace.querySelector<HTMLButtonElement>('[data-demo-close]')?.focus();
  }),
);
workspace?.querySelector('[data-demo-close]')?.addEventListener('click', () => closeDemoMessages());
messagePanel?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeDemoMessages();
  }
});

const demoPeekTrigger = document.querySelector<HTMLButtonElement>('[data-demo-peek-trigger]');
const demoPeek = document.querySelector<HTMLElement>('[data-demo-peek]');
function hideDemoPeek() {
  if (demoPeek) demoPeek.hidden = true;
  demoPeekTrigger?.setAttribute('aria-expanded', 'false');
}
demoPeekTrigger?.addEventListener('click', () => {
  if (!demoPeek) return;
  demoPeek.hidden = !demoPeek.hidden;
  demoPeekTrigger.setAttribute('aria-expanded', String(!demoPeek.hidden));
});
document.addEventListener('click', (event) => {
  if (
    event.target instanceof Element &&
    !event.target.closest('[data-demo-peek], [data-demo-peek-trigger]')
  )
    hideDemoPeek();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && demoPeek && !demoPeek.hidden) {
    hideDemoPeek();
    demoPeekTrigger?.focus();
  }
});

workspace?.querySelector('[data-demo-open-tokens]')?.addEventListener('click', () => {
  const tab = demoTabs.find((item) => item.dataset.demoTab === 'tokens');
  if (tab) switchDemo(tab);
});
workspace?.querySelector('[data-demo-open-resets]')?.addEventListener('click', () => {
  const tab = demoTabs.find((item) => item.dataset.demoTab === 'resets');
  if (tab) switchDemo(tab);
});

// Scroll progress drives both panels continuously; manual interaction keeps control of focus.
document.addEventListener('pulse:demo-morph', (event) => {
  if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') return;
  if (!workspace || workspace.contains(document.activeElement)) return;
  const detail = event.detail as { from?: unknown; to?: unknown; mix?: unknown };
  const { from, to, mix } = detail;
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof mix !== 'number' ||
    !Number.isFinite(mix)
  )
    return;
  const fromTab = demoTabs.find((tab) => tab.dataset.demoTab === from);
  const toTab = demoTabs.find((tab) => tab.dataset.demoTab === to);
  if (!fromTab || !toTab) return;
  const amount = Math.max(0, Math.min(1, mix));
  if (amount === 0 || from === to) {
    if (
      fromTab.getAttribute('aria-selected') !== 'true' ||
      workspace.classList.contains('demo-scroll-morph')
    )
      switchDemo(fromTab);
    return;
  }
  if (!workspace.classList.contains('demo-scroll-morph')) closeDemoMessages(false);
  workspace.classList.add('demo-scroll-morph');
  const selectedTab = amount >= 0.5 ? toTab : fromTab;
  demoTabs.forEach((tab) => {
    tab.classList.toggle('active', tab === selectedTab);
    tab.setAttribute('aria-selected', String(tab === selectedTab));
    tab.tabIndex = tab === selectedTab ? 0 : -1;
  });
  workspace.querySelectorAll<HTMLElement>('[data-demo-panel]').forEach((panel) => {
    const outgoing = panel.dataset.demoPanel === from;
    const incoming = panel.dataset.demoPanel === to;
    panel.hidden = !outgoing && !incoming;
    const active = panel.dataset.demoPanel === selectedTab.dataset.demoTab;
    panel.inert = !active;
    panel.setAttribute('aria-hidden', String(!active));
    if (!outgoing && !incoming) return;
    const visibility = outgoing ? 1 - amount : amount;
    panel.style.setProperty('--morph-opacity', String(visibility));
    panel.style.setProperty(
      '--morph-y',
      String(outgoing ? -amount * 35 : (1 - amount) * 42) + 'px',
    );
    panel.style.setProperty(
      '--morph-scale',
      String(outgoing ? 1 - amount * 0.035 : 0.965 + amount * 0.035),
    );
    panel.style.setProperty('--morph-blur', String((1 - visibility) * 2.2) + 'px');
  });
});
document.addEventListener('pulse:demo-morph-reset', () => {
  const current = demoTabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
  if (current) switchDemo(current);
});

// Expand the real disclosure elements, rather than only navigating to their anchor.
const turnToggle = document.querySelector<HTMLButtonElement>('[data-turn-toggle]');
const turnRows = Array.from(
  document.querySelectorAll<HTMLDetailsElement>('#turn-samples .pulse-turn-row'),
);
function syncTurnToggle() {
  const expanded = turnRows.length > 0 && turnRows.every((row) => row.open);
  turnToggle?.setAttribute('aria-expanded', String(expanded));
  const label = turnToggle?.querySelector('[data-turn-toggle-label]');
  if (label) label.textContent = expanded ? t('收起示例轮次') : t('展开示例轮次');
}
turnToggle?.addEventListener('click', () => {
  const expand = !turnRows.every((row) => row.open);
  turnRows.forEach((row) => {
    row.open = expand;
  });
  syncTurnToggle();
  if (expand) {
    const first = turnRows[0]?.querySelector<HTMLElement>('summary');
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
});
turnRows.forEach((row) => row.addEventListener('toggle', syncTurnToggle));
syncTurnToggle();
