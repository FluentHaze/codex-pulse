# Codex Pulse

[简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [日本語](README.ja.md) · **한국어**

macOS / Windows용 가벼운 Codex 한도 및 토큰 사용량 모니터.

[웹사이트](https://fluenthaze.github.io/codex-pulse/ko/) · [최신 버전 다운로드](https://github.com/FluentHaze/codex-pulse/releases/latest) · [문제 제보](https://github.com/FluentHaze/codex-pulse/issues)

## 기능

- 중국어 간체·번체, 영어, 일본어, 한국어를 지원합니다. 환경설정에서 전환하며 기본값은 시스템 언어입니다.
- 한도, 초기화 시간, 한도 부족 알림을 한눈에 확인합니다.
- Mac 메뉴 막대 미리 보기와 Windows 바탕 화면 위젯을 제공합니다.
- 로컬 대화의 턴별 토큰, 일일 사용량, 시간별 추이를 보여줍니다.
- 다크·라이트·시스템 테마와 프로젝트·대화 필터를 지원합니다.

## 설치

먼저 Codex를 설치하고 ChatGPT 계정으로 로그인하세요. 연결되지 않으면 설정에서 Codex 실행 파일을 직접 선택할 수 있습니다.

| 플랫폼 | 다운로드 |
| --- | --- |
| Mac · Apple Silicon | `mac-arm64.dmg` 또는 `.zip` |
| Mac · Intel | `mac-x64.dmg` 또는 `.zip` |
| Windows · x64 | `win-x64.exe` 다운로드 후 실행 |

### Mac에서 처음 실행하기

현재 로컬 서명을 사용하며 Apple 공증은 받지 않았습니다. 이 프로젝트에서 다운로드한 파일이고 변조되지 않았는지 확인한 후 진행하세요.

1. DMG를 열고 Codex Pulse를 응용 프로그램으로 드래그하세요. ZIP은 먼저 압축을 해제하세요.
2. 한 번 실행해 보세요. macOS가 차단하면 취소 또는 완료를 선택하세요.
3. 시스템 설정 → 개인정보 보호 및 보안 → 보안에서 그래도 열기를 선택하세요.
4. 암호 또는 Touch ID로 인증하고 열기를 확인하세요.

여전히 손상되었다고 표시되거나 그래도 열기가 없으면 최신 버전을 사용하고 문제를 제보하세요. 시스템 보안 보호를 끌 필요는 없습니다. [Apple 안내](https://support.apple.com/ko-kr/102445)

<a id="data-and-connection"></a>

## 데이터 및 연결

한도는 로컬 Codex `app-server`를 통해 읽습니다. 토큰 통계는 로컬 세션 기록을 사용하므로 불완전할 수 있으며, 청구 내역이나 모든 기기의 사용량과 같지 않습니다. 로그인 토큰을 복사하거나 저장하지 않고 대화 본문도 업로드하지 않습니다. 초기화 레이더는 공개된 타사 데이터를 사용하며 예측은 참고용입니다.

[데이터 처리·연결 문제 해결·기능 상세 문서(중국어 간체)](technical.zh-CN.md#数据和连接)

## 개발

Node.js 22.16 이상이 필요합니다. 두 플랫폼을 함께 패키징하려면 macOS가 필요합니다.

```sh
npm ci
npm start           # Electron 빌드 및 실행
npm test
npm run probe       # 로컬 Codex 연결 확인
```

```sh
npm run pack        # Windows + macOS
npm run pack:win    # release/win/
npm run pack:mac    # release/mac/
```

패키징할 때마다 패치 버전이 한 번 증가하며 일반 빌드에서는 증가하지 않습니다. 앱은 Electron + React + TypeScript, 웹사이트는 Astro를 사용합니다.

[기술 문서 및 플랫폼 검증(중국어 간체)](technical.zh-CN.md) · [웹사이트 개발 및 배포(중국어 간체)](../website/README.md)

Codex Pulse는 독립적인 프로젝트이며 OpenAI 공식 제품이 아니고 Apple과도 제휴 관계가 없습니다.
