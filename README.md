# 사용량 (claude-usage-widget)

Claude Code 사용량(세션·주간·모델·크레딧)을 보여주는 맥 전용 데스크톱 위젯.
`/usage`와 같은 Anthropic 공식 엔드포인트를 그대로 읽는다 — API 비용 0.

## 개발
```
npm install
npm test        # 순수 로직 테스트 (정규화·카운트다운·알림 임계치·설정 저장)
npm start       # 위젯 실행
```

## 사용법
- 기본은 접힘(세션 카드 + 요약 미니바). 하단 화살표로 펼침/접힘.
- 핀 버튼: 항상 위 고정 on/off. 새로고침 버튼: 즉시 재조회(10초 쓰로틀).
- 우클릭: 로그인 시 자동 시작 토글, 종료.
- 85%/95% 한도 도달 시 macOS 알림 1회(경계를 다시 넘을 때마다 재알림).

## 설치파일 만들기
```
npm run dist:mac   # dist/mac/사용량.app
```
미서명 앱이라 첫 실행은 **우클릭 → 열기 → 열기**가 필요하다.

## 전제조건
- Claude Code CLI에 로그인되어 있어야 한다 (macOS 키체인의 `Claude Code-credentials`
  항목에서 OAuth 토큰을 읽는다). 다른 앱이 이 항목을 처음 읽을 때 macOS가 접근
  허용을 한 번 묻는데, 정상 동작이다 — "항상 허용"을 선택하면 된다.
- `/usage`와 같은 **비공식** 엔드포인트를 쓴다. Anthropic이 응답 형식을 바꾸면
  위젯은 죽지 않고 "일시적으로 불러올 수 없음"으로 표시된다.

## 데이터 위치
`~/Library/Application Support/claude-usage-widget/settings.json` (창 위치·핀·
접힘 상태·자동 실행 여부)
