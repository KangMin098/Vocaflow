<!-- docs/csat-learner/v62/R5_FIRST_SUPPLY_PACKAGE.md -->
# R5 첫 적격 공급 — DB 쓰기 4단계 승인 패키지 (준비만 · 실행 안 함)

> **전제 조건: 2020#24 의 사람 Gold 판정과 사람 권리 판정이 둘 다 PASS 여야 한다.** 둘 중 하나라도 없으면 아래 어떤 단계도 실행하지 않는다.
> 현재(2026-10-18): Gold 보류 · 권리 보류 → **적격 콘텐츠 0건**. 이 문서는 판정 직후 바로 실행할 수 있도록 순서 · 실행 주체 · 검증 · 되돌리기를 미리 정리한 것이다.
> 스키마는 이미 적용됐다(DB-1 `20261017200000` · DB-2 `20261017200100` · I2 `20261018120000` · 납품↔G2 `20261018120100`). 여기서 하는 일은 **행 쓰기**뿐이다.
> 원장은 전부 추가 전용이다. 한 번 쓴 행은 지울 수 없고, 되돌리기는 철회(revoke) · 대체(supersedes) 행 추가로만 한다. 시험용 가짜 행을 넣지 않는다.

## 0. 결속 값 (2026-10-18 실측 · 판정 뒤 적용 직전에 다시 계산)
| 칸 | 값 | 출처 |
|---|---|---|
| artifact | `csat_item` / `2020#24` | |
| artifact_revision | `665745b76f720932afd513e9242ed756be6c1d546f5c4d7de054aea824d3a8e8` | `supply_artifact_revision('csat_item','2020#24')` |
| annotation_ref / hash | `claim-support-2020-24.v1` / `72c534f8543a48f0212a842c4943589a3662d4f5449e0bee92eb51112ac02441` | `annotationHash()`(apps/web/src/lib/knowledge/claim-support.ts) |
| source_revision / hash | `kice:2020:suneung:짝수:24` / 공식 문제지 sha256 `d629652b…1c66` | 검수 패킷 §1 |
| gold_revision / hash | 사람 Gold 판정 결과로 정한다(주석 v1 승인이면 `claim-support-2020-24.gold.v1` / 주석 hash 인용) | 검수 패킷 §7 |
| task / role | `r.central_meaning` / `transfer` | |
| 노출 | 2020#24 G2 시도 0 · 원장 0행(2026-10-18) | 개발 DB |

## 1. 주석 등록부 — `supply_current_annotation` 1행
- **실행 주체**: 배포 담당 세션(승인형 러너). 이 표는 소유자만 쓸 수 있다(anon · authenticated · service_role 모두 권한 없음 — I2 설계).
- **변경**: `insert into public.supply_current_annotation (artifact_ref, task_id, artifact_revision, annotation_ref, annotation_hash) values ('2020#24','r.central_meaning','665745b7…a8e8','claim-support-2020-24.v1','72c534f8…2441');` (값은 §0 전체 값)
- **검증**: 1행 · `artifact_revision = supply_artifact_revision('csat_item','2020#24')`.
- **되돌리기**: 등록부는 추가 전용이 아니다 — 행 삭제로 공급을 즉시 멈출 수 있다(I2: 등록 없으면 csat 신규 공급 전부 거절). 삭제도 별도 승인.

## 2. 자격 기록 — `content_qualification_record(...)` 1행
- **실행 주체**: 관리자 · 큐레이터 계정으로 로그인한 세션(`is_admin_or_curator()` 검사 — MCP/postgres 로는 불가). 사람 관리자 1명 + 에이전트 2차 확인(정책).
- **변경**: rules_version `FQ1.1` · 축 A·B·C·E·F·H = pass(근거: A·B 기존 · C·H 검수 실행 기록 · E 사람 Gold · F 사람 권리) · D·G 는 해당 값 그대로 · source/gold/annotation 결속 §0 · evidence_ids 에 Gold · 권리 판정 문서 id · method `사람 Gold + 사람 권리 + 2인 검수`.
- **주의**: C·H 를 pass 로 쓰려면 노출 원장과 분리된 검수 계정 실행 1건이 먼저 있어야 한다(검수 패킷 §6). 없으면 C·H 는 unknown 으로 두고 여기서 멈춘다.
- **검증**(서버 · DB 소유자 연결 — `supply_annotation_matches` 는 authenticated 실행권이 없다): `fq_role_ok(axes,'transfer') = true` · `supply_annotation_matches(id) = true`.
- **되돌리기**: 삭제 불가. 잘못 쓰면 `p_supersedes` 로 대체 행을 쓰거나 승인을 만들지 않는다.

## 3. 승인 기록 — `content_release_approve(q, 'public')` + `(q, 'assessment')`
- **실행 주체**: 2 와 같은 관리자 세션.
- **검증**: 두 범위 모두 철회 기록 없음 · 이 시점부터 앱 reader(`loadFqReader`)가 2020#24 를 `transfer` 적격으로 돌려준다(학습자별 노출 G 는 공급 시점에 따로 본다).
- **되돌리기**: `content_release_revoke(approval, reason)` — 이후 공급은 막히고, 이미 납품된 기록은 비근거로 해석된다(이력 불변).

## 4. 공급 기록 — 수요 → 주문 → 납품
- **실행 주체 · 순서**(합성 학습자 계정 · 실제 학생 기록과 섞지 않는다):
  1. 학습자 세션: `workspace_demand_record(canonical)` → `factory_order_open(line, …, request_key)`
  2. 관리자 · 큐레이터 세션: `factory_order_transition(…)` (주문 상태 전이는 관리자만 — 학습자 세션은 42501)
  3. 학습자 세션: `workspace_delivery_record(line, order, qualification, approval, request_key)` — 수요 줄이 `auth.uid()` 본인 것이어야 한다(I2 wrapper)
- **검증**(서버 · DB 소유자 연결 — `supply_delivery_valid` 는 authenticated 실행권이 없다): `supply_delivery_valid(delivery) = true` · 같은 요청 키 재호출 = 같은 id.
- **되돌리기**: 삭제 불가 — 승인 철회로 무효화.

## 5. 종단 E2E (공급 뒤 · 개발 DB)
학습지도(적격 표시) → 납품 → 최초 노출 → G2 수행(`recordItemTaskAttempt` · phase=transfer · content_hash=주석 hash) → `workspace_delivery_attempt_record` → 지도 · PLAN 복귀.
반드시 확인: 요청 키 재전송 · 두 연결 동시 결속(실 Postgres) · 다른 학습자 납품 결속 거절(42501) · 승인 철회 뒤 비근거 기록 · revision/주석 변경 시 거절 · PLAN 버전 유지 · 공급 0건 상태 표시.
결과는 합성 계정 기능 검증으로만 기록한다(실제 학습 효과는 별도 파일럿).

## 6. 보류 시 대체 후보
- **2021#24**(전이): 원천 정체성 A 는 2020#24 와 같은 수준으로 확인됨(검수 패킷 §5). 나머지 축 상태도 같다 — 대상을 바꿔도 사람 Gold · 권리가 똑같이 필요하다.
- 2026#23 · M2609#23: 합성 계정 노출 기록이 있어 첫 후보로 부적합.
- 결론: 대체 후보로 바꿔도 막힌 원인(사람 판정)은 그대로다. 판정 부담을 줄이려면 같은 회차 · 같은 유형을 묶어 한 번에 판정받는 것이 낫다.
