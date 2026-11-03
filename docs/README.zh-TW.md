# Codex Pulse

[简体中文](../README.md) · **繁體中文** · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

輕巧的 macOS / Windows Codex 額度與 Token 用量監控工具。

[官方網站](https://fluenthaze.github.io/codex-pulse/zh-TW/) · [下載最新版本](https://github.com/FluentHaze/codex-pulse/releases/latest) · [回報問題](https://github.com/FluentHaze/codex-pulse/issues)

## 功能

- 支援簡體中文、繁體中文、英語、日語、韓語；可於偏好設定切換，預設跟隨系統。
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
| Windows · x64 | `Setup-版本-x64.exe` 安裝版（支援應用程式內更新），或 `win-x64.exe` 可攜版 |

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

[詳細資料說明、連線排查與功能文件（簡體中文）](usage.zh-CN.md#连接与数据问题)

## 開始使用

1. 登入 Codex 後開啟 Pulse，在「額度概覽」核對帳號及額度。
2. 在「今日用量」查看當日合計，在「Token 明細」選擇本機對話，查看逐輪用量與訊息。
3. 在「重設雷達」查看日曆與公告，在偏好設定調整通知、語言與主題。

圖表預設為「小時」。額度概覽提供分鐘、小時、日，今日用量提供分鐘、小時。分鐘以並列柱形比較今日與昨日，可在今天範圍內拖動和縮放；小時固定顯示當天，並提供昨日參考；日固定顯示最近 15 天。

## 更新軟體

發現新版後，帳號區上方會持續顯示目標版本與下載進度，並提供「查看更新」或「重新啟動並安裝」按鈕；窄視窗會顯示在內容區頂部。

開啟「偏好設定 → 版本更新」。Windows 安裝版會在背景下載新版，完成後點擊「重新啟動並安裝」；可攜版請下載新版，退出舊版後替換。Mac v0.1.35 起，下載完成後點擊「重新啟動並安裝」，自動驗證、取代應用程式並重新開啟；需要管理員權限時依系統提示授權。Mac v0.1.34 及更早版本需先手動退出、取代並開啟新版一次。原有設定會保留。

## 說明與文件

- [使用指南與常見問題（簡體中文）](usage.zh-CN.md)
- [回報問題](https://github.com/FluentHaze/codex-pulse/issues)：提供系統、軟體版本、重現步驟及去識別化截圖。
- [貢獻與維護文件（簡體中文）](../CONTRIBUTING.md)

Codex Pulse 是獨立專案，並非 OpenAI 官方產品，也與 Apple 沒有隸屬關係。
