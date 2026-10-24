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

已提供 `.github/workflows/website.yml`，仅支持手动触发，不会因推送代码自动发布。需要部署时先在仓库 Settings → Pages 将 Source 设为 GitHub Actions，再在 Actions 中手动运行 Deploy website to GitHub Pages。当前未触发部署。

## 内容与隐私

- 页面只调用公开 GitHub Releases API，不接触应用账号、本机 Codex、聊天或 Token。
- 没有分析追踪、Cookies、表单或用户数据库。
- Mac 安装指引明确说明本地签名与 Apple 公证的区别，不引导关闭 Gatekeeper。
- 示例图中的额度与图表数据用于产品展示，不代表访问者的真实用量。
