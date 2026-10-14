# B7 출시 전 검수 — 근거 찾기 「다른 글에 적용」 4문항

> 2026-10-14 · 읽기 전용 검수(`scripts/csat/map/v62/b7-audit.mts` → [B7_AUDIT.json](./B7_AUDIT.json)). **이 문서는 출시 승인이 아니다** — 활성화 · 승인 기록은 하지 않았다.
> 판정 근거: 정본 주석 `apps/web/src/lib/knowledge/annotations/evidence-tasks.v1.json`(role=transfer) · 맹검 2차 판정 `docs/csat-learner/v4/content-drafts/REVIEW-second.md` · 개발 DB.

## 문항별 결과

| 항목 | 2024#31 | 2024#33 | 2023#32 | 2025#34 |
|---|---|---|---|---|
| 원문 결속(source textHash · revision) | 있음 | 있음 | 있음 | 있음 |
| 골격 서명 = 현재 골격 | 일치 | 일치 | 일치 | 일치 |
| 정답표(답 · 배점) | ② · 2 | ⑤ · 3 | ② · 2 | ⑤ · 3 |
| 근거 / 채점 제외(disputed) / 빈칸 | s6 · s3 / s4 / s5 | s4 / s5 / s3 | s4 / s2 / s5 | s2 / s3 · s4 · s5 · s6 / s0 |
| 맹검 1차 · 2차 판정 | 유지 · accept | 유지 · accept | 유지 · accept | 유지(위험 표기) · **revise** |
| TASK 수행 적합성(E2 근거 위치) | 판단을 정하는 문장 2개 · 유인 문장 분리 | 직접 근거 1 | 직접 근거 1 · 유인 분리 | 근거가 s2 하나로 좁고, 정답의 두 요소를 직접 말하는 s4 · s6 이 채점 제외 — 「근거 찾기」 채점이 정답 범위를 반만 본다 |
| 확인 묶음과 같은 문항(활성 확인 적용) | 아님 | 아님 | 아님 | 아님 |
| 학습자 노출(첫 시도 원장 사용자) | 0 | 0 | 0 | 0 |
| Reveal/Embargo 보류(시험 · 문항 RPC) | 아님 | 아님 | 아님 | 아님 |
| 적용 행 · 검증 계획 | draft · trial planned | draft · trial planned | draft · trial planned | draft · trial planned |
| 출시 승인(release_approved_by) | 없음 | 없음 | 없음 | 없음 |
| **판정** | **PASS** | **PASS** | **PASS** | **HOLD** |

- **권리 · 원문**: 네 문항 모두 평가원 수능 본시험(2023 · 2024 · 2025)으로, 이미 활성인 확인 문항(2026 · 2025 같은 체제)과 같은 원문 정책 · 공개 경로를 쓴다. 문항별 별도 권리 문서는 없다 — 기존 정책 범위의 판단이며 새 권리 확인을 한 것은 아니다.
- **전이 채점**: 문항 화면(확인 모드 `?check=1`)에서 근거 문장 고르기 — 정본 `evidence` 를 고르면 정답, `disputed` 는 채점에서 빼고, 빈칸 문장은 고를 수 없다. 풀이는 `phase: transfer` 로 남아 직접 확인 판정에 섞이지 않는다(6차 E2E 확인).
- **2025#34 HOLD 이유**: 2차 판정자가 revise(정답 「역할과 관행을 세워 생산 활동을 돕는다」의 두 요소를 s4 · s6 이 각각 직접 말한다 → 근거 또는 채점 범위 재정의 필요). 지금 주석은 두 판정의 공통 근거(s2)만 채점하고 갈린 문장을 모두 빼 둔 상태라, 출시는 가능해도 「근거 찾기」 과제로서 정답 범위가 좁다. 제3 판정(s4 · s6 를 근거로 올릴지)으로 주석 버전을 올린 뒤 다시 검수한다.

## 승인한다면 — 변경 계약(실행하지 않음)

대상: PASS 3행만(2025#34 제외). 가드(`knowledge_applications_guard`)가 채택 항목 · 검증 계획 · 사람 승인자(system:* 거부)를 다시 검사한다.

```sql
-- 승인자 · 사유는 승인하는 사람이 채운다
update public.knowledge_applications
   set status = 'active',
       release_approved_by = '<승인자>',
       release_approved_at = now(),
       release_note = 'B7 2026-10-14 검수 PASS(docs/csat-learner/v62/B7_TRANSFER_AUDIT.md) — 근거 찾기 전이'
 where surface = 'csat_item_task'
   and surface_ref in ('evidence-locate:2024-31', 'evidence-locate:2024-33', 'evidence-locate:2023-32')
   and status = 'draft';
```

- 영향: 학습 지도 「근거 찾기」 묶음의 「다른 글에 적용」 단계가 열린다(3문항 · 계획 2지문). 확인 묶음 · 직접 확인 판정은 바뀌지 않는다.
- 되돌리기: `status = 'paused'` — 가드가 승인 기록을 지운다(다시 켜려면 새 승인). 학습자가 남긴 시도 기록은 지우지 않는다.
- 확인: 적용 뒤 `scripts/csat/map/e2e-map-v5-path.mjs --ws evidence-locate --recheck pass` 로 적용 단계까지 완주(합성 계정 — 학습 효과 증거 아님).
