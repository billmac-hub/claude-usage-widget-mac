#!/bin/bash
# 사용량(claude-usage-widget-mac) 설치 스크립트
#   설치/업데이트: curl -fsSL https://raw.githubusercontent.com/billmac-hub/claude-usage-widget-mac/main/install.sh | bash
#   삭제:          curl -fsSL https://raw.githubusercontent.com/billmac-hub/claude-usage-widget-mac/main/install.sh | bash -s -- --uninstall
#
# curl로 받은 파일에는 macOS의 "인터넷에서 받은 파일" 표시(quarantine)가 붙지 않아서
# 서명 없는 앱도 Gatekeeper 경고 없이 열린다. sudo는 쓰지 않는다.
#
# macOS 기본 bash 3.2 호환 — set -u 아래에서 변수 뒤에 한글이 붙으면 크래시하므로
# 문자열 안의 변수는 항상 ${VAR}로 쓴다.
set -euo pipefail

REPO="billmac-hub/claude-usage-widget-mac"
APP_NAME="사용량.app"
ZIP_NAME="ClaudeUsageWidget-mac-arm64.zip"
KEYCHAIN_SERVICE="Claude Code-credentials"
DATA_DIR="${HOME}/Library/Application Support/claude-usage-widget"

# 테스트용 덮어쓰기 (file:// 경로 등)
ZIP_URL="${CUW_ZIP_URL:-https://github.com/${REPO}/releases/latest/download/${ZIP_NAME}}"
SUMS_URL="${CUW_SUMS_URL:-https://github.com/${REPO}/releases/latest/download/SHA256SUMS.txt}"

TMP_DIR=""
STAGE_DIR=""

cleanup() {
  [ -n "${TMP_DIR}" ] && rm -rf "${TMP_DIR}"
  [ -n "${STAGE_DIR}" ] && rm -rf "${STAGE_DIR}"
  return 0
}
trap cleanup EXIT

say()  { printf '%s\n' "$*"; }
fail() { printf '✗ %s\n' "$*" >&2; exit 1; }

# 설치 폴더: /Applications, 쓰기 권한이 없으면 ~/Applications
pick_install_dir() {
  if [ -n "${CUW_INSTALL_DIR:-}" ]; then
    mkdir -p "${CUW_INSTALL_DIR}"
    printf '%s' "${CUW_INSTALL_DIR}"
  elif [ -w /Applications ]; then
    printf '%s' /Applications
  else
    mkdir -p "${HOME}/Applications"
    printf '%s' "${HOME}/Applications"
  fi
}

# 해당 경로에서 실행 중인 앱의 PID. 실행 중 프로세스의 경로는 한글이 분해형(NFD)으로
# 저장돼 있어 조합형(NFC) 패턴으로는 pgrep이 못 찾는다 — 두 형태로 모두 찾는다.
# (이름이 아니라 경로로 찾는 이유: VS Code 등 다른 Electron 앱을 건드리지 않기 위해)
running_pids() {
  local exe nfd
  exe="$1/Contents/MacOS/Electron"
  nfd="$(printf '%s' "${exe}" | iconv -f UTF-8 -t UTF-8-MAC 2>/dev/null || printf '%s' "${exe}")"
  { pgrep -f -- "${exe}" || true; pgrep -f -- "${nfd}" || true; } | sort -u
}

# 해당 경로에서 실행 중인 앱만 종료한다 (다른 위치의 사본은 건드리지 않음)
quit_running_app() {
  local pids i=0
  pids="$(running_pids "$1")"
  [ -n "${pids}" ] || return 0
  say "실행 중인 앱을 종료할게요..."
  # PID 목록이라 단어 분리가 의도된 동작이다
  # shellcheck disable=SC2086
  kill -TERM ${pids} 2>/dev/null || true
  while [ "${i}" -lt 10 ] && [ -n "$(running_pids "$1")" ]; do
    sleep 0.5
    i=$((i + 1))
  done
  pids="$(running_pids "$1")"
  if [ -n "${pids}" ]; then
    # shellcheck disable=SC2086
    kill -KILL ${pids} 2>/dev/null || true
  fi
  return 0
}

uninstall() {
  local removed=0 dir dest
  for dir in "${CUW_INSTALL_DIR:-/Applications}" "${HOME}/Applications"; do
    dest="${dir}/${APP_NAME}"
    if [ -d "${dest}" ]; then
      quit_running_app "${dest}"
      rm -rf "${dest}"
      say "✓ 삭제했어요: ${dest}"
      removed=1
    fi
  done
  [ "${removed}" -eq 1 ] || say "설치된 앱을 찾지 못했어요."
  say "설정 파일은 그대로 두었어요. 지우려면: rm -rf \"${DATA_DIR}\""
}

install() {
  [ "$(uname -s)" = "Darwin" ] || fail "macOS에서만 설치할 수 있어요."
  # 터미널이 Rosetta로 돌면 uname -m이 x86_64로 나오므로 sysctl로 실제 칩을 본다
  [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ] \
    || fail "Apple Silicon(M1 이상) 맥 전용이에요. 인텔 맥은 아직 지원하지 않아요."

  TMP_DIR="$(mktemp -d)"
  say "1/4 내려받는 중..."
  curl -fL --retry 3 --progress-bar -o "${TMP_DIR}/${ZIP_NAME}" "${ZIP_URL}" \
    || fail "내려받기에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요."
  curl -fsSL --retry 3 -o "${TMP_DIR}/SHA256SUMS.txt" "${SUMS_URL}" \
    || fail "체크섬 파일을 받지 못했어요."

  say "2/4 무결성 확인 중..."
  local expected actual
  expected="$(awk -v f="${ZIP_NAME}" '$2 == f { print $1 }' "${TMP_DIR}/SHA256SUMS.txt")"
  actual="$(shasum -a 256 "${TMP_DIR}/${ZIP_NAME}" | awk '{ print $1 }')"
  [ -n "${expected}" ] || fail "SHA256SUMS.txt에서 ${ZIP_NAME} 항목을 찾지 못했어요."
  [ "${expected}" = "${actual}" ] || fail "체크섬이 달라요. 파일이 손상됐을 수 있어 설치를 중단했어요."

  local install_dir dest
  install_dir="$(pick_install_dir)"
  dest="${install_dir}/${APP_NAME}"

  say "3/4 설치 중... (${install_dir})"
  quit_running_app "${dest}"
  # 같은 볼륨 안에서 이름만 바꿔 넣으려고 설치 폴더 안에 임시 폴더를 만든다
  STAGE_DIR="$(mktemp -d "${install_dir}/.cuw-XXXXXX")"
  ditto -x -k "${TMP_DIR}/${ZIP_NAME}" "${STAGE_DIR}"
  [ -d "${STAGE_DIR}/${APP_NAME}" ] || fail "압축 안에서 ${APP_NAME}을 찾지 못했어요."
  xattr -dr com.apple.quarantine "${STAGE_DIR}/${APP_NAME}" 2>/dev/null || true
  codesign --verify --deep --strict "${STAGE_DIR}/${APP_NAME}" 2>/dev/null \
    || fail "앱 검사에 실패했어요. 설치를 중단했어요."
  rm -rf "${dest}"
  mv "${STAGE_DIR}/${APP_NAME}" "${dest}"

  say "4/4 완료!"
  # -w 없이 존재 여부(종료 코드)만 본다 — 토큰은 읽지 않는다
  if ! security find-generic-password -s "${KEYCHAIN_SERVICE}" >/dev/null 2>&1; then
    say ""
    say "⚠ Claude Code 로그인 정보를 찾지 못했어요. 터미널에서 'claude'를 실행해 먼저 로그인해 주세요."
  fi
  say ""
  say "처음 실행하면 macOS가 키체인 접근을 물을 수 있어요. '항상 허용'을 눌러 주세요."
  say "삭제하려면 위 설치 명령 끝에 '| bash -s -- --uninstall'을 붙여 실행하세요."

  if [ -z "${CUW_NO_OPEN:-}" ]; then
    open "${dest}"
  fi
  say "✓ 설치했어요: ${dest}"
}

main() {
  case "${1:-}" in
    --uninstall) uninstall ;;
    "")          install ;;
    *)           fail "알 수 없는 옵션이에요: ${1} (사용 가능: --uninstall)" ;;
  esac
}

main "$@"
