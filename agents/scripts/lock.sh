#!/usr/bin/env bash
# agents/scripts/lock.sh — lock.mjs 의 얇은 래퍼(지시문의 .sh 이름 유지). 본체는 Windows 에서도 도는 Node.
exec node "$(dirname "$0")/lock.mjs" "$@"
