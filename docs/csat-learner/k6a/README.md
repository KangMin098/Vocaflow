# K6-a 앱 ↔ DB 독립 판정 노출 기준 통일 — 보완안 (미적용)

> 상태: **제안 · 미적용.** 사용자 결정(2026-10-25): 보완과 읽기 전용 검증만, 적용은 별도 승인.
> 이전 초안 `../k6a-unified-exposure-proposal.sql` 은 이 문서의 `forward.sql` 로 대체한다(초안은 security invoker 라 학습자 호출에서 동작하지 않는다 — 아래 §4).

| 파일 | SHA-256 |
|---|---|
| [forward.sql](./forward.sql) | `18533958635586ab703341741909ebe0429bcef17e35ce6e249e1853aea5de2f` |
| [recovery.sql](./recovery.sql) | `b1406ba9fdd0966e46afc474b97e9d048ec3cdf2b7dba93bf1f19eccc92657d7` |

## 1. 현재 함수(복구 기준)
- 개발 DB `jajenrevcbmrpaliomxv` · 2026-10-25 `pg_get_functiondef` 원문 = `recovery.sql` 본문(v3, `20261023194123_learning_exposures.sql` 과 같음 · v3.1 은 이 함수를 바꾸지 않음).
- ACL `{postgres=X, service_role=X, authenticated=X}` · security invoker · STABLE · `search_path public, pg_temp`. anon 실행 불가.
- 노출 조건은 `e.item_ref = a.item_ref` 뿐.

## 2. 지문 키 전수 대조 — 일치
- 3,714문항 · 133회차 · 지문 없는 문항 0.
- SQL(`lower → \s+ → ' ' → btrim → to_jsonb::text → sha256`)과 앱 `normalizedPassageKey`(JS)를 같은 정렬(exam_id, no)로 `ref:key` 연결 md5: **양쪽 모두 `be10b1f65c4969ce43bf218ec12bab2e`**.
- 공유 지문: 641문항 · 254묶음.

## 3. 사례 검사(읽기 전용 VALUES 시뮬레이션 · 실제 지문 쌍 2014A#24 ↔ 2014B#23, 다른 지문 2014A#23)
| # | 사례 | 현재 함수 | 제안 |
|---|---|---|---|
| 1 | 같은 문항 노출(이전) | after_exposure | after_exposure |
| 2 | 같은 지문 다른 문항(이전) | **independent_candidate** | after_exposure |
| 3 | 다른 지문(이전) | independent_candidate | independent_candidate |
| 4 | 지문 미상 문항 노출(이전) | independent_candidate | passage_unknown |
| 5 | 같은 지문 · 동시각(동률) | independent_candidate | after_exposure |
| 6 | 같은 지문 · 시도 뒤 노출 | independent_candidate | independent_candidate |
| 7 | 시도 문항 지문 미상 + 다른 문항 노출 | independent_candidate | passage_unknown |

시뮬레이션은 관리자 권한 질의다 — 학습자 권한 경로는 §4 를 근거로 definer 로 고쳤고, 적용 뒤 학습자 세션 확인 질의를 `forward.sql` 끝에 둔다.

## 4. 권한 · RLS — 초안 결함과 보완
- `csat_items` RLS 정책 `csat_items_read` 조건 = **`false`**. authenticated 는 열 권한이 있어도 행이 안 보인다.
- 초안의 `csat_passage_key` 는 security invoker → 학습자 호출에서 모든 키 null → 같은 지문 미검출 + 다른 문항 노출마다 passage_unknown(안전하지만 기능 상실).
- 보완: `csat_passage_key` = **security definer**, 반환은 정규화 본문의 sha256 해시뿐(본문 · 정답 없음). 학습자가 얻는 정보는 「두 문항의 지문이 같은가」뿐. `search_path` 고정 · public · anon 회수 · authenticated · service_role 실행.
- `learning_attempt_independence` 는 CREATE OR REPLACE — ACL · invoker · STABLE 유지(본인 시도 · 본인 노출만 RLS 로 보인다).
- 같은 이유로 앱 `bridge/exposure-reader.readPassageKeys` 는 **서버 전용 클라이언트로만** 호출해야 한다(학습자 세션이면 빈 키 → 전부 보류).

## 5. 새 반환값 `passage_unknown` 의 소비자 영향
- 저장소 호출처: `apps/web/src/lib/csat/bridge/exposure-reader.ts` `readIndependence` 하나(제품 화면 미연결). `parseIndependence` 는 모르는 값을 null → `evidence-feed` 가 `independence_unknown` 으로 보류. **공급되지 않는다.**
- K 하네스 `k-repro`/`k-targets` 는 함수 정의 문자열을 본다 — 적용 시 K6-a 를 fixed 로 바꾸는 절차(K HANDOFF)를 따른다.
- 적용과 함께 `IndependenceStatus` 에 `passage_unknown` 을 더하는 앱 변경을 낸다(보류 사유 명시용 · 없어도 안전).

## 6. 다른 계약과의 충돌 검토
- P6 v3/v3.1: 표 · 트리거 · 기록 RPC 무변경. 판정 순서(legacy → not_check → repeat → helped → after_exposure → … )에 `passage_unknown` 을 after_exposure 다음 · timing_held 앞에 끼운다 — 숙달을 올리는 값은 여전히 없다.
- K6-b(T-0164): 앱 평가 원장이 P6 를 읽지 않는 문제 — 앱 코드만, 이 SQL 과 독립. 둘 다 같은 지문 기준(앱 normalizedPassageKey)을 쓴다.
- H UNKNOWN 계약: 지문 미상 → X0 금지 / held — 제안의 passage_unknown 과 같은 방향.

## 7. 적용 시 절차(승인 뒤)
- 2026-10-25 개발 정책: DB 쓰기는 **승인형 배포 러너로만**(main-serving `scripts/db/<id>/deploy.mjs apply --stage <s> --confirm-sha <sha>` · db-approval 훅 1회용 티켓). MCP SQL 은 SELECT 만 — 이 보완의 모든 DB 조회는 SELECT 였다.
1. 적용 직전 `pg_get_functiondef` 를 다시 떠서 `recovery.sql` 본문과 같은지 확인(다르면 중단).
2. 러너로 `forward.sql`(SHA 위 표) 적용 → 끝의 확인 질의(학습자 세션 같은 지문 쌍 true · ACL).
3. 문제 시 러너로 `recovery.sql`.
