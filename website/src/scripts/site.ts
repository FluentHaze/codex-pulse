const nav = document.querySelector<HTMLElement>(".nav-links");
const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
function closeMenu() {
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "展开导航");
  nav?.classList.remove("is-open");
}
toggle?.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "收起导航" : "展开导航");
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
  if (primary) primary.textContent = "下载 Windows 版";
  if (secondary) secondary.textContent = "Mac 版";
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
            text.textContent = "下载安装包 ";
        }
        matched++;
      });
    const status = document.querySelector("#release-status");
    if (matched && status)
      status.textContent = `最新公开版本 ${release.tag_name} · 完整更新记录见 GitHub Releases`;
  } catch {
    /* Downloads still link to the repository's public release list. */
  } finally {
    window.clearTimeout(timeout);
  }
}
void loadDownloads();
