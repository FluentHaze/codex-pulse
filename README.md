# Codex Pulse

**简体中文** · [繁體中文](docs/README.zh-TW.md) · [English](docs/README.en.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md)

轻巧的 macOS / Windows Codex 额度与 Token 用量监控工具。

[官网](https://fluenthaze.github.io/codex-pulse/) · [下载最新版](https://github.com/FluentHaze/codex-pulse/releases/latest) · [反馈问题](https://github.com/FluentHaze/codex-pulse/issues)

## 功能

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
| Windows · x64 | `win-x64.exe`，下载后直接运行 |

### Mac 首次打开

当前使用本地签名，尚未经过 Apple 公证。仅在确认下载来自本项目且文件未被篡改时操作：

1. 打开 DMG，将 Codex Pulse 拖入「应用程序」；ZIP 请先解压。
2. 双击打开一次，遇到系统拦截时选择「取消」或「完成」。
3. 前往「系统设置 → 隐私与安全性 → 安全性」，点击「仍要打开」。
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
