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

所有下载按钮默认指向项目的公开 GitHub Releases 列表。页面加载后尝试读取 GitHub 最新的公开正式 Release，并根据架构匹配 DMG、ZIP、EXE；只有属于本仓库的 GitHub 下载 URL 会被采用。草稿、预发布、接口失败、限流或缺少对应附件时，保留有效的 Releases 页面入口。不会引用草稿附件，也不会把本机文件路径写进网站。

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
- 根地址首次按浏览器语言选择，不支持的语言回退英语；显式语言网址不自动跳转。导航切换会记住选择，并保留锚点。
- 翻译集中在 `src/i18n/messages.json`，每项依次为英语、繁体中文、日语、韩语；中文原文作为 key。页面正文、安装指引、FAQ、示意图和动态下载状态均本地化。
- 每种语言有独立 canonical、hreflang 和本地化标题/描述，可在禁用 JavaScript 时阅读。
- 语言与主题使用自定义菜单，支持方向键、Home/End、Enter/空格、Esc、点击外部关闭；键盘焦点使用内描边，已选项使用勾选标记。
- 主题提供跟随系统（默认）、浅色、深色，首屏前应用偏好；跟随系统时响应系统切换。
- 只在浏览器本地保存 `pulse-language`、`pulse-theme`，不向服务器发送偏好。
