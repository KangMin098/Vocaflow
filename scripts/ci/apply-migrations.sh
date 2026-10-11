#!/usr/bin/env bash
# scripts/ci/apply-migrations.sh
#
# PR 격리 E2E(정책 v1.1 · 2026-10-11) — 러너 안의 로컬 Supabase(빈 DB)에 저장소 마이그레이션을 **파일 하나씩** 적용한다.
#   · supabase start 의 자동 적용은 첫 실패에서 멈춰 그 뒤 수백 개를 못 본다 → 파일마다 단일 트랜잭션으로 적용하고 실패만 기록
#   · `_pending_*` 제안본은 적용 대상이 아니다
#   · 실패 목록을 supabase/ci/known-migration-failures.txt(빈 DB 에서 원래 안 서는 것 — 개발 DB 에서 수작업 · 확장 의존 등)와 비교해
#     **새로 실패한 마이그레이션이 있으면 exit 1** — 새 마이그레이션이 빈 DB 에서 서지 않는 것을 PR 에서 잡는다
#   · 기준 목록에 있는데 이제 성공하는 것은 알림만(목록에서 지우면 된다)
#
#   bash scripts/ci/apply-migrations.sh <마이그레이션 폴더> <DB URL>
set -u
DIR="${1:?마이그레이션 폴더}"
DB="${2:?DB URL}"
KNOWN="supabase/ci/known-migration-failures.txt"
FAILED="$(mktemp)"
ok=0
for f in $(ls "$DIR"/*.sql | sort); do
  name="$(basename "$f")"
  case "$name" in _pending*) continue ;; esac
  if psql "$DB" -q -X -v ON_ERROR_STOP=1 -1 -f "$f" > /tmp/mig.log 2>&1; then
    ok=$((ok + 1))
  else
    echo "$name" >> "$FAILED"
    echo "::warning::마이그레이션 실패 $name — $(grep -m1 -E 'ERROR' /tmp/mig.log | cut -c1-220)"
  fi
done
nfail=$(wc -l < "$FAILED" | tr -d ' ')
echo "적용 성공 $ok · 실패 $nfail"
touch "$KNOWN"
new=$(grep -vxF -f <(grep -v '^#' "$KNOWN" | sed '/^$/d') "$FAILED" || true)
fixed=$(grep -v '^#' "$KNOWN" | sed '/^$/d' | grep -vxF -f "$FAILED" || true)
[ -n "$fixed" ] && echo "::notice::기준 목록에 있지만 이제 성공 — 목록에서 지울 것: $(echo $fixed)"
if [ -n "$new" ]; then
  echo "::error::빈 DB 에서 새로 실패한 마이그레이션(기준 목록 밖):"
  echo "$new"
  cp "$FAILED" migration-failures.txt
  exit 1
fi
cp "$FAILED" migration-failures.txt
echo "새 실패 없음(기준 목록 $(grep -vc '^#' "$KNOWN" 2>/dev/null || echo 0)줄)"
