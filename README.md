# Codex Pulse

**简体中文** · [繁體中文](docs/README.zh-TW.md) · [English](docs/README.en.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md)

轻巧的 macOS / Windows Codex 额度与 Token 用量监控工具。

[官网](https://fluenthaze.github.io/codex-pulse/) · [下载最新版](https://github.com/FluentHaze/codex-pulse/releases/latest) · [反馈问题](https://github.com/FluentHaze/codex-pulse/issues)

## 功能

- 支持简体中文、繁体中文、英语、日语、韩语；在偏好设置中切换，默认跟随系统。
- 随时查看额度、重置时间和低额度通知。
- Mac 菜单栏预览，Windows 桌面悬浮窗。
- 查看本机聊天的每轮 Token、今日用量与小时趋势。
- 支持深色、浅色、跟随系统，以及项目与聊天筛选。

## 安装

需要已安装 Codex，并使用 ChatGPT 账号登录。连接失败时，可在设置中手动选择 Codex 可执行文件。

| 平台 | 下载文件 |
| --- | --- |
| Mac · Apple Silicon | `mac-arm64.dmg` 或 `.zip` |
| Mac · Intel | `mac-x64.dmg` 或 `.zip` |
| Windows · x64 | `Setup-版本-x64.exe` 安装版（支持应用内更新），或 `win-x64.exe` 便携版 |

### Mac 首次打开

当前使用本地签名，尚未经过 Apple 公证。仅在确认下载来自本项目且文件未被篡改时操作：

1. 打开 DMG，将 Codex Pulse 拖入「应用程序」；ZIP 请先解压。
2. 双击打开一次，遇到系统拦截时选择「取消」或「完成」。
3. 双击 DMG 窗口中的「打开隐私与安全性」齿轮入口，向下找到「安全性」，点击 Codex Pulse 旁的「仍要打开」。ZIP 用户请手动前往「系统设置 → 隐私与安全性」。
4. 按要求验证密码或 Touch ID，再次确认「打开」。

若仍提示「已损坏」或没有「仍要打开」，请使用最新版并反馈问题，不需要关闭系统安全保护。[Apple 官方说明](https://support.apple.com/zh-cn/102445)

## 数据和连接

额度通过本机 Codex `app-server` 读取；Token 统计来自本机会话记录，可能不完整，不等同于账单或所有设备的用量。不复制或保存登录 Token，不上传聊天正文。重置雷达会读取公开的第三方数据，预测仅供参考。

[详细数据说明、连接排查与功能文档](docs/technical.zh-CN.md#数据和连接)

## 开发

需要 Node.js 22.16+；双平台打包需在 macOS 上执行。

```sh
npm ci
npm start           # 构建并启动 Electron
npm test
npm run probe       # 检查本机 Codex 连接
```

```sh
npm run pack        # Windows + macOS
npm run pack:win    # release/win/
npm run pack:mac    # release/mac/
```

打包自动递增一次补丁版本；普通构建不递增。应用使用 Electron + React + TypeScript，官网使用 Astro。

[技术文档与平台验收](docs/technical.zh-CN.md) · [官网开发与部署](website/README.md)

Codex Pulse 是独立项目，并非 OpenAI 官方产品，也与 Apple 没有隶属关系。

## 应用内版本更新

Windows 安装版在启动 15 秒后、之后每 6 小时检查 GitHub Releases，可在「偏好设置 → 版本更新」手动检查。发现新版后自动在后台下载，侧栏底部显示进度，下载完成后点击「重启更新」即可静默安装并打开新版；不会在退出时自动安装。

- 首次使用需安装新版的 `Codex Pulse-Setup-版本-x64.exe`，旧版和便携版不能自行获得此能力。便携版保留，并提供下载页面入口。
- macOS 无需开发者账号：同样在启动 15 秒后、之后每 6 小时检查新版，并在后台下载与当前应用架构匹配的 DMG。下载完成后侧栏显示「安装更新」，点击打开 DMG；请退出 Pulse，将新版拖入「应用程序」并确认替换，然后启动新版。系统要求授权时按提示操作。不会自动替换应用或绕过 macOS 安全保护。
- Mac 发布时必须上传同一轮打包生成的 DMG、ZIP 和 `latest-mac.yml`，并使用与版本一致的 `v版本号` 或 `版本号` 标签。更新前检查正式版本、架构、文件大小（清单或响应提供时）及清单中的 SHA-512；完整性校验不等同于 Apple 签名或公证。
- 已校验的 Mac 安装包保存在应用用户数据目录的 `mac-update` 文件夹，下次启动会重新校验并恢复安装提示；下载失败可重试。用户暂不安装时旧版继续运行，安装替换保留原有设置。
- 运行 `npm run pack:win` 会同时生成 NSIS 安装版和便携版。发布时将安装包、对应的 `.blockmap` 和 `latest.yml` 上传至同一个正式 GitHub Release，且 Release 版本必须高于客户端版本；请保留生成的文件名。仅上传便携版不能启用自动更新。
- 更新源固定为 FluentHaze/codex-pulse 的正式 GitHub Releases，不在客户端存放发布 Token。打包不会自动发布。
- 首次上线需用两个递增版本的安装包验收检查、下载、安装及设置保留；Mac 还需真机验收 DMG 挂载、拖入替换、系统授权、稍后安装及重新启动。
