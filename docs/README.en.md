# Codex Pulse

[简体中文](../README.md) · [繁體中文](README.zh-TW.md) · **English** · [日本語](README.ja.md) · [한국어](README.ko.md)

A lightweight Codex limits and token usage monitor for macOS and Windows.

[Website](https://fluenthaze.github.io/codex-pulse/en/) · [Download latest](https://github.com/FluentHaze/codex-pulse/releases/latest) · [Report an issue](https://github.com/FluentHaze/codex-pulse/issues)

## Features

- Simplified Chinese, Traditional Chinese, English, Japanese and Korean; switch in Preferences or follow the system language.
- Check limits, reset times and low-limit alerts at a glance.
- Mac menu bar previews and a Windows desktop widget.
- Per-turn tokens, daily usage and hourly trends from local conversations.
- Dark, light and system themes, with project and conversation filters.

## Install

Install Codex and sign in with your ChatGPT account first. If Pulse cannot connect, select the Codex executable in Settings.

| Platform | Download |
| --- | --- |
| Mac · Apple Silicon | `mac-arm64.dmg` or `.zip` |
| Mac · Intel | `mac-x64.dmg` or `.zip` |
| Windows · x64 | `Setup-version-x64.exe` installer (in-app updates), or `win-x64.exe` portable edition |

### First launch on Mac

The app is locally signed and has not been notarized by Apple. Only proceed if the download comes from this project and the file has not been modified:

1. Open the DMG and drag Codex Pulse into Applications. Extract ZIP archives first.
2. Try opening the app once. If macOS blocks it, choose Cancel or Done.
3. Open System Settings → Privacy & Security → Security, then choose Open Anyway.
4. Authenticate with your password or Touch ID and confirm Open.

If it still says “damaged” or Open Anyway is unavailable, use the latest version and report the issue. You do not need to disable system security protections. [Apple's guide](https://support.apple.com/en-us/102445)

<a id="data-and-connection"></a>

## Data and connection

Limits are read through the local Codex `app-server`. Token counts come from local session records, may be incomplete, and are not billing totals or usage across all devices. Pulse does not copy or store sign-in tokens or upload conversation text. Reset radar uses public third-party data; predictions are for reference only.

[Detailed data handling, connection troubleshooting and feature documentation (Simplified Chinese)](usage.zh-CN.md#连接与数据问题)

## Start using Pulse

1. Open Pulse after signing in to Codex. Check your account and limits in Limits overview.
2. Open Today’s usage for daily totals, or Token details for usage and messages by conversation turn.
3. Use Reset radar for calendar records and announcements; configure notifications, language and theme in Preferences.

Charts default to Hour. The overview offers Minute, Hour and Day; Today’s usage offers Minute and Hour. Minute compares today and yesterday with paired columns and supports browsing within today. Hour shows today’s fixed hourly range with yesterday as a reference. Day shows the last 15 days.

Today’s usage lets you switch between exact and compact numbers and copy complete totals. The message drawer supports previous/next turns and copying per-turn usage. Recent conversations and the conversation list refresh every 30 seconds while visible and when shown again. The reset rhythm chart shows up to eight confirmed intervals with day counts, dates and reference ticks. Layouts adapt to the window width, and animations respect the system’s reduced-motion setting.

## Update the app

A persistent update card above the account area shows the new version and download progress, with View update or Restart and install actions. In narrow windows it stays at the top of the content area.

Open Preferences → Version updates. The Windows installer edition downloads updates in the background; choose Restart and install when ready. For the portable edition, download the new executable and replace the old one after closing it. On Mac v0.1.35 and later, choose Restart and install after downloading. Pulse verifies the update, replaces the app and reopens it; approve the macOS authorization prompt if required. Mac v0.1.34 and earlier require one manual upgrade: quit Pulse, replace the app in Applications and reopen it. Existing settings are retained.

## Help and documentation

- [Usage guide and troubleshooting (Simplified Chinese)](usage.zh-CN.md)
- [Report an issue](https://github.com/FluentHaze/codex-pulse/issues): include your OS, app version, reproduction steps and redacted screenshots.
- [Contributor and maintenance documentation (Simplified Chinese)](../CONTRIBUTING.md)

Codex Pulse is an independent project, not an official OpenAI product, and is not affiliated with Apple.
