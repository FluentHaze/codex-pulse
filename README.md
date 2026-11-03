# Codex Pulse

**简体中文** · [繁體中文](docs/README.zh-TW.md) · [English](docs/README.en.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md)

轻巧的 macOS / Windows Codex 额度与 Token 用量监控软件。在菜单栏或桌面悬浮窗看额度，在详情窗口查看用量和重置时间。

[官网](https://fluenthaze.github.io/codex-pulse/) · [下载最新版](https://github.com/FluentHaze/codex-pulse/releases/latest) · [使用指南](docs/usage.zh-CN.md) · [反馈问题](https://github.com/FluentHaze/codex-pulse/issues)

## 下载与安装

先安装 Codex，并使用 ChatGPT 账号登录，再下载对应系统的 Codex Pulse 安装包。

| 平台 | 推荐下载 | 其他选择 |
| --- | --- | --- |
| Mac · Apple Silicon（M 系列） | `mac-arm64.dmg` | `mac-arm64.zip` |
| Mac · Intel | `mac-x64.dmg` | `mac-x64.zip` |
| Windows · x64 | `Setup-版本-x64.exe` 安装版，支持应用内更新 | `win-x64.exe` 便携版，下载后直接运行 |

Windows 用户运行 Setup 安装包，按向导完成安装。Mac 用户打开 DMG，将 Codex Pulse 拖入「应用程序」。官网会显示各平台可下载的版本，也可以在 Releases 的 Assets 中选择安装包。

### Mac 首次打开

当前使用本地签名，尚未经过 Apple 公证。仅在确认下载来自本项目且文件未被篡改时操作：

1. 打开 DMG，将 Codex Pulse 拖入「应用程序」；ZIP 请先解压。
2. 双击打开一次，遇到系统拦截时选择「取消」或「完成」。
3. 双击 DMG 中的「打开隐私与安全性」入口，在「安全性」中找到 Codex Pulse 并点击「仍要打开」。ZIP 用户请手动前往「系统设置 → 隐私与安全性」。
4. 按要求验证密码或 Touch ID，再次确认「打开」。

若仍提示「已损坏」或没有「仍要打开」，请使用最新版并反馈问题，不需要关闭系统安全保护。[Apple 官方说明](https://support.apple.com/zh-cn/102445)

## 开始使用

1. 启动 Codex Pulse，等待连接本机 Codex。连接失败时，在「偏好设置」中手动选择 Codex 可执行文件。
2. 在 Mac 菜单栏或 Windows 悬浮窗查看额度，打开详情窗口查看「额度概览」。
3. 在「今日用量」查看当天 Token 合计，在「Token 明细」选择本机聊天查看逐轮用量与消息。
4. 在「重置雷达」查看重置日历和公告；按需开启低额度通知、重置提醒和登录启动。

[完整使用指南与常见问题](docs/usage.zh-CN.md)

## 主要功能

- 查看额度、个人重置时间和低额度通知；Mac 菜单栏预览，Windows 桌面悬浮窗。
- 查看本机聊天的每轮 Token、消息及仍可读取的本地图片，支持项目和聊天筛选。
- 额度概览提供分钟、小时、日视图，默认小时；今日用量提供分钟、小时视图。分钟通过并列柱形对比今日与昨日，支持当天内拖动和缩放；小时固定展示当天，日固定展示最近 15 天。
- 分钟柱形保持最小宽度，底部选区支持拖动和调整两端；小时、日视图固定范围。
- 重置雷达提供日历、公告与历史节奏，提醒和日历导出可按需使用。
- 支持简体中文、繁体中文、英语、日语、韩语，以及深色、浅色、跟随系统主题。

各版本的功能变化请查看[发布记录](https://github.com/FluentHaze/codex-pulse/releases)。

## 更新软件

在「偏好设置 → 版本更新」检查更新：

- **Windows 安装版**：新版在后台下载，下载完成后点击「重启并安装」。
- **Windows 便携版**：从下载页面获取新版，退出旧版后替换使用。
- **Mac（v0.1.35 起）**：应用内下载匹配架构的 DMG 后点击「重启并安装」，自动校验、替换应用并重新打开；需要管理员权限时按系统提示授权。

Mac v0.1.34 及更早版本需先手动退出、替换并打开新版一次，之后即可使用自动安装。

暂不安装时可以继续使用旧版。Windows 安装版和 Mac 会自动检查新版，也可以手动检查；更新时保留已有设置。

## 数据和连接

额度通过本机 Codex `app-server` 读取，Token 统计来自本机会话记录，可能不完整，不等同于账单或所有设备的用量。不复制或保存登录 Token，不上传聊天正文。切换账号后，请核对详情窗口中的账号与额度；本机 Token 历史不会按当前登录账号自动分开。

重置与公告数据来自 [codex-reset.com](https://codex-reset.com/)，预测仅供参考。全局重置通知和个人窗口提前 15 分钟提醒默认关闭，需开启并保持 Pulse 在后台运行。[数据说明与连接排查](docs/usage.zh-CN.md#连接与数据问题)

## 其他文档

- [文档目录](docs/README.md)：使用指南、版本记录和维护资料。
- [反馈问题](https://github.com/FluentHaze/codex-pulse/issues)：附上系统、软件版本、复现步骤及脱敏截图。
- [贡献与维护](CONTRIBUTING.md)：供准备修改项目的贡献者阅读。

Codex Pulse 是独立开源项目，并非 OpenAI 官方产品，也与 Apple 没有隶属关系。
