# FINAL 외부 승인 패키지 — R5 첫 적격 공급(자체 창작)

> 한 번에 확정할 수 있는 사람 입력을 한 곳에 모았다. **아무것도 실행하지 않았다.** 개발 DB `jajenrevcbmrpaliomxv` 기준.
> 승인은 항목별이다 — A 승인이 B · C 승인을 뜻하지 않는다. 원장: [FINAL_LEDGER](./FINAL_LEDGER.md).

## A. DB 변경 — 창작 산출물 · 사람 결정 원장

| 항목 | 값 |
|---|---|
| 목적 | 기출 권리가 막힌 상태에서 첫 적격 공급을 자체 창작 산출물로 연다. 권리 · Gold 사람 결정을 공급 시점에 대조한다 |
| 파일 | `supabase/migrations/_pending_authored_supply.sql` |
| SHA-256 | `9b205b4bed725c5bfdd164757e9656587248fbd9c5617858ddf7160adcec00aa` |
| 전제(실측 2026-10-18) | DB-1 `20261017200000` · DB-2 `20261017200100` · I2 `20261018120000` · G2 `20261018120100` 적용됨 · `content_qualification` 0행 · `workspace_content_delivery` 0행 |
| 새 객체 | 표 3(`authored_item` · `content_human_decision` · `content_human_decision_revocation`) · 함수 10(`authored_item_gold_hash` · `authored_item_revision` · `authored_item_register` · `authored_group_refs` · `content_human_decision_record` · `content_human_decision_revoke` · `content_human_decision_ok` · `supply_human_decisions_ok` · 래퍼 원본 이름 변경 5종 `*_i1/_i2`) |
| 바뀌는 기존 객체 | `content_qualification.artifact_kind` CHECK 에 `authored_item` 추가 · 제약 `content_qualification_authored_bound` 추가 · 래퍼 교체 `supply_artifact_revision` · `supply_learner_exposure` · `supply_annotation_matches` · `workspace_delivery_record` · `supply_delivery_valid` · `r5_exposure_key` · `workspace_delivery_attempt_record`(G2 본문 보존 + `(A)` 표시 줄만) |
| 행 범위 | 기존 행 변경 0 · 백필 0(대상 표 모두 0행) |
| **행동 변화** | 모든 신규 공급(기출 포함)에 철회되지 않은 **권리 결정**(scope ⊇ display · transmit)이 필요해진다 — 지금 공급 0건이라 깨지는 공급 없음 |
| 적용 순서 | 한 트랜잭션. 사전 `/db-checkpoint` → 적용 → 사후 verify(파일 끝 검증 블록이 RLS · 실행권을 확인하고 어긋나면 전체 롤백) |
| 사후 확인 | `select to_regclass('public.authored_item'), to_regprocedure('public.authored_item_register(text,text,text,text,text,text,jsonb,jsonb,text,jsonb)')` · advisor 대조 |
| 실패 · 복구 | 실패 = 트랜잭션 롤백(부분 적용 없음). 적용 뒤 중단 = `revoke execute on function public.authored_item_register(...) , public.content_human_decision_record(...) from authenticated`. 이력 0행일 때만 별도 승인으로 역순 DROP(래퍼 원본 이름 복원) — 행이 생긴 뒤 DROP 금지 |
| 증거 | PGlite 격리 SQL 20건 · 격리 종단 10건(`apps/web/src/lib/csat/{map/v62,authored}/__tests__/*authored*`) |

## B. 사람 Gold — R5 창작 9문항

- 콘텐츠: `apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json` · SHA-256 `bf648b0c9f5301c0058e64f94e31932ffbdbdea52ecc8430b837e53ba6bf97d5`
- 평가 계약: 정답 = 한 줄 요지 선택 ✓ **그리고** 중심 문장 ✓(주장 또는 그 다시 말하기 문장). 근거 · 관계는 피드백.
- AI 맹검(사람 승인 아님): A · B 9/9 정답 일치, 주장 문장은 item-1(3↔6) · item-2(4↔6) · item-7(1↔5)에서 주장/다시 말하기로 갈림 → 채점이 둘 다 인정. 수정된 선택지 5문항 재검토 C 5/5 일치. 기록: `docs/final/review/`.
- **사람이 판단할 쟁점**
  1. 다시 말하기 문장을 중심 문장으로 인정하는 채점(위 3문항)이 타당한가.
  2. item-5(ind-2) · 7(transfer-2) · 8(delayed-1)의 정답 선택지가 주장 문장을 거의 그대로 옮긴다(검토 C 지적) — 그대로 출시할지, 바꿔 쓸지(바꾸면 revision 이 바뀌어 새 ref 로 재등록).
  3. transfer-1 의 오답이 약하다(지엽 · 반대 3개) — 변별력 수용 여부.
- 평가 역할 6문항(ind ×2 · transfer ×2 · delayed ×2)만 사람 Gold 가 필수. 교수 · 안내 3문항은 Gold 없이 공급 가능(권리는 필요).

## C. 권리 — 자체 창작 원저작 확인

- 제작: Claude Opus 5.5(Claude Code 에이전트)가 2026-10-18 이 세션에서 새로 씀. `derivedFrom: []` — 기출 지문을 옮기거나 고쳐 쓰지 않았고 형식(5지선다 요지 · 제목 · 주제)만 따랐다.
- 사용 범위 요청: store · display · transmit (학습자 화면에 원문 전체 표시).
- **사람이 확인할 것**: 문장들이 기존 출판물 · 기출과 실질적으로 같지 않은지(표본 대조), AI 생성물을 서비스 저작물로 쓰는 회사 방침과 맞는지. 확인되면 basis `self_authored_original` 로 기록.
- 기출 원문(2020#24 포함)은 이번 패키지 대상이 아니다 — 두 AI 검토 INSUFFICIENT 유지, 공급 경로에서 제외.

## 승인 후 실행 순서(승인된 단계만)

1. A 적용(승인 러너 · `/db-checkpoint` 앞뒤).
2. 관리자 로그인 세션으로 9문항 `authored_item_register`(인자 = `registrationArgs`) → `content_qualification_record`(FQ1.1).
3. **사람이** C 확인 뒤 `content_human_decision_record('rights', … 'human-reviewed')`, B 확인 뒤 평가 6문항 `('gold', …)` — 에이전트가 대신 기록하지 않는다.
4. `content_release_approve` public(9) · assessment(6).
5. 검증 계정으로 지도 → 「자료 받기」 → `/csat/learn/*` 풀이 → `workspace_delivery_attempt.evidence` 확인 → 지도 복귀(DEV_DB_E2E).
