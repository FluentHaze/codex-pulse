# Codex Pulse 官网

独立的 Astro + TypeScript + Tailwind CSS 静态站点。设计参考 `design/homepage-v2.png`，产品界面通过 HTML/CSS 重建并标注为示意，不使用整张设计稿充当网页。

## 本地运行

使用 Node.js 22.23.4 或更新版本（`nvm use`，首次可运行 `nvm install`）：

```sh
cd website
npm ci
npm run dev
```

## 验证与构建

```sh
npm run build
npm run preview
```

构建先执行 Astro/TypeScript 检查，输出静态文件到 `website/dist`。

## 下载链接

所有下载按钮默认指向项目的公开 GitHub Releases 列表。页面加载后尝试读取 GitHub 最新的公开正式 Release，并根据架构分别匹配 DMG、ZIP、Windows Setup 安装版和便携版 EXE；只有属于本仓库的 GitHub 下载 URL 会被采用。草稿、预发布、接口失败、限流或缺少对应附件时，保留有效的 Releases 页面入口。不会引用草稿附件，也不会把本机文件路径写进网站。Windows 主入口仅匹配 `Codex Pulse-Setup-版本-x64.exe`（空格或连字符均支持），支持应用内更新；便携版作为次要入口，需手动更新。正式 Release 尚未上传 Setup 时，主入口继续指向 Releases，不会误用便携版。

Windows 访问者高亮 Windows 主下载按钮；Mac 浏览器无法可靠判断芯片架构，因此两个 Mac 按钮保持同等优先级，由用户选择。未知系统和禁用 JavaScript 时不默认推荐某个安装包。

## GitHub Pages

部署项目子路径时：

```sh
SITE_URL=https://fluenthaze.github.io BASE_PATH=/codex-pulse npm run build
```

将 `dist/` 作为 Pages 构建产物。使用自定义域名时设置 `SITE_URL` 为真实域名，`BASE_PATH=/`。所有静态图片路径都使用 Astro 的 `BASE_URL`，可兼容子路径。

已提供 `.github/workflows/website.yml`：推送到 `main` 且修改 `website/**` 或该工作流时自动部署；仅修改桌面应用不触发。同时保留 Actions 中的手动运行入口。仓库 Settings → Pages 的 Source 需设为 GitHub Actions。

## 内容与隐私

- 页面只调用公开 GitHub Releases API，不接触应用账号、本机 Codex、聊天或 Token。
- 没有分析追踪、Cookies、表单或用户数据库。
- Mac 安装指引明确说明本地签名与 Apple 公证的区别，不引导关闭 Gatekeeper。
- 示例图中的额度与图表数据用于产品展示，不代表访问者的真实用量。

## 多语言与主题

- 简体中文 `/`、繁体中文 `/zh-TW/`、英语 `/en/`、日语 `/ja/`、韩语 `/ko/`（均相对于部署 base）。
- 首次访问根地址保持可抓取的简体中文页面，根据浏览器语言显示切换建议；不强制跳转。已保存的手动选择仍会生效，显式语言网址不自动跳转。导航切换会记住选择，并保留锚点。
- 翻译集中在 `src/i18n/messages.json`，每项依次为英语、繁体中文、日语、韩语；中文原文作为 key。页面正文、安装指引、FAQ、示意图和动态下载状态均本地化。
- 每种语言有独立 canonical、hreflang 和本地化标题/描述，可在禁用 JavaScript 时阅读。
- 语言与主题使用自定义菜单，支持方向键、Home/End、Enter/空格、Esc、点击外部关闭；键盘焦点使用内描边，已选项使用勾选标记。
- 主题提供跟随系统（默认）、浅色、深色，首屏前应用偏好；跟随系统时响应系统切换。
- 只在浏览器本地保存 `pulse-language`、`pulse-theme`，不向服务器发送偏好。

## 仓库文档链接

官网各语言的 GitHub 入口分别指向根目录简体中文 README 或 `docs/README.{locale}.md`。中文数据说明保留 `#数据和连接`，其他语言使用稳定的 `#data-and-connection`。修改 README 标题时必须保留这些锚点；发布文档与官网链接时应在同一提交中更新。

## SEO 与 Google 收录

- 所有语言预渲染为完整 HTML，包含本地化标题和描述、独立 canonical、互相对应的 hreflang、Open Graph/Twitter 分享信息及 WebSite/WebPage/SoftwareApplication JSON-LD。
- 站点地图地址为 `https://fluenthaze.github.io/codex-pulse/sitemap.xml`，包含五种语言及语言互链。使用部署环境的 `SITE_URL` 和 `BASE_PATH` 生成地址，不写死开发服务器。
- 在 [Google Search Console](https://search.google.com/search-console/) 添加网址前缀资源 `https://fluenthaze.github.io/codex-pulse/`，选择 HTML 标记验证。将 Google 提供的 meta 标记中的 `content` 值保存到仓库 Settings → Secrets and variables → Actions → Variables 的 `GOOGLE_SITE_VERIFICATION`，再手动运行官网工作流，即可将验证标记加入构建后的 HTML。此配置不会自行建立或验证 Search Console 资源。
- 验证后在「站点地图」提交 `sitemap.xml`，再用「网址检查」检查首页与各语言页面，并按需请求编入索引。抓取、收录和排名由 Google 决定，添加 SEO 标签或提交站点地图不能保证收录时间与排名。
- GitHub Pages 项目站点的 `robots.txt` 必须位于域名根目录 `https://fluenthaze.github.io/robots.txt` 才生效；项目下的 `/codex-pulse/robots.txt` 无法替代。当前无需设置抓取限制，因此不生成无效的子目录 robots.txt。若将来添加根目录 robots，必须允许官网路径。
- 首页首次访问不按浏览器语言强制重定向，语言版本通过真实链接互相连接；用户明确保存的语言偏好仍会保留。

各平台可独立发布：最新 Release 缺少某个平台附件时，会从最近 10 个公开正式 Release 查找该目标最新可用的附件，并在卡片显示其版本；不会将旧版 Mac 包冒充为新版。
