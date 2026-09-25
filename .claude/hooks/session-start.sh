#!/bin/bash
# .claude/hooks/session-start.sh
# Claude Code on the web 전용 — 새 컨테이너에 워크스페이스 의존성을 설치해 lint·typecheck·test 가 바로 돌게 한다.
# 로컬 세션에서는 아무것도 하지 않는다. 재실행 안전(이미 설치돼 있으면 pnpm 이 바로 끝낸다).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 컨테이너에 pnpm 이 없으면 packageManager 에 적힌 버전을 corepack 으로 켠다.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
fi

# 컨테이너에는 Chromium 이 미리 설치돼 있다 — postinstall 에서 브라우저를 받지 않는다.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

pnpm install --frozen-lockfile
