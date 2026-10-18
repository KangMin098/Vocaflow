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

## B. 사람 Gold — R5 창작 9문항(v2)

- 콘텐츠: `apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json`(세트 `r5-central-meaning.v2` · 주석 ref 끝 `.v2`) · SHA-256 `1ef87458bba79bdc816354a69798d63bcd0247be60c872b76e5fc52263d375dc(설명 글 문장 번호 1부터 변환 뒤 — 내용 판단은 v2 그대로)`
- 평가 계약: 정답 = 한 줄 요지 선택 ✓ **그리고** 중심 문장 ✓(주장 또는 그 다시 말하기 문장). 근거 · 관계는 피드백. 화면 발문에 「같은 뜻을 다시 말한 문장도 돼요」를 명시해 발문 ↔ 채점을 맞췄다.
- v2 변경(AI 검토 반영 · 사람 승인 아님): 정답 선택지 바꿔 쓰기 3건(ind-2 · transfer-2 · delayed-1) · transfer-1 약한 오답 2건 강화 · 오답 근거 감사 반영(guided-1 한 줄 요지 과장 「가장」→「매우」 · guided-2 오답① 유형 · 설명 문구 4건 · teach 단계 문장 번호).
- AI 검토 기록(사람 승인 아님 · `docs/final/review/`): A · B 9/9 정답 일치(v1) · C 수정 5문항 5/5 · D v2 수정 4문항 4/4(방어 가능한 다른 선택지 0, 노출 mild) · 오답 근거 감사(9문항 정답 유일, 2문항 수정 → 반영).
- **사람이 판단할 쟁점**
  1. 다시 말하기 문장을 중심 문장으로 인정하는 채점(item-1 · 2 · 7 에서 맹검 2인이 갈렸다)이 타당한가.
  2. delayed-1 정답은 D 검토 뒤 한 번 더 바꿨다(「일하는 시간을 헛되지 않게」) — 최종 문구를 사람이 확인.
  3. transfer-1 의 0번 문장을 supportDisputed 로 둔 판단(반박되는 믿음의 일부로 볼 여지 · 감사 지적).
  4. 오답 설계 유형 라벨(too_narrow · distorted 등)이 학습자 피드백으로 적절한가.
- 평가 역할 6문항(ind ×2 · transfer ×2 · delayed ×2)만 사람 Gold 가 필수. 교수 · 안내 3문항은 Gold 없이 공급 가능(권리는 필요).

## B2. 사람 Gold — TASK 확장 16세트(각 6문항 · 평가 역할 4문항씩)

> 형식별 채점 계약: `apps/web/src/lib/knowledge/authored/formats.ts` · 작성 계약 `docs/final/AUTHORING_SPEC.md`. AI 작성 → 맹검 검토(`docs/final/review/expansion-*.json`) → 저자 수정까지. **사람 Gold 아님.**

| TASK | 세트 · SHA-256 | 형식 · 정답 조건 | 사람이 판단할 쟁점 |
|---|---|---|---|
| e.evidence_location | `e-evidence-location.v1.json` · `df069509…5c0eb` | choice_evidence — 선택 ✓ + 결정 근거 포함 + 범주 밖 근거 없음 | ev-delayed-1 결정 문장 단일화 결과 · ev-transfer-1 요약문 제외 안내 문구 |
| e.option_correspondence | `e-option-correspondence.v1.json` · `c49e67cf…3af` | 선지 5개 판정 전부 ✓ + 정답 선지 대응 문장 ✓ | 판정 경계(distorted/reversed) — 전부 맞아야 정답이라 경계 선지는 사람이 확정 |
| r.inference | `r-inference.v1.json` · `64684742…7962d` | choice_evidence(함축 · 추론) | inf-transfer-1 새 정답이 「추론」 난이도로 충분한가 · 밑줄 문장 evidenceAlt 처리 |
| r.relation | `r-relation.v1.json` · `9ce1b82d…cad98b` | 쌍마다 관계 ✓(허용 대안 포함) | 연결어 없는 쌍의 관계 단일성 · conclusion 범주 추가 타당성 |
| s.form_scope | `s-form-scope.v1.json` · `4a89359b…375dc` | 틀린 밑줄 ✓ + 틀린 이유 ✓ | gs-transfer-1 its/their 지칭(반론 가능성) · 이유 범주 라벨 |
| v.contextual_sense | `v-contextual-sense.v1.json` · `4bbc973c…d5798` | 뜻 ✓ + 근거 문장 ✓ | 오답 뜻이 사전에 실재하는 뜻인지 · 전이 문항의 형식 차이가 약함 |

| r.reference | `r-reference.v1.json` · `f97e7591…668f1` | choice_evidence | 전이 문항(생각 전체를 가리키는 this)의 결정 문장 선택 |
| v.multiword | `v-multiword.v1.json` · `103170d3…5bb52` | contextual_sense | mw-teach-1 정답 「원인으로 설명하다」 — 일부 차지 해석 여지 |
| r.discourse_function | `r-discourse-function.v1.json` · `78fda0a7…3a1c6` | discourse_roles | 허용 대안 역할의 관대함 · df-teach-1 틀 유사 |
| r.discourse_structure | `r-discourse-structure.v1.json` · `3592c1cd…46064` | discourse_roles | transfer 함의(주제문)/실천 결론 구분 · support 쏠림 |
| e.task_demand | `e-task-demand.v1.json` · `dce3db70…e0d55` | demand_choice | 요약문 상자 표시 · 오답 착오 유형 분류 |
| s.sentence_core | `s-sentence-core.v1.json` · `e2e0af18…0323f` | segment_choice | 도치 문항을 지연 확인에 둔 역할 배치 |
| s.attachment | `s-attachment.v1.json` · `aed0b882…42c40` | segment_choice | at-teach-1 문맥 근거 필요 · at-transfer-1 난이도 |
| s.chunk_boundary | `s-chunk-boundary.v1.json` · `7d46162c…5357b` | segment_choice | cb-guided-1 줄어든 관계절 혼동 강도 |
| s.structural_relation | `s-structural-relation.v1.json` · `c83b207f…50362` | segment_choice | sr-ind-2 도치 정답(Never before vs had) |
| v.semantic_relation | `v-semantic-relation.v1.json` · `2e4ae006…d7f87` | equivalence | 관계 방향(A 가 B 에 대해) 학습자 이해 |
- 공통: 설명 글 문장 번호는 화면과 같은 1부터(세트마다 `proseNumbering: "1-based"` 검증).
- 정본 비보류 TASK 21개(V4 · S6 · R7 · E4) 중 창작 세트 보유 **17**. 없는 4: v.core_meaning(기존 WordVault · Flashcard FSRS 모듈이 담당 — 창작 세트 대상 아님) · s.o.sentence_meaning_model · r.o.global_meaning_model · e.o.final_judgment(통합 관찰 — 구성 TASK 수행의 종합이라 단독 창작 세트를 두지 않음, **지원 완료로 표시하지 않음**). 보류 9(L4 · X5)는 대상 밖.
- 6세트(위 표 앞쪽) SHA 는 맹검 1차 반영 뒤 값이다 — 최종 SHA 는 `sha256sum apps/web/src/lib/knowledge/authored/*.json` 로 승인 직전 다시 잰다.

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
