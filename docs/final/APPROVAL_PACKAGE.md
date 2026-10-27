# FINAL 외부 승인 패키지 — R5 첫 적격 공급(자체 창작)

> **2026-10-22 DB 적용 사실 갱신:** 현재 학습성과 연결 대화에서 사용자가 제시된 7단계 SQL(원장9개·관련 RPC·기존 해설2건 수정)에 직접 `승인`했고 migration `20261021175340`으로 적용했다. A의 원문 SHA `dfb29f2d…c93ac229`는 그 첫 단계에 바이트 그대로 포함됐다. A SQL을 다시 적용하지 않는다. 전체 묶음 승인/서버 이력 SHA는 `e84a9607…312d8d`다. B/B2/C의 개별 콘텐츠 등록·Gold/권리·출시·실제 공급은 이번 실행에 포함하지 않았다. 아래 미적용/쓰기0은 당시 기록이다. [직접 승인 범위·사후 검증](../implementation/learning-outcomes-20261021/06-DB-ACTIVATION-RESULT.md).

> 한 번에 확정할 수 있는 사람 입력을 한 곳에 모았다. **아무것도 실행하지 않았다.** 개발 DB `jajenrevcbmrpaliomxv` 기준.
> 승인은 항목별이다 — A 승인이 B · C 승인을 뜻하지 않는다. 원장: [FINAL_LEDGER](./FINAL_LEDGER.md).

## 2026-10-22 최신 검토 대상 — 이 절과 manifest가 현재 승인 대상

- 최신 fetch 원격 `origin/main f573ef8e5`; 로컬 제품 main `676ab7107`은 원격보다 61커밋 앞선 상태다. 아래 바이트는 로컬 제품 main 기준이며 원격 반영 완료를 뜻하지 않는다.
- **A 적용 완료를 실제 SELECT로 재확인**: migration `20261021175340`, 서버 statements 1개 SHA `e84a9607…312d8d`가 승인 SQL과 일치. A 재적용 불필요.
- 2026-10-22 03:21:08 KST 읽기 전용 실측: 창작 등록/사람 결정/AI 결정/자격/출시 승인/납품/G2/공장 수행 모두 0건. B/B2/C 또는 실제 공급 완료는 확인되지 않는다. 오프라인 검수 여부는 미확인이다.
- 실제 import되는 **18파일·17 TASK·155문항(평가120)**. R5 primary는 파일명 v1이어도 내부 revision은 **v3**이며 SHA가 과거 B의 v2와 다르다. cycle supplement **v2 3문항**은 별도 revision이다. 교수·안내 35문항은 평가 Gold 대상은 아니지만 권리/자격/출시 조건은 필요하다.
- [단일 사람 검토 manifest](./review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json)에 모든 문항 ID·역할·본문/Gold 위치·파일 SHA·문항별 비교 SHA·필요 권리 범위·미작성 결정 양식을 모았다. 본문/Gold를 원파일과 대조해 **선택한 개별 문항과 이 revision만** 결정한다. AI 검수와 사람 결정은 별개다. 아래 역사적 표의 이전 SHA/수량은 현재 승인 대상으로 사용하지 않는다.

| TASK | 파일 · 실제 revision | 문항/평가 | 현재 파일 SHA-256 |
|---|---|---|---|
| r.central_meaning | [r5-central-meaning.v1.json](../../apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json) · `r5-central-meaning.v3` | 11/8 | `682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846` |
| e.evidence_location | [e-evidence-location.v1.json](../../apps/web/src/lib/knowledge/authored/e-evidence-location.v1.json) · `e-evidence-location.v1` | 9/7 | `b98f5d11282528b90740ef78334afb6dc455045ca32768c518552b24140613fe` |
| e.option_correspondence | [e-option-correspondence.v1.json](../../apps/web/src/lib/knowledge/authored/e-option-correspondence.v1.json) · `e-option-correspondence.v1` | 9/7 | `09654111ee813850861249cfb142ce0ec887c36bd65ffd15294911ed5115ea0f` |
| r.inference | [r-inference.v1.json](../../apps/web/src/lib/knowledge/authored/r-inference.v1.json) · `r-inference.v1` | 9/7 | `651ccbe064fbc5ba63feea4e2e3fa3d0522eb378649bffd03f3ffa27cda3902d` |
| r.relation | [r-relation.v1.json](../../apps/web/src/lib/knowledge/authored/r-relation.v1.json) · `r-relation.v1` | 9/7 | `4a8c34feaa40228b3ec2389b6c6a7bd8852f067ba181e708e1285389bf7d5ea0` |
| s.form_scope | [s-form-scope.v1.json](../../apps/web/src/lib/knowledge/authored/s-form-scope.v1.json) · `s-form-scope.v1` | 9/7 | `cedf02062f07755698bd3816f889baf5959942a80dbaceefa334a3dfaafb1604` |
| v.contextual_sense | [v-contextual-sense.v1.json](../../apps/web/src/lib/knowledge/authored/v-contextual-sense.v1.json) · `v-contextual-sense.v1` | 9/7 | `fb8bfaeba6461a2cf94ae65d22c95240c88e9a283f72f2bfaca840c5c3026ddb` |
| r.reference | [r-reference.v1.json](../../apps/web/src/lib/knowledge/authored/r-reference.v1.json) · `r-reference.v1` | 9/7 | `6807473e00f86c456b6500ca8007bc5e497196dc2f1930183d25d6024f5f5ecf` |
| v.multiword | [v-multiword.v1.json](../../apps/web/src/lib/knowledge/authored/v-multiword.v1.json) · `v-multiword.v1` | 9/7 | `179725ab501da614cebd6d2076f475b2123829657e194e462fb579a5f49fb5b6` |
| r.discourse_function | [r-discourse-function.v1.json](../../apps/web/src/lib/knowledge/authored/r-discourse-function.v1.json) · `r-discourse-function.v1` | 9/7 | `a50f17d423ae4b1d09a9970be80ec0e6b9033f949a04f6f0b65f2c23faf1b083` |
| r.discourse_structure | [r-discourse-structure.v1.json](../../apps/web/src/lib/knowledge/authored/r-discourse-structure.v1.json) · `r-discourse-structure.v1` | 9/7 | `3f8345758d6106c7dfc8348004fb5d246903fea70c8cfd32d1644c10b9374a9e` |
| e.task_demand | [e-task-demand.v1.json](../../apps/web/src/lib/knowledge/authored/e-task-demand.v1.json) · `e-task-demand.v1` | 9/7 | `8a91033b38d9ee68108a02422aff00790f0c21b5428facb4c56a2fa78c068bda` |
| s.sentence_core | [s-sentence-core.v1.json](../../apps/web/src/lib/knowledge/authored/s-sentence-core.v1.json) · `s-sentence-core.v1` | 9/7 | `b10859fbc4b7cab9063d306804ee2f2a218deaf9bc861dd47b7ceb7e4843fcc9` |
| s.attachment | [s-attachment.v1.json](../../apps/web/src/lib/knowledge/authored/s-attachment.v1.json) · `s-attachment.v1` | 6/4 | `aed0b88228a2fb9b10182ac2c6fb32f97df05511383c37288b95a01d4d942c40` |
| s.chunk_boundary | [s-chunk-boundary.v1.json](../../apps/web/src/lib/knowledge/authored/s-chunk-boundary.v1.json) · `s-chunk-boundary.v1` | 9/7 | `c7a0526ce33047116682931bc5818e12a05f4f87a2015737783b2e854e02f2de` |
| s.structural_relation | [s-structural-relation.v1.json](../../apps/web/src/lib/knowledge/authored/s-structural-relation.v1.json) · `s-structural-relation.v1` | 9/7 | `d393dfe4bd475fee2b677f2170e176e291694536b092a71eb7ab8834df34b83c` |
| v.semantic_relation | [v-semantic-relation.v1.json](../../apps/web/src/lib/knowledge/authored/v-semantic-relation.v1.json) · `v-semantic-relation.v1` | 9/7 | `2763dfa3786da48773b54f0f74e3eb8dcf0ceeb710924d478aefe94c59995358` |
| r.central_meaning | [r5-cycle-supplement.v2.json](../../apps/web/src/lib/knowledge/authored/r5-cycle-supplement.v2.json) · `r5-central-meaning-cycle.v2` | 3/3 | `408d40fdd5a1e24ec9bf5ce2b5e398e09c86a4dbf9aa16523bb305d41268c08c` |

사람 결정은 B(R5 두 파일)·B2(나머지16 TASK 파일의 평가 문항)·C(선택 문항의 store/display/transmit, 평가에는 assess)를 개별 범위로 남긴다. Gold/권리 결정이 출시 승인이나 데이터 등록·학습자 조작 권한을 자동 부여하지 않는다. 이 문서/manifest 작성은 승인 요청의 중복 생성이나 실제 결정 기록이 아니며 DB 쓰기0이다. s.attachment는 현행 정본 Workspace 미연결·S2/S3 독립성 보류로, T-0083의 학습 전용 진입이 준비 중이고 평가 도구 승격은 포함하지 않는다.

## 이전 패키지 기록(아래 수량·SHA·미적용 문구는 작성 당시 기준)

## 현재 실파일 수량 · 해시(2026-10-21 재계산 · 승인 범위 아님)

| 범위 | 세트 | 문항 | 평가 역할(혼자 확인 · 전이 · 지연 확인) |
|---|---|---|---|
| 전체 실파일 `apps/web/src/lib/knowledge/authored/*.json` | 17 | 152 | 117 |
| R5 `r5-central-meaning`(B) | 1 | 11 | 8 |
| TASK 확장(B2) | 16 | 141 | 109 |
| s.attachment — canon_candidate · Workspace 미연결(정본 hold TASK 아님 · 출시 승인 아님) | 1 | 6 | 4 |
| s.attachment 를 뺀 나머지 | 16 | 146 | 113 |

- 17세트 SHA-256 전부 아래 B · B2 표의 값과 일치. SQL 제안본 `supabase/migrations/_pending_authored_supply.sql` · 배포 사본 `supabase/deploy/authored-supply/20261020090000_authored_supply.sql` 모두 `dfb29f2d…c93ac229`(바이트 불변).
- 아래 표제 · 실행 단계의 「9문항 · 각 6문항 · 9/6」은 그 문단을 쓸 때(FI-011 · T-0068 추가 전)의 수다. **승인 · 등록 · 출시는 사람이 승인한 개별 revision · 역할만** — 위 152 문항을 한꺼번에 자동 출시하지 않는다.
- 개발 DB 관찰(2026-10-21T13:07:50Z · 읽기 전용 SELECT): `authored_item` · `content_human_decision` · `content_human_decision_revocation` 표 없음 · 자격 0 · 납품 0. 오프라인 사람 검수 여부는 이 SELECT 로 단정하지 않는다.
- A 는 스키마 적용 승인이다 — B · B2 · C(Gold · 권리)나 데이터 등록 · 공급 승인이 아니다. 현행 개발 정책(dev-minimal-20261020): SQL · 영향 범위를 제시하고 대화에서 사용자가 승인하면 기존 apply_migration 경로로 적용할 수 있다(지금은 승인 전 · DB 쓰기 0).

## A. DB 변경 — 창작 산출물 · 사람 결정 원장

| 항목 | 값 |
|---|---|
| 목적 | 기출 권리가 막힌 상태에서 첫 적격 공급을 자체 창작 산출물로 연다. 권리 · Gold 사람 결정을 공급 시점에 대조한다 |
| 파일 | `supabase/migrations/_pending_authored_supply.sql` |
| SHA-256 | `dfb29f2dc3c3c0ecf516bdf47efa1d50f2f203ef7d399a60f3072d57c93ac229` (2026-10-18 FI-006 잔여 수정 뒤 · 이전 `9b205b4b…` · `7eac0045…` 승인 대상 아님) |
| 전제(실측 2026-10-18) | DB-1 `20261017200000` · DB-2 `20261017200100` · I2 `20261018120000` · G2 `20261018120100` 적용됨 · `content_qualification` 0행 · `workspace_content_delivery` 0행 |
| 새 객체 | 표 3(`authored_item` · `content_human_decision` · `content_human_decision_revocation`) · 함수 10(`authored_item_gold_hash` · `authored_item_revision` · `authored_item_register` · `authored_group_refs` · `content_human_decision_record` · `content_human_decision_revoke` · `content_human_decision_ok` · `supply_human_decisions_ok` · 래퍼 원본 이름 변경 5종 `*_i1/_i2`) |
| 바뀌는 기존 객체 | `content_qualification.artifact_kind` CHECK 에 `authored_item` 추가 · 제약 `content_qualification_authored_bound` 추가 · 래퍼 교체 `supply_artifact_revision` · `supply_learner_exposure` · `supply_annotation_matches` · `workspace_delivery_record` · `supply_delivery_valid` · `r5_exposure_key` · `workspace_delivery_attempt_record`(G2 본문 보존 + `(A)` 표시 줄만) |
| 행 범위 | 기존 행 변경 0 · 백필 0(대상 표 모두 0행) |
| **행동 변화** | 모든 신규 공급(기출 포함)에 철회되지 않은 **권리 결정**(scope ⊇ display · transmit)이 필요해진다 — 지금 공급 0건이라 깨지는 공급 없음 |
| 적용 순서 | 한 트랜잭션. 사전 `/db-checkpoint` → 적용 → 사후 verify(파일 끝 검증 블록이 RLS · 실행권을 확인하고 어긋나면 전체 롤백) |
| 사후 확인 | `select to_regclass('public.authored_item'), to_regprocedure('public.authored_item_register(text,text,text,text,text,text,jsonb,jsonb,text,jsonb)')` · advisor 대조 |
| 실패 · 복구 | 실패 = 트랜잭션 롤백(부분 적용 없음). 적용 뒤 중단 = `revoke execute on function public.authored_item_register(...) , public.content_human_decision_record(...) from authenticated`. 이력 0행일 때만 별도 승인으로 역순 DROP(래퍼 원본 이름 복원) — 행이 생긴 뒤 DROP 금지 |
| FI-006 동시성 | 창작 공급은 학습자 단위 advisory 잠금 · 평가 역할은 같은 지문 묶음을 이미 받았으면 새 요청 거절(같은 요청 재전송은 영수증). 실제 PostgreSQL 17.10 두 연결 `scripts/csat/map/v62/authored-concurrency.mjs`: 원본 4/6(같은 ref 2행 · 같은 그룹 2행) → 수정 6/6 · 정상 대조군 2행 |
| 권한 | 학습자: `workspace_delivery_record` · `workspace_delivery_attempt_record` · `workspace_delivery_current` 실행 · `supply_delivery_valid` 는 service_role 만 · anon 실행 0(파일 끝 검증 블록) |
| 증거 | PGlite 격리 SQL · 종단 146건(`apps/web/src/lib/csat/{map/v62,authored}/__tests__/*authored*`) · CI 격리 브라우저(R5 + 9형식 × 1280/1440) |

## B. 사람 Gold — R5 창작(v2) · 현재 11문항 · 평가 8(표제를 처음 쓸 때 9문항)

- 콘텐츠: `apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json`(세트 `r5-central-meaning.v2` · 주석 ref 끝 `.v2`) · SHA-256 `78ddc60e5f10dde35c6838b3df211f9a566ddd076bf15e6a7b8ee0b203505d2f`(설명 글 문장 번호 1부터 · 내용 판단은 v2 그대로)
- 평가 계약: 정답 = 한 줄 요지 선택 ✓ **그리고** 중심 문장 ✓(주장 또는 그 다시 말하기 문장). 근거 · 관계는 피드백. 화면 발문에 「같은 뜻을 다시 말한 문장도 돼요」를 명시해 발문 ↔ 채점을 맞췄다.
- v2 변경(AI 검토 반영 · 사람 승인 아님): 정답 선택지 바꿔 쓰기 3건(ind-2 · transfer-2 · delayed-1) · transfer-1 약한 오답 2건 강화 · 오답 근거 감사 반영(guided-1 한 줄 요지 과장 「가장」→「매우」 · guided-2 오답① 유형 · 설명 문구 4건 · teach 단계 문장 번호).
- AI 검토 기록(사람 승인 아님 · `docs/final/review/`): A · B 9/9 정답 일치(v1) · C 수정 5문항 5/5 · D v2 수정 4문항 4/4(방어 가능한 다른 선택지 0, 노출 mild) · 오답 근거 감사(9문항 정답 유일, 2문항 수정 → 반영).
- **사람이 판단할 쟁점**
  1. 다시 말하기 문장을 중심 문장으로 인정하는 채점(item-1 · 2 · 7 에서 맹검 2인이 갈렸다)이 타당한가.
  2. delayed-1 정답은 D 검토 뒤 한 번 더 바꿨다(「일하는 시간을 헛되지 않게」) — 최종 문구를 사람이 확인.
  3. transfer-1 의 0번 문장을 supportDisputed 로 둔 판단(반박되는 믿음의 일부로 볼 여지 · 감사 지적).
  4. 오답 설계 유형 라벨(too_narrow · distorted 등)이 학습자 피드백으로 적절한가.
- **2026-10-19 추가(FI-011 B · 다시 확인 재고)**: `r5-cm-ind-3`(기억과 망각) · `r5-cm-ind-4`(도로와 교통량) 독립 확인 2문항 — 서로 다른 지문 · 기존 9문항 내용 · 순서 불변. **맹검 검토 대기 · 사람 Gold 대기 · 권리 대기**(이전 revision 승인 승계 없음).
- 평가 역할 8문항(ind ×4 · transfer ×2 · delayed ×2)만 사람 Gold 가 필수. 교수 · 안내 3문항은 Gold 없이 공급 가능(권리는 필요).

## B2. 사람 Gold — TASK 확장 16세트 · 현재 141문항 · 평가 109(처음 쓸 때 각 6문항 · 평가 4 — T-0068 +3 · s.attachment 6/4 는 canon_candidate · Workspace 미연결)

> 형식별 채점 계약: `apps/web/src/lib/knowledge/authored/formats.ts` · 작성 계약 `docs/final/AUTHORING_SPEC.md`. AI 작성 → 맹검 검토(`docs/final/review/expansion-*.json`) → 저자 수정까지. **사람 Gold 아님.**

| TASK | 세트 · SHA-256 | 형식 · 정답 조건 | 사람이 판단할 쟁점 |
|---|---|---|---|
| e.evidence_location | `e-evidence-location.v1.json` · `b98f5d11282528b90740ef78334afb6dc455045ca32768c518552b24140613fe` · T-0052 REWORK: ev-transfer-2 decisiveAlt 추가(직전 `de2262e4…`(T-0052 · 9문항 — 앞 6문항 바이트 그대로 · 새 ev-ind-3 · ev-ind-4 · ev-transfer-2 는 **맹검 · 사람 Gold · 권리 전**, 이전 승인 대상 SHA df069509…) | choice_evidence — 선택 ✓ + 결정 근거 포함 + 범주 밖 근거 없음 | ev-delayed-1 결정 문장 단일화 결과 · ev-transfer-1 요약문 제외 안내 문구 |
| e.option_correspondence | `e-option-correspondence.v1.json` · `09654111ee813850861249cfb142ce0ec887c36bd65ffd15294911ed5115ea0f` · T-0068 +3(opt-ind-3 · opt-ind-4 · opt-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `c49e67cf…`) | 선지 5개 판정 전부 ✓ + 정답 선지 대응 문장 ✓ | 판정 경계(distorted/reversed) — 전부 맞아야 정답이라 경계 선지는 사람이 확정 |
| r.inference | `r-inference.v1.json` · `651ccbe064fbc5ba63feea4e2e3fa3d0522eb378649bffd03f3ffa27cda3902d` · T-0068 +3(inf-ind-3 · inf-ind-4 · inf-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `fef751a2…`) | choice_evidence(함축 · 추론) | inf-transfer-1 새 정답이 「추론」 난이도로 충분한가 · 밑줄 문장 evidenceAlt 처리 |
| r.relation | `r-relation.v1.json` · `4a8c34feaa40228b3ec2389b6c6a7bd8852f067ba181e708e1285389bf7d5ea0` · T-0068 +3(rel-ind-3 · rel-ind-4 · rel-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `9ce1b82d…`) | 쌍마다 관계 ✓(허용 대안 포함) | 연결어 없는 쌍의 관계 단일성 · conclusion 범주 추가 타당성 |
| s.form_scope | `s-form-scope.v1.json` · `cedf02062f07755698bd3816f889baf5959942a80dbaceefa334a3dfaafb1604` · T-0068 +3(gs-ind-3 · gs-ind-4 · gs-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `b388404c…`) | 틀린 밑줄 ✓ + 틀린 이유 ✓ | gs-transfer-1 its/their 지칭(반론 가능성) · 이유 범주 라벨 |
| v.contextual_sense | `v-contextual-sense.v1.json` · `fb8bfaeba6461a2cf94ae65d22c95240c88e9a283f72f2bfaca840c5c3026ddb` · T-0068 +3(vcs-ind-3 · vcs-ind-4 · vcs-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `4bbc973c…`) | 뜻 ✓ + 근거 문장 ✓ | 오답 뜻이 사전에 실재하는 뜻인지 · 전이 문항의 형식 차이가 약함 |

| r.reference | `r-reference.v1.json` · `6807473e00f86c456b6500ca8007bc5e497196dc2f1930183d25d6024f5f5ecf` · T-0068 +3(ref-ind-3 · ref-ind-4 · ref-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `f97e7591…`) | choice_evidence | 전이 문항(생각 전체를 가리키는 this)의 결정 문장 선택 |
| v.multiword | `v-multiword.v1.json` · `179725ab501da614cebd6d2076f475b2123829657e194e462fb579a5f49fb5b6` · T-0068 +3(mw-ind-3 · mw-ind-4 · mw-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `103170d3…`) | contextual_sense | mw-teach-1 정답 「원인으로 설명하다」 — 일부 차지 해석 여지 |
| r.discourse_function | `r-discourse-function.v1.json` · `a50f17d423ae4b1d09a9970be80ec0e6b9033f949a04f6f0b65f2c23faf1b083` · T-0068 +3(df-ind-3 · df-ind-4 · df-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `78fda0a7…`) | discourse_roles | 허용 대안 역할의 관대함 · df-teach-1 틀 유사 |
| r.discourse_structure | `r-discourse-structure.v1.json` · `3f8345758d6106c7dfc8348004fb5d246903fea70c8cfd32d1644c10b9374a9e` · T-0068 +3(ds-ind-3 · ds-ind-4 · ds-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `3592c1cd…`) | discourse_roles | transfer 함의(주제문)/실천 결론 구분 · support 쏠림 |
| e.task_demand | `e-task-demand.v1.json` · `8a91033b38d9ee68108a02422aff00790f0c21b5428facb4c56a2fa78c068bda` · T-0066 +3(td-ind-3 · td-ind-4 · td-transfer-2 — **맹검 · 사람 Gold · 권리 전** · 직전 `dce3db70…`) | demand_choice | 요약문 상자 표시 · 오답 착오 유형 분류 |
| s.sentence_core | `s-sentence-core.v1.json` · `b10859fbc4b7cab9063d306804ee2f2a218deaf9bc861dd47b7ceb7e4843fcc9` · T-0068 +3(sc-ind-3 · sc-ind-4 · sc-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `e2e0af18…`) | segment_choice | 도치 문항을 지연 확인에 둔 역할 배치 |
| s.attachment | `s-attachment.v1.json` · `aed0b88228a2fb9b10182ac2c6fb32f97df05511383c37288b95a01d4d942c40` | segment_choice | at-teach-1 문맥 근거 필요 · at-transfer-1 난이도 |
| s.chunk_boundary | `s-chunk-boundary.v1.json` · `c7a0526ce33047116682931bc5818e12a05f4f87a2015737783b2e854e02f2de` · T-0068 +3(cb-ind-3 · cb-ind-4 · cb-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `c21b2cc6…`) | segment_choice | cb-guided-1 줄어든 관계절 혼동 강도 |
| s.structural_relation | `s-structural-relation.v1.json` · `d393dfe4bd475fee2b677f2170e176e291694536b092a71eb7ab8834df34b83c` · T-0068 +3(sr-ind-3 · sr-ind-4 · sr-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `c83b207f…`) | segment_choice | sr-ind-2 도치 정답(Never before vs had) |
| v.semantic_relation | `v-semantic-relation.v1.json` · `2763dfa3786da48773b54f0f74e3eb8dcf0ceeb710924d478aefe94c59995358` · T-0068 +3(sem-ind-3 · sem-ind-4 · sem-transfer-2 — **맹검 · 사람 Gold · 권리 전**, 앞 6문항 바이트 그대로 · 직전 `2e4ae006…`) | equivalence | 관계 방향(A 가 B 에 대해) 학습자 이해 |
- 공통: 설명 글 문장 번호는 화면과 같은 1부터(세트마다 `proseNumbering: "1-based"` 검증).
- 정본 비보류 TASK 21개(V4 · S6 · R7 · E4) 중 창작 세트 보유 **17**. 없는 4: v.core_meaning(기존 WordVault · Flashcard FSRS 모듈이 담당 — 창작 세트 대상 아님) · s.o.sentence_meaning_model · r.o.global_meaning_model · e.o.final_judgment(통합 관찰 — 구성 TASK 수행의 종합이라 단독 창작 세트를 두지 않음, **지원 완료로 표시하지 않음**). 보류 9(L4 · X5)는 대상 밖.
- SHA 는 2026-10-18 HEAD 기준 전체 값이다. `s.chunk_boundary` 는 FI-014(#307) 수정으로 Gold 가 바뀌었다(cb-guided-1 · cb-ind-1 · cb-ind-2 · cb-delayed-1 에 문항별 대체 이유 `reasonAlternatives`) — **이전 revision 의 검토 · 승인은 승계하지 않는다.** 승인 직전 `sha256sum apps/web/src/lib/knowledge/authored/*.json` 로 다시 대조한다.
- 사람 검수는 revision 단위다: 자격(`content_qualification.annotation_hash`) · Gold 결정은 `authored_item_gold_hash` 에 묶이고, 파일이 바뀌면 해시가 달라져 옛 결정은 공급에 쓰이지 않는다(SQL 이 막는다).

## C. 권리 — 자체 창작 원저작 확인

- 제작: Claude Opus 5.5(Claude Code 에이전트)가 2026-10-18 이 세션에서 새로 씀. `derivedFrom: []` — 기출 지문을 옮기거나 고쳐 쓰지 않았고 형식(5지선다 요지 · 제목 · 주제)만 따랐다.
- 사용 범위 요청: store · display · transmit, 평가 역할(혼자 확인 · 전이 · 지연 확인)은 **+ assess**(FI-004 — 권리 결정에 assess 가 없으면 평가 공급 거절).
- **사람이 확인할 것**: 문장들이 기존 출판물 · 기출과 실질적으로 같지 않은지(표본 대조), AI 생성물을 서비스 저작물로 쓰는 회사 방침과 맞는지. 확인되면 basis `self_authored_original` 로 기록.
- 기출 원문(2020#24 포함)은 이번 패키지 대상이 아니다 — 두 AI 검토 INSUFFICIENT 유지, 공급 경로에서 제외.

## 승인 후 실행 순서(승인된 단계만)

1. A 적용 — 승인형 러너 `scripts/db/authored-supply/deploy.mjs`(r5-bind 와 같은 계약 · 본문 `supabase/deploy/authored-supply/20261020090000_authored_supply.sql` = 보류 SQL 바이트 동일 · SHA `dfb29f2d…`). 사람 터미널(TTY)에서 `apply --stage authored --confirm-sha <SHA>` 뒤 `APPLY authored <SHA>` 입력. 사전 이력 대조(2026-10-20 · 읽기 전용): DB-2 · I2 · G2(SHA 일치) 있음 · 대상 표 없음 · 자격/납품 0행 → 차단 없음. 러너는 사람 결정 행을 쓰지 않는다(사후 검증 0행). 앞뒤 `/db-checkpoint`.
2. 관리자 로그인 세션으로 승인된 revision 의 문항만(처음 쓸 때 R5 9문항) `authored_item_register`(인자 = `registrationArgs`) → `content_qualification_record`(FQ1.1).
3. **사람이** C 확인 뒤 `content_human_decision_record('rights', … 'human-reviewed')`, B 확인 뒤 그 revision 의 평가 역할 문항만(처음 쓸 때 6) `('gold', …)` — 에이전트가 대신 기록하지 않는다.
4. `content_release_approve` public · assessment — 승인된 문항 · 역할 수만큼(처음 쓸 때 9 · 6).
5. 검증 계정으로 지도 → 「자료 받기」 → `/csat/learn/*` 풀이 → `workspace_delivery_attempt.evidence` 확인 → 지도 복귀(DEV_DB_E2E).
