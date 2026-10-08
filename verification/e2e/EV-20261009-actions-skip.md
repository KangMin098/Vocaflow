# EV-20261009-actions-skip — main 의 CI e2e 와 배포가 실제로는 건너뛰어진다

- 관측: 2026-10-09 (KST) · 관측자: platform-goal (Claude Code) · 방법: `gh run view <id> --log` 로 로그 원문 확인
- 대상 저장소: KangMin098/Vocaflow
- 분류: **directly_verified** (보고서 인용 아님)

| 워크플로 | run id | head sha | 시각(UTC) | 결론 표시 | 로그 원문 |
|---|---|---|---|---|---|
| ci.yml (e2e job) | 37800944745 | 21f26829f10491d69d8e7322c8a172dff97dc023 | 2026-10-08T15:27:39Z | success | `::notice::e2e 건너뜀 — 저장소 시크릿 미설정. Settings → Secrets 에 NEXT_PUBLIC_SUPABASE_URL 등을 넣으면 활성화됩니다.` |
| deploy.yml | 37800695492 | d83600529ff2ad9d27091c046833297cdcbe7f25 | 2026-10-08T15:25:49Z | success | `::notice::배포 건너뜀 — VERCEL_TOKEN / VERCEL_PROJECT_ID 미설정. 이 워크플로 상단 주석에 설정 방법이 있습니다.` |

## 판정

- 두 워크플로 모두 「success」로 끝나지만 실제 e2e 실행 수와 배포 수는 0 이다.
- 정본 policy: `skip_is_pass=false` → **VG-L3-D2-01 = FAIL**, 출시 게이트 **R0-DEPLOY = FAIL**.
- 한계: 같은 날 이후 run 은 보지 않았다. Vercel Git 연동처럼 이 워크플로 밖의 배포 경로가 있는지는 확인하지 않았다(그 경우에도 「E2E skip=0」 조건은 여전히 미충족).

## 재현

```
gh run view 37800944745 --log | grep "e2e 건너뜀"
gh run view 37800695492 --log | grep "배포 건너뜀"
```
