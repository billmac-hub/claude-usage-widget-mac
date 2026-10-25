# 사용량 (claude-usage-widget-mac)

Claude Code 사용량(세션·주간·모델·크레딧)을 보여주는 **맥 전용** 데스크톱 위젯이에요.
`/usage`와 같은 Anthropic 공식 엔드포인트를 그대로 읽어와요. (Apple Silicon M1 이상)
macOS 13 이상 필요해요(Electron 45).

## 설치 (추천)

터미널에 아래 한 줄을 붙여 넣으면 끝이에요. 경고 창 없이 바로 설치돼요.

```
curl -fsSL https://raw.githubusercontent.com/billmac-hub/claude-usage-widget-mac/main/install.sh | bash
```

## 직접 받아서 설치

1. [Releases](../../releases)에서 `.dmg`를 받아 **응용 프로그램**으로 끌어다 놓아요.
2. 처음 실행하면 macOS가 막아요(서명 안 된 앱이라 그래요). **시스템 설정 → 개인정보 보호 및
   보안** 맨 아래 **"그래도 열기"** → 암호 입력 순서로 열어 주세요. (macOS 15부터는 우클릭 → 열기 불가)
3. "손상되었기 때문에 열 수 없습니다"가 뜨면 이 한 줄을 실행해 주세요.
   `xattr -dr com.apple.quarantine /Applications/사용량.app`

## 이건 미리 있어야 해요

- **Claude Code CLI 로그인**이 되어 있어야 해요. 키체인의 `Claude Code-credentials`에서 토큰을
  읽는데, 접근 허용을 물으면 **"항상 허용"** 을 눌러 주세요.
- 토큰은 **Anthropic 공식 API(`api.anthropic.com`)로만** 보내요. 소스(`src/main/usage.js`)와
  설치 스크립트가 공개돼 있고, 내려받은 파일은 체크섬으로 검증해요.

## 사용법

- 기본은 접힘(세션 카드 + 요약 미니바)이에요. 하단 화살표로 펼치고 접을 수 있어요.
- 핀 버튼: 항상 위 고정 on/off. 새로고침 버튼: 즉시 재조회(10초에 한 번만 반영돼요).
- 메뉴바 아이콘: 클릭하면 보이기/숨기기, 우클릭하면 자동 시작·종료 메뉴가 나와요.
- 85%/95% 한도에 도달하면 알림이 한 번 떠요. 응용 프로그램 폴더 밖에서 실행하면 옮길지 물어봐요.
- **비공식** 엔드포인트라, 응답 형식이 바뀌면 위젯이 멈추는 대신 "일시적으로 불러올 수 없음"이라고 보여줘요.

## 업데이트 · 삭제

- 업데이트: 설치 명령을 다시 실행하세요. (자동 업데이트는 아직 없어요.)
- 삭제: 설치 명령 끝에 `| bash -s -- --uninstall`을 붙여 실행하세요. 설정 파일은 남겨 둬요.

## 개발

```
npm install && npm test   # 순수 로직 테스트
npm start                 # 위젯 실행
npm run dist:mac          # dist/mac/사용량.app
npm run release:assets    # dist/release/ (zip · dmg · 체크섬)
# 배포: 버전을 올리고 git tag vX.Y.Z && git push --tags → Actions가 Release 생성
```
