# Codex Pulse

[简体中文](../README.md) · **繁體中文** · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

輕巧的 macOS / Windows Codex 額度與 Token 用量監控工具。

[官方網站](https://fluenthaze.github.io/codex-pulse/zh-TW/) · [下載最新版本](https://github.com/FluentHaze/codex-pulse/releases/latest) · [回報問題](https://github.com/FluentHaze/codex-pulse/issues)

## 功能

- 隨時查看額度、重設時間與低額度通知。
- Mac 選單列預覽，Windows 桌面浮動視窗。
- 查看本機對話的每輪 Token、今日用量與每小時趨勢。
- 支援深色、淺色、跟隨系統，以及專案與對話篩選。

## 安裝

需要先安裝 Codex，並以 ChatGPT 帳號登入。若無法連線，可在設定中手動選擇 Codex 執行檔。

| 平台 | 下載檔案 |
| --- | --- |
| Mac · Apple Silicon | `mac-arm64.dmg` 或 `.zip` |
| Mac · Intel | `mac-x64.dmg` 或 `.zip` |
| Windows · x64 | `win-x64.exe`，下載後直接執行 |

### Mac 首次開啟

目前使用本機簽章，尚未經過 Apple 公證。僅在確認下載來自本專案且檔案未遭竄改時操作：

1. 開啟 DMG，將 Codex Pulse 拖入「應用程式」；ZIP 請先解壓縮。
2. 按兩下開啟一次，遇到系統阻擋時選擇「取消」或「完成」。
3. 前往「系統設定 → 隱私權與安全性 → 安全性」，點擊「強制打開」。
4. 依要求以密碼或 Touch ID 驗證，再確認「打開」。

若仍提示「已損毀」或沒有「強制打開」，請使用最新版本並回報問題，不需要關閉系統安全防護。[Apple 官方說明](https://support.apple.com/zh-tw/102445)

<a id="data-and-connection"></a>

## 資料與連線

額度透過本機 Codex `app-server` 讀取；Token 統計來自本機工作階段記錄，可能不完整，不等同於帳單或所有裝置的用量。不複製或儲存登入 Token，不上傳對話正文。重設雷達會讀取公開的第三方資料，預測僅供參考。

[詳細資料說明、連線排查與功能文件（簡體中文）](technical.zh-CN.md#数据和连接)

## 開發

需要 Node.js 22.16+；雙平台打包需在 macOS 上執行。

```sh
npm ci
npm start           # 建置並啟動 Electron
npm test
npm run probe       # 檢查本機 Codex 連線
```

```sh
npm run pack        # Windows + macOS
npm run pack:win    # release/win/
npm run pack:mac    # release/mac/
```

每次打包自動遞增一次修補版本；一般建置不遞增。應用程式使用 Electron + React + TypeScript，網站使用 Astro。

[技術文件與平台驗收（簡體中文）](technical.zh-CN.md) · [網站開發與部署（簡體中文）](../website/README.md)

Codex Pulse 是獨立專案，並非 OpenAI 官方產品，也與 Apple 沒有隸屬關係。
