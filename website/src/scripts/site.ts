import { translator, locales, type Locale } from '../i18n';
const locale = (document.documentElement.lang || 'en') as Locale;
const t = translator(locale);
const preferenceMenus = document.querySelectorAll<HTMLElement>('.preference-menu');
function closePreferences(restoreFocus = false) {
  preferenceMenus.forEach(menu => {
    const trigger = menu.querySelector<HTMLButtonElement>('.preference-trigger');
    const wasOpen = trigger?.getAttribute('aria-expanded') === 'true';
    trigger?.setAttribute('aria-expanded', 'false');
    const panel = menu.querySelector<HTMLElement>('.preference-options');
    if (panel) panel.hidden = true;
    if (restoreFocus && wasOpen) trigger?.focus();
  });
}
preferenceMenus.forEach(menu => {
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
  trigger?.addEventListener('click', () => trigger.getAttribute('aria-expanded') === 'true' ? closePreferences() : openMenu());
  trigger?.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); openMenu(event.key === 'ArrowUp');
    }
  });
  panel?.addEventListener('keydown', event => {
    const items = Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') { event.preventDefault(); closePreferences(true); }
    if (event.key === 'Tab') closePreferences();
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
    if (event.key === ' ' && document.activeElement instanceof HTMLAnchorElement) {
      event.preventDefault(); document.activeElement.click();
    }
  });
});
document.addEventListener('click', event => {
  if (event.target instanceof Element && !event.target.closest('.preference-menu')) closePreferences();
});
document.addEventListener('focusin', event => {
  if (event.target instanceof Element && !event.target.closest('.preference-menu')) closePreferences();
});
document.querySelectorAll<HTMLAnchorElement>('[data-language]').forEach(link => link.addEventListener('click', event => {
  const code = locales.find(item => item.code === link.dataset.language)?.code;
  if (!code) return;
  try { localStorage.setItem('pulse-language', code); } catch {}
  link.hash = location.hash;
  link.search = location.search;
  if (code === locale) { event.preventDefault(); closePreferences(true); }
}));
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(preference: string) {
  const theme = ['system', 'light', 'dark'].includes(preference) ? preference : 'system';
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.theme = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#101114' : '#ffffff');
  document.querySelectorAll<HTMLElement>('[data-theme-option]').forEach(item => item.setAttribute('aria-checked', String(item.dataset.themeOption === theme)));
  const selected = document.querySelector<HTMLElement>(`[data-theme-option="${theme}"] > span`);
  const label = document.querySelector('[data-theme-label]');
  if (label && selected) label.textContent = selected.textContent;
}
applyTheme(document.documentElement.dataset.themePreference || 'system');
document.querySelectorAll<HTMLButtonElement>('[data-theme-option]').forEach(button => button.addEventListener('click', () => {
  const value = button.dataset.themeOption || 'system';
  try { localStorage.setItem('pulse-theme', value); } catch {}
  applyTheme(value);
  closePreferences(true);
}));
systemTheme.addEventListener('change', () => applyTheme(document.documentElement.dataset.themePreference || 'system'));
window.addEventListener('storage', event => {
  if (event.key === 'pulse-theme') applyTheme(event.newValue || 'system');
});
const nav = document.querySelector<HTMLElement>(".nav-links");
const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
function closeMenu() {
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", t("展开导航"));
  nav?.classList.remove("is-open");
}
toggle?.addEventListener("click", () => {
  closePreferences();
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? t("收起导航") : t("展开导航"));
  nav?.classList.toggle("is-open", open);
});
nav
  ?.querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Element && !event.target.closest(".nav-shell"))
    closeMenu();
});

const demo = document.querySelector<HTMLElement>("#product-demo");
const platformButtons = document.querySelectorAll<HTMLButtonElement>(
  "[data-platform-button]",
);
platformButtons.forEach((button) =>
  button.addEventListener("click", () => {
    if (demo) demo.dataset.platform = button.dataset.platformButton;
    platformButtons.forEach((other) =>
      other.setAttribute("aria-pressed", String(other === button)),
    );
  }),
);
if (/Windows/i.test(navigator.userAgent)) {
  const primary = document.querySelector("[data-primary-download]");
  const secondary = document.querySelector("[data-secondary-download]");
  if (primary) primary.textContent = t("下载 Windows 版");
  if (secondary) secondary.textContent = t("Mac 版");
  document
    .querySelector<HTMLButtonElement>('[data-platform-button="windows"]')
    ?.click();
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
      "https://api.github.com/repos/FluentHaze/codex-pulse/releases/latest",
      {
        signal: controller.signal,
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (!response.ok) return;
    const release: PublicRelease = await response.json();
    if (release.draft || release.prerelease || !Array.isArray(release.assets))
      return;
    let matched = 0;
    const rules: Record<string, RegExp> = {
      "mac-arm64-dmg": /mac-arm64\.dmg$/i,
      "mac-arm64-zip": /mac-arm64\.zip$/i,
      "mac-x64-dmg": /mac-x64\.dmg$/i,
      "mac-x64-zip": /mac-x64\.zip$/i,
      "win-x64-exe": /win-x64\.exe$/i,
    };
    document
      .querySelectorAll<HTMLAnchorElement>("a[data-download]")
      .forEach((link) => {
        const rule = rules[link.dataset.download ?? ""];
        const asset = release.assets.find(
          (asset) => typeof asset.name === "string" && rule?.test(asset.name),
        );
        if (!asset || typeof asset.browser_download_url !== "string") return;
        const url = new URL(asset.browser_download_url);
        if (
          url.origin !== "https://github.com" ||
          !url.pathname.startsWith("/FluentHaze/codex-pulse/releases/download/")
        )
          return;
        link.href = url.href;
        if (link.classList.contains("button")) {
          const text = link.firstChild;
          if (text?.nodeType === Node.TEXT_NODE)
            text.textContent = t("下载安装包") + " ";
        }
        matched++;
      });
    const status = document.querySelector("#release-status");
    if (matched && status)
      status.textContent = t("最新公开版本 {version} · 完整更新记录见 GitHub Releases").replace("{version}", release.tag_name);
  } catch {
    /* Downloads still link to the repository's public release list. */
  } finally {
    window.clearTimeout(timeout);
  }
}
void loadDownloads();
