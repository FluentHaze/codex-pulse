/**
 * 官网交互入口：管理偏好菜单、主题、移动导航及 Release 下载链接回填。
 */
import { translator, locales, type Locale } from '../i18n';
import { detectDownloadPlatform, downloadRules, releaseDownloadUrl } from './downloads';
const locale = (document.documentElement.lang || 'en') as Locale;
const t = translator(locale);
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
}
preferenceMenus.forEach((menu) => {
  const trigger = menu.querySelector<HTMLButtonElement>('.preference-trigger');
  const panel = menu.querySelector<HTMLElement>('.preference-options');
  function openMenu(focusLast = false) {
    closePreferences();
    closeMenu();
    trigger?.setAttribute('aria-expanded', 'true');
    if (panel) panel.hidden = false;
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
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(preference: string) {
  const theme = ['system', 'light', 'dark'].includes(preference) ? preference : 'system';
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.theme =
    theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      document.documentElement.dataset.theme === 'dark' ? '#101114' : '#ffffff',
    );
  document
    .querySelectorAll<HTMLElement>('[data-theme-option]')
    .forEach((item) =>
      item.setAttribute('aria-checked', String(item.dataset.themeOption === theme)),
    );
  const selected = document.querySelector<HTMLElement>(`[data-theme-option="${theme}"] > span`);
  const label = document.querySelector('[data-theme-label]');
  if (label && selected) label.textContent = selected.textContent;
}
applyTheme(document.documentElement.dataset.themePreference || 'system');
document.querySelectorAll<HTMLButtonElement>('[data-theme-option]').forEach((button) =>
  button.addEventListener('click', () => {
    const value = button.dataset.themeOption || 'system';
    try {
      localStorage.setItem('pulse-theme', value);
    } catch {}
    applyTheme(value);
    closePreferences(true);
  }),
);
systemTheme.addEventListener('change', () =>
  applyTheme(document.documentElement.dataset.themePreference || 'system'),
);
window.addEventListener('storage', (event) => {
  if (event.key === 'pulse-theme') applyTheme(event.newValue || 'system');
});
const nav = document.querySelector<HTMLElement>('.nav-links');
const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
function closeMenu() {
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', t('展开导航'));
  nav?.classList.remove('is-open');
}
toggle?.addEventListener('click', () => {
  closePreferences();
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? t('收起导航') : t('展开导航'));
  nav?.classList.toggle('is-open', open);
});
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && !event.target.closest('.nav-shell')) closeMenu();
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
function switchDemo(button: HTMLButtonElement) {
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
    if (label) label.textContent = `2026 / 10 / ${String(day).padStart(2, '0')}`;
    if (record)
      record.textContent =
        day === 30
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
