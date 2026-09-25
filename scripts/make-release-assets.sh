#!/bin/bash
# 빌드된 dist/mac/사용량.app → 배포용 zip · dmg · SHA256SUMS.txt (dist/release/)
#
# zip은 반드시 ditto로 만든다: 일반 zip은 프레임워크 안의 심볼릭 링크를 깨뜨려서
# 받은 사람에게 "손상되었기 때문에 열 수 없습니다"가 뜬다.
# 파일명에 버전을 넣지 않는다 — install.sh가 releases/latest/download/ 주소로 받기 때문.
set -euo pipefail

cd "$(dirname "$0")/.."

APP="${1:-dist/mac/사용량.app}"
OUT="dist/release"
ZIP="ClaudeUsageWidget-mac-arm64.zip"
DMG="ClaudeUsageWidget-mac-arm64.dmg"

[ -d "${APP}" ] || { echo "✗ ${APP}이 없어요. 먼저 node scripts/package-mac.mjs를 실행하세요." >&2; exit 1; }

echo "1/4 앱 검사"
codesign --verify --deep --strict "${APP}"
ARCHS="$(lipo -archs "${APP}/Contents/MacOS/Electron")"
[ "${ARCHS}" = "arm64" ] || { echo "✗ arm64 전용 빌드여야 해요 (현재: ${ARCHS})" >&2; exit 1; }

rm -rf "${OUT}"
mkdir -p "${OUT}"

echo "2/4 zip 생성 + 해제본 검사"
ditto -c -k --keepParent "${APP}" "${OUT}/${ZIP}"
CHECK="$(mktemp -d)"
trap 'rm -rf "${CHECK}"' EXIT
ditto -x -k "${OUT}/${ZIP}" "${CHECK}"
codesign --verify --deep --strict "${CHECK}/$(basename "${APP}")"

echo "3/4 dmg 생성 (앱 + 응용 프로그램 바로가기)"
STAGE="${CHECK}/dmg"
mkdir -p "${STAGE}"
ditto "${APP}" "${STAGE}/$(basename "${APP}")"
ln -s /Applications "${STAGE}/Applications"
# 러너에서 hdiutil이 간헐적으로 "Resource busy"로 실패해서 재시도한다
for attempt in 1 2 3; do
  if hdiutil create -volname "사용량" -srcfolder "${STAGE}" -ov -format UDZO "${OUT}/${DMG}"; then
    break
  fi
  [ "${attempt}" -lt 3 ] || { echo "✗ dmg 생성에 실패했어요." >&2; exit 1; }
  sleep 3
done

echo "4/4 체크섬"
(cd "${OUT}" && shasum -a 256 "${ZIP}" "${DMG}" > SHA256SUMS.txt)

echo ""
ls -lh "${OUT}"
cat "${OUT}/SHA256SUMS.txt"
