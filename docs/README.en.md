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
| Windows · x64 | `win-x64.exe`; download and run |

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

[Detailed data handling, connection troubleshooting and feature documentation (Simplified Chinese)](technical.zh-CN.md#数据和连接)

## Development

Requires Node.js 22.16+. Building both platforms requires macOS.

```sh
npm ci
npm start           # Build and launch Electron
npm test
npm run probe       # Check the local Codex connection
```

```sh
npm run pack        # Windows + macOS
npm run pack:win    # release/win/
npm run pack:mac    # release/mac/
```

Packaging increments the patch version once per invocation; a regular build does not. The app uses Electron + React + TypeScript; the website uses Astro.

[Technical documentation and platform checks (Simplified Chinese)](technical.zh-CN.md) · [Website development and deployment (Simplified Chinese)](../website/README.md)

Codex Pulse is an independent project, not an official OpenAI product, and is not affiliated with Apple.
