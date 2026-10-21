<!-- docs/implementation/learning-outcomes-20261021/04-EXISTING-DCP-REUSE-RESULT.md -->
# 04 기존 DCP 재사용 — 구현 결과 (2026-10-21)

## 루트 실제 검수·보완 결과

아래 신규 구현자 기록 뒤 Codex가 실제 두 모델 검수를 실행했다. 기존 title/topic 해설은 내용 검수에서 실패했으며, 원본은 보존했다. 같은 두 id의 `answer_key.rationale_ko`만 보완한 **미적용 수정안**을 새 Claude `8547b6f4-2dd5-40be-9988-895ffa7bab82` · Codex `01a15e81-0369-75d2-bcd4-769c56bcba98` 세션이 각각 B/C/D pass로 판정했다. 원문·발문·선지 순서·정답·기존 시도는 바꾸지 않는다. 원시 요청/응답/세션과 두 판본은 [휴대 가능한 증거](./evidence/4-reuse/proposed-reuse-evidence.json)에 있다.

실제 `planExistingDcpReuse`가 수정안 행으로 통과하고, 현재 DB에서 읽었던 원본 행으로는 `reuse_review_target_mismatch`를 내는 것을 확인했다. **현재 DB 행에 대한 검수 통과·입고 성공으로 보고하지 않는다.** 출력 SHA `eaca439e11cada998e3cf6a442911a0950fff10b3120ba5c59f10da3c0b901b2`.

내용 C=fail인데 입고 영수증과 새 요지 자리를 먼저 만드는 반례가 실패 재현됐다. 공통 `admitPlan`에서 문항별 B/C/D pass·검수 대상 포함·결론 pass를 전체 묶음에 먼저 확인해 RPC 전 차단했다. 권리·실행 관측의 unknown은 별도 후보 보류로 남긴다. 보완 뒤 재사용/공급/API 38개 및 별도 DATA SQL 5개를 통과했다. B/C/D의 fail/unknown/not_applicable 추가 회귀는 최종 통합 검증에 포함한다.

데이터 수정은 별도 승인 대상이다: [정방향 SQL](../../../supabase/deploy/learning-outcomes-20261021/rationale-correction.sql), [복구 SQL](../../../supabase/deploy/learning-outcomes-20261021/rationale-correction-rollback.sql). 원문·두 행 payload/answer_key 해시와 자격/입고 없음 검사를 잠금 아래 재확인한다. 12:50:32 UTC 읽기 관측에서 실제 대상의 시도·자격은 각각 0이었다. 격리 PostgreSQL에서는 기존 시도 2개 보존·두 번째 행 변경 시 전체 롤백·원문 변경·자격/입고 결속 차단·정확한 복구를 실행 확인했다. 복구 SQL은 자격/입고 **전**에만 쓸 수 있다. 공유 DB 쓰기는 0이다.

아래는 구현자 종료 시점의 기록이며, 독립 검수 부재·기존 harness 타입 오류는 이후 루트 증거/통합 검증으로 갱신한다.

정본: [04-EXISTING-DCP-REUSE-SPEC.md](./04-EXISTING-DCP-REUSE-SPEC.md). 브랜치 `feat/learning-outcomes-reuse-20261021`(base f410eae82). **미커밋 · 공유 DB 미적용 · push 없음**.

## 구현

| 경계 | 내용 |
|---|---|
| `factory-bridge/dcp-reuse.ts`(신규) | `planExistingDcpReuse` — `planAdmission` 검증을 먼저 그대로 돈 뒤 매핑(item_id→dcp_item_id) · 서버가 읽은 현재 행을 대조: kind article · 같은 source · type · paragraph_idx 0 · practice · 발문 · 선지 순서 · 정답 동일 · passage 는 현재 원문의 공백 정규화 전체(`full`) 또는 연속 발췌(`excerpt`). 계획 row = 저장된 payload/answer_key 그대로. 검수 `target.existing_rows[{item_id,dcp_item_id,row_sha256}]` 필수 · 매핑과 정확히 같은 집합(누락 · 추가 · 중복 · 다른 hash 거절) · 옛 검수 / legacy 형식 거절. row sha = JS canonical(id · kind · ref_id · type · paragraph_idx · item_role · payload · answer_key). `adaptOutputToExisting` — 원래 출력의 같은 유형 문항을 기존 발문 · 선지 · 정답으로 맞추고, 해설은 **저장된 기존 해설 원문**을 그대로 옮긴다(새 교수 해설 지어내지 않음). |
| `dcp-supply.ts` | `previewReuse` · `admitReuse` (+ `ExistingRowReader`). 입고 루프를 `admitPlan` 으로 공유 — 원래 `admitCandidates` 동작 불변. 문항마다 별도 RPC(묶음 전체 원자 아님, `reuse.atomic:'per_item'`). |
| `lib/admin/dcp-admission.ts` | `existingDcpRowReader`(service SELECT, 투영 열만 · 오류는 던짐) · `previewDcpReuse` · `admitDcpReuse`(관리자 세션 RPC · PGRST202→not_installed). |
| `POST /api/admin/csat/dcp-admission` | `action:'preview_reuse'`(admin·curator) · `'admit_reuse'`(admin만). 닫힌 본문 + `reuse` 1~10건. 행 본문 · actor · 모르는 키 400. 원래 preview/admit/approve 불변. |
| `_pending_factory_dcp_admission.sql` | `factory_dcp_admit` 에 `p_body.existing` 분기: 모양 검사 → 지정 행 `FOR UPDATE` → 자연키 · practice 동일성 → payload/answer_key JSONB 동등성 → 이미 입고된 id 거절 → **기존 id 에 영수증만**(행 UPDATE/DELETE 없음 · 새 id 없음). `existing` 없으면 원래 slot 거절 + INSERT 그대로. 요청 키 · 본문 replay 의미 그대로. 영수증 body 에 `existing{dcp_item_id,row_sha256,passage_scope}` 와 review sha 결속. 새 테이블 · 열 · 제약 없음. |
| CLI `scripts/textbook/factory-dcp-reuse.mts`(신규 · tsconfig.scripts 포함) | `prepare-observed-case`(새 디렉터리만 · 부분 실패 시 이번 파일만 삭제) · `preview`(오프라인 파일 행 — 서버 SELECT 아님을 출력에 표시). DB 접속 없음. |

새 SQL sha256(pending 파일 전체): `e081cfac2ef5e6127a739cfc3af63f5b276ca6b4f25cecb9015f36d44e549ac1`.

## 실제 검수 요청(루트가 독립 검수)

`D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/reuse-stage4-actual/` — 실제 1B 패킷 · 출력 · 읽기 전용 관측 행으로 생성:
`adapted-output.json`(sha256 `c3a23daf4ff464e8ed2780486d6a70106baf30777561a49d8c95ebedb60eae10`) · `reuse-mapping.json` · `existing-rows.observed.json` · `review-request.json`.
existing_rows: cm-title-01 → `4dbcca67-…b6` row sha `08ef3970…0483` · cm-topic-01 → `33ee70d0-…af` row sha `56ced4b8…d678`.
요청에는 기존 행 원문(payload/answer_key · passage_scope) · 원래 출력 · 맞춘 출력 · 원문이 함께 있고 결론 · 축 판단은 없다. 패킷은 합성 계보 후보로 표시(`lineage`). 기존 해설(특히 topic 의 짧은 해설)의 충분성은 검수자가 따로 판단해야 한다 — 보강이 필요하면 DB 행은 그대로 두고 그 판단을 검수 기록에 남긴다.

## 검증 (실제 실행)

- 격리 PGlite 정본 SQL `dcp-reuse.pglite.test.ts` 9/9 — 관측 행 그대로 선적재 · 원래 입고 slot occupied · 재사용 2 + 신규 요지 1(새 행 +1) · 기존 두 행 payload/answer_key 불변 · 재전송 replayed 행 +0 · 이미 입고된 id 다른 본문 거절 · 미리보기 뒤 payload/Gold 변경 경쟁 거절 · 다른 type id · 없는 id · 모양 오류 · 원천 변경 · 위조 passage · 옛 검수 · 임의 hash · 누락/추가 · 정답 불일치 · 원래 출력 위장 · 비관리자/로그아웃 거절 · anon execute/authenticated insert 권한 없음 · 승인 행 0(사람 결정 없음) · 재사용 title 의 승인 → 학습자 공급 → 실제 `grade_dcp_item` 정답 채점 · 영수증 소유.
- 회귀: factory-bridge 전체 · lib/admin dcp-admission · api/admin/csat 라우트 16 파일 264/264 통과(dcp-supply · dcp-learning · reassess-plan pglite 포함). 라우트 재사용 3건 추가.
- `tsc -p apps/web` 통과 · 변경 파일 ESLint 통과. `tsc -p tsconfig.scripts.json` 은 13건 실패 — 전부 이 작업이 건드리지 않은 `build-factory-card-harness.mts` · `build-factory-dcp-harness.mts`(esbuild 타입 없음 · 암묵 any). 새 CLI 관련 오류 0.

## 한계 · 남은 일

- 실제 독립 검수 기록 없음 — 루트가 `review-request.json` 으로 실행해야 `preview_reuse` 가 통과한다. 이 작업은 결론을 만들지 않았다.
- SQL 은 pending. 공유 DB 적용 · 실제 입고 · 승인 · 발행 없음. 적용 승인 패키지에 위 sha · 점유 자리(title/0 · topic/0, main_point/0 비어 있음) · 기존 행 보존(UPDATE/DELETE 없음) · 복구(영수증은 추가 전용 — 되돌리려면 별도 승인 필요)를 반영해야 한다.
- 3문항 입고는 문항 단위 원자. 중간 실패 시 같은 본문 재요청이 이미 입고된 문항을 replayed 로 돌려주고 나머지를 이어간다.
- 실제 HTTP 경계는 mock 라우트 시험과 격리 SQL 시험으로 나눠 검증했다(실 서버 E2E 미실행).
- 권리(F)는 rights 기록이 있을 때만 pass — 원저작 관측은 새 권리 부여가 아니다.
