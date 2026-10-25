# Codex Pulse

[简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · **日本語** · [한국어](README.ko.md)

macOS / Windows 向けの軽量な Codex 残量・トークン使用量モニター。

[ウェブサイト](https://fluenthaze.github.io/codex-pulse/ja/) · [最新版をダウンロード](https://github.com/FluentHaze/codex-pulse/releases/latest) · [問題を報告](https://github.com/FluentHaze/codex-pulse/issues)

## 機能

- 簡体字中国語・繁体字中国語・英語・日本語・韓国語に対応。環境設定で切り替えでき、既定はシステムの言語です。
- 残量、リセット時刻、残量低下の通知を確認。
- Mac のメニューバープレビューと Windows のデスクトップウィジェット。
- ローカルの会話から、ターン別トークン、一日の使用量、時間別の傾向を表示。
- ダーク・ライト・システム設定のテーマ、プロジェクトと会話の絞り込み。

## インストール

先に Codex をインストールし、ChatGPT アカウントでログインしてください。接続できない場合は、設定で Codex の実行ファイルを選択できます。

| プラットフォーム | ダウンロード |
| --- | --- |
| Mac · Apple Silicon | `mac-arm64.dmg` または `.zip` |
| Mac · Intel | `mac-x64.dmg` または `.zip` |
| Windows · x64 | `win-x64.exe` をダウンロードして起動 |

### Mac での初回起動

現在はローカル署名を使用しており、Apple の公証は受けていません。このプロジェクトから入手した、改変されていないファイルであることを確認してから操作してください。

1. DMG を開き、Codex Pulse を「アプリケーション」にドラッグします。ZIP は先に展開してください。
2. 一度起動します。macOS にブロックされた場合は「キャンセル」または「完了」を選択します。
3. 「システム設定 → プライバシーとセキュリティ → セキュリティ」で「このまま開く」を選択します。
4. パスワードまたは Touch ID で認証し、「開く」を確認します。

「壊れている」と表示される場合や「このまま開く」がない場合は、最新版を使用し、問題を報告してください。システムのセキュリティ保護を無効にする必要はありません。[Apple のガイド](https://support.apple.com/ja-jp/102445)

<a id="data-and-connection"></a>

## データと接続

残量はローカルの Codex `app-server` 経由で取得します。トークン統計はローカルのセッション記録に基づくため、不完全な場合があり、請求や全デバイスの使用量とは一致しません。認証トークンのコピー・保存や、会話本文のアップロードは行いません。リセットレーダーは公開された第三者データを使用し、予測は参考情報です。

[データの取り扱い・接続のトラブルシューティング・機能の詳細（簡体字中国語）](technical.zh-CN.md#数据和连接)

## 開発

Node.js 22.16 以降が必要です。両プラットフォームのパッケージ作成には macOS が必要です。

```sh
npm ci
npm start           # Electron をビルドして起動
npm test
npm run probe       # ローカルの Codex 接続を確認
```

```sh
npm run pack        # Windows + macOS
npm run pack:win    # release/win/
npm run pack:mac    # release/mac/
```

パッケージ作成のたびにパッチバージョンが一度上がります。通常のビルドでは変更されません。アプリは Electron + React + TypeScript、サイトは Astro を使用しています。

[技術文書とプラットフォームの検証（簡体字中国語）](technical.zh-CN.md) · [サイトの開発とデプロイ（簡体字中国語）](../website/README.md)

Codex Pulse は独立したプロジェクトです。OpenAI の公式製品ではなく、Apple との提携関係もありません。
