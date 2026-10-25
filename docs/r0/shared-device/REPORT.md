# R0 공용 기기 계정 전환 — 학습 기록 혼입 (T-0172)

근거: Codex 독립 원인 분석(`Vocaflow-AI-Control/runtime/t0172/codex-root-cause.md`, HEAD 94fe3561a). 브라우저 실기 재현은 하지 않았다 — 아래는 모두 vitest 결정적 재현이다.

## 1. 재현(수정 전 HEAD, 재현 테스트만 담은 커밋)

명령: `pnpm exec vitest run src/lib/csat/session/__tests__/shared-device.test.ts src/lib/srs/__tests__/shared-device.test.ts src/app/api/csat/state/__tests__/route.test.ts` (apps/web)
결과: **8 failed / 9 passed** — 8건 모두 결함 재현.

| 경로 | 시나리오 | 수정 전 실패 요지 |
|---|---|---|
| CSAT · B 서버 기록 없음 | A 가 `saveDissectionRecord` → hard reload → B `loadSyncedDissectionRecord` (GET `record:null`) | 반환 기록에 A 항목: `expected ['A-SECRET-2026#31'] to not include …` (PUT 도 B 로 전송) |
| CSAT · B 서버 기록 있음 | 같은 흐름, GET 이 B 기록 | 병합 결과 `['B-OWN-2026#20','A-SECRET-2026#31']` |
| CSAT · A 재로그인 | B 사용 뒤 A 재로그인 | A 기기 기록이 B 것으로 덮여 `['B-OWN-2026#20']` (A 기록 소실) |
| CSAT · PUT 서버 결속 | 다른 owner 표시 PUT | `expected 200 to be 403` |
| SRS · B 진입 flush | A `pushPendingResult('apple')` → reload → B `flushPendingSession` | B 계정 서버 액션으로 `['apple']` 전송, skip 응답에 큐 전체 삭제(A 미전송 기록 소실) |
| SRS · B 이탈 beacon | 같은 흐름 + B 평가 + `flushOnLeave` | A 큐가 이미 지워져 `expected '' to contain 'apple'` |
| SRS · A 재로그인 | A 복귀 flush | 보낼 A 기록이 없음 `expected [] to have a length of 1` |
| SRS · 서버 액션 | B 로그인, owner=A 항목 `apple` | B 카드 갱신 `[{ id: 'vocab-B-apple' }]` |

재현되지 않아 수정하지 않은 경로: 옛 `LearnerRecord`(`loadRecord/saveRecord`) — 현행 UI 호출처 없음(Codex 분석과 같음), 시험하지 않았다.

## 2. 수정

- `apps/web/src/lib/csat/session/store.ts:22-56` 해부 기록 키를 계정별 `dissection-v1:<user id>` 로. 계정은 브라우저 세션(`getSession`, 네트워크 없음)에서 읽고, 계정이 바뀌면 메모리 사본만 버린다. 계정을 모르면 기기 저장소를 읽지도 쓰지도 않는다(메모리만).
- 같은 파일 `:62-70 · :118-160 · :186-200` 저장·예약 전송·재전송·load 병합 전송이 `owner` 를 함께 보낸다.
- `apps/web/src/app/api/csat/state/route.ts:97-109` PUT 의 `owner` 가 로그인 계정과 다르면 403 `owner-mismatch`(클라이언트는 재전송 안 함). owner 없는 요청(배포 전 열린 탭)은 기존대로 받는다.
- `apps/web/src/lib/srs/session-storage.ts:27-61 · :113-147` 큐 항목에 `owner`. 조회·삭제는 지금 계정 항목만, 다른 계정·주인 없는 항목은 남긴다. 주인이 정해지기 전 이 페이지에서 쌓인 평가는 주인 확정 시 그 주인으로 표시(로그아웃 = hard reload 라 한 모듈 수명 = 한 계정).
- `apps/web/src/lib/srs/flush-session.ts` `resolveSrsQueueOwner()` 로 진입 flush 전에 주인을 정하고, 보낸 항목만 지운다. `flushOnLeave` 는 정해진 주인의 항목만, 주인을 모르면 보내지 않는다.
- `apps/web/src/lib/srs/flush-actions.ts:63-66` 서버 액션이 `owner !== user.id` 항목을 적용하지 않는다(skipped 로 셈). `flush-types.ts` `owner?` 추가.
- 기존 회귀 `srs/__tests__/flush-durability.test.ts` 를 계정별 큐 계약에 맞게 고쳤다(옛 sessionStorage 큐는 옮기되 보류).

## 3. 보존 정책

- 다른 계정의 로컬 기록: 노출·병합·전송하지 않고 **삭제하지 않는다.** 원 소유자가 다시 로그인하면 정상 전송된다(재현 테스트 3번째 경로가 수정 후 통과).
- 소유자를 증명할 수 없는 옛 기록(CSAT 공용 키 `dissection-v1`, SRS 의 owner 없는 큐 · 옛 sessionStorage 큐): 누구에게도 병합·전송하지 않고 지우지도 않는다. 근거 — 기기에 남은 기록이 누구 것인지 클라이언트도 서버도 알 수 없으므로, 아무 계정에 붙이면 혼입이고 지우면 원 소유자의 학습이 사라진다. 보류가 둘 중 되돌릴 수 있는 유일한 선택이다.
- `clearAll`(서버 DELETE 포함)은 쓰지 않았고 로그아웃 정리 훅도 만들지 않았다 — 소유자 결속만으로 노출이 막힌다.

## 4. 남은 위험

- 브라우저 실기(실제 IndexedDB · 다중 탭 · 실제 로그아웃) 재현 미실행. IndexedDB 는 테스트 안 메모리 대역.
- 옛 보류 기록은 원 소유자에게도 자동으로 돌아가지 않는다(소유 증명 불가). 복구 경로가 필요하면 별도 설계.
- 배포 전 열린 옛 탭: owner 없는 SRS beacon 은 서버가 적용하지 않고, 옛 클라이언트는 보낸 뒤 큐를 비우므로 그 평가는 유실될 수 있다. CSAT 은 owner 없는 PUT 을 받는다(옛 탭은 공용 키를 쓰므로 옛 혼입 위험이 그 탭 수명 동안 남는다).
- `flushOnLeave` 의 응답 미확인 삭제는 범위 밖(소유자 분리만 함).
- 로그아웃 없이 같은 탭에서 계정이 바뀌는 경우(SIGNED_OUT 이벤트만) CSAT 예약 전송은 예약 당시 owner 로 가서 서버가 403 으로 거절한다 — 기기 기록은 원 소유자 키에 남는다.
- 기존 실패: `src/app/api/__tests__/route-guards.test.ts` 1건(`csat/item/[slug]/judgment/route.ts` 가드)은 수정 전 HEAD 에서도 실패 — 이 작업과 무관, 허용 경로 밖.

## 5. 실행 명령과 결과(최종 커밋)

- `pnpm exec vitest run src/lib/srs src/lib/csat/session src/app/api/csat/state src/lib/csat/__tests__/state-push-retry.test.ts` — 17 files · 155 passed · skip 0
- `pnpm exec vitest related --run <변경 파일>` — 19 files · 125 passed · skip 0
- `pnpm exec tsc --noEmit -p .` — 오류 0
- `pnpm exec eslint <변경 파일 10개>` — 오류 0

## 6. run 2 — Codex r1 리뷰(REQUEST_CHANGES) P1 5건 반영

이 절이 위 §2~§4 의 해당 서술(owner 없는 PUT 수용 · 이탈 전송 뒤 큐 비우기 · 마지막 flush 의 주인으로 표시)을 **대체**한다.
재현 테스트 커밋 `1f78bd01e`: 수정 전 **11 failed / 20 passed**(`vitest run` 대상: dictation/persist-owner · srs/shared-device-ack · srs/shared-device · csat/session/shared-device-race · api/csat/state).

| # | 지적 | 재현 테스트(수정 전 실패 요지) | 수정 |
|---|---|---|---|
| 1 | PUT owner 생략 수용 | `route.test.ts` owner 필수 — `expected 200 to be 428`, GET owner `expected undefined to be 'u1'` | `app/api/csat/state/route.ts:106-115` owner 없으면 **428 `owner-required`**, 다르면 403. 둘 다 4xx 라 클라이언트는 재전송하지 않고 기록은 기기에 남는다(유실 없음). GET 은 `owner: user.id` 동봉(`:78-91`) |
| 2 | GET 대기 중 A→B 전환 병합 | `shared-device-race.test.ts` — B 기기 키가 `['A-SERVER','B-OWN']` | `lib/csat/session/store.ts:30-60` onAuthStateChange 구독 · 인증 세대, `:76-135` `loadFor/saveFor/updateFor` 가 주인 고정(지금 계정과 다르면 읽기 · 쓰기 · 전송 안 함), `:209-250` GET 응답 owner 불일치 · 세대 변경 · 주인 변경이면 응답 폐기 |
| 3 | 평가 주인 = 마지막 flush 의 값 | `shared-device-ack.test.ts` P1-3 — `['banana','user-A']`, 로그아웃 · getSession 실패 뒤 `'user-A'` | `lib/srs/flush-session.ts:21-38` onAuthStateChange 구독으로 주인을 늘 지금 값으로, getSession 실패 시 null(보류). `lib/srs/session-storage.ts:36-48 · :110-114` 평가 시점 주인으로 표시(호출부 owner 무시), 주인 없으면 보류 |
| 4 | ACK 없이 삭제 | P1-4 — beacon 뒤 큐 `[]`, ok=true foreign skip 뒤 큐 `[]` | `flush-actions.ts:73-77 · :188-190` 모든 쓰기 성공 뒤 **본인 소유 처리 항목 키(acked)** 반환(적용 · 중복 · 단어 없음). `flush-types.ts` `acked`. `session-storage.ts:126-135` `removeAckedResults(owner, acked)` 만 삭제. `flush-session.ts:60-72` 확인 전송은 ACK 만 지우고, `flushOnLeave`(`:78-115`)는 **지우지 않는다** — 다음 진입 확인 전송이 재전송하고, 이미 적재된 항목은 서버 멱등 가드((vocabulary_id, attempted_at), `flush-actions.ts` 기존)로 duplicated → ACK 되어 이중 적용 없이 정리된다 |
| 5 | Dictation 회귀 | `dictation/__tests__/persist-owner.test.ts` — `[['harbor', undefined]]`, 비로그인도 전송 | `lib/dictation/persist.ts:329-347` 완주 시점 `client.auth.getUser()`(서버 검증) 계정을 owner 로 붙임, 비로그인이면 FSRS 전송 안 함 |

서버가 보장하는 범위(정확히): owner 는 클라이언트가 보낸 문자열이라 **기록 출처의 증명이 아니다.** 서버가 보장하는 것은 (1) 쓰기는 언제나 쿠키로 인증된 계정의 행 · 카드에만, (2) 정상 클라이언트가 계정별 키 · 평가 시점 인증으로 붙인 owner 가 로그인 계정과 다르거나 없으면 적용하지 않음이다. 위조 · 변조된 클라이언트가 이미 손에 쥔 남의 기록을 자기 owner 로 붙여 자기 행에 넣는 것은 막지 못한다(그 사람은 이미 기록을 읽은 상태다). A 의 서버 행 · 카드 직접 수정은 기존처럼 불가.

남은 위험(추가): 이탈 전송 뒤 큐는 다음 확인 전송까지 남는다(재전송은 멱등). 주인이 정해지기 전(진입 직후 getSession 대기 ms) 평가는 주인 없이 보류된다. 배포 전 열린 옛 탭의 CSAT PUT 은 428 로 거절되어 그 탭의 기록은 기기 공용 키에 보류로 남는다.

실행(최종 커밋, apps/web):
- `pnpm exec vitest run src/lib/srs src/lib/dictation/__tests__/{persist-owner,adaptation,audio-control,hint,targets-graded}.test.ts src/app/api/csat/state src/lib/csat/session src/lib/csat/__tests__/state-push-retry.test.ts` — 24 files · 211 passed · skip 0
- `session-rls.integration.test.ts`(dictation) 는 DB 환경 변수가 없으면 3건 skip 되는 기존 통합 시험이라 위 실행에서 제외했다(이 변경과 무관).
- `pnpm exec tsc --noEmit -p .` — 오류 0 · `pnpm exec eslint <94fe3561a 이후 변경 ts/tsx 전부>` — 오류 0

## 7. run 3 — Codex r2 리뷰 P1 2건 반영

재현 테스트 커밋 `5c5b6e91e`: 수정 전 **3 failed / 1 passed**.

| # | 지적 | 재현 테스트(수정 전 실패 요지) | 수정 |
|---|---|---|---|
| 1 | 화면이 쥔 A 기록을 B 전환 뒤 저장 → B 키 · owner=B PUT | `csat/session/__tests__/shared-device-stale.test.ts` — `saveDissectionRecord` 가 `true`(B 키에 A 기록) | `lib/csat/session/store.ts:38-56` 기록에 심볼 키로 「읽힌 주인 · 인증 세대」 결속(화면의 `{...record}` 복사에 따라가고 IndexedDB · JSON 에는 안 실림). `:98-110` `loadFor` 가 결속해 내주고 읽는 사이 세대가 바뀌면 빈 기록. `:119-130` `saveDissectionRecord` 는 결속이 지금 주인 · 세대와 다르면 **거부(false)** — 원 소유자 키는 그대로(보류). 결속 없는 기록은 주인을 모를 때(메모리 전용)만 받는다 |
| 2 | getSession 대기 중 B 이벤트를 늦은 A 응답이 덮음 | `srs/__tests__/shared-device-stale.test.ts` — 실제 `pushPendingResult` 평가가 `owner: 'user-A'` · CSAT 같은 순서에서 A 기록 반환 | `lib/srs/session-storage.ts:46-57` 주인 판(version), `lib/srs/flush-session.ts:28-41` 조회 시작 판과 다르면 응답 폐기(실패 경로도 같음). CSAT `store.ts:60-73` 이벤트 순번 — 대기 중 이벤트가 오면 응답 대신 이벤트 값 |

같은 세대 규칙을 점검한 다른 지점:
- CSAT `updateFor`(`store.ts:155-172`): 읽은 기록의 결속이 지금 주인 · 세대와 다르면 고치지 않고, 저장 직전 세대를 다시 본다.
- CSAT `loadSyncedDissectionRecord`: `currentOwner()`를 쓰는 `switched()`가 이제 늦은 응답에도 안전하다. GET 응답 owner 대조는 r1에서 넣은 그대로 둔다.
- SRS `flushOnLeave`·`pushPendingResult`: 이벤트로 갱신되는 동기 주인만 읽는다. 늦은 조회는 폐기된다.
- Dictation `persist.ts`: 완주 순간 `auth.getUser`로 서버 검증하며 캐시하지 않는다. 해당 없음.

알려진 보수적 동작: 같은 계정이 다른 탭에서 로그아웃 후 재로그인해도 세대가 올라가, 그 전에 읽은 기록의 저장은 거부된다(화면은 「이 기기에만」 표시, 다시 읽으면 정상).

실행(최종 커밋, apps/web): `vitest run src/lib/srs src/lib/dictation/__tests__/{persist-owner,adaptation,audio-control,hint,targets-graded}.test.ts src/app/api/csat/state src/lib/csat/session src/lib/csat/__tests__/state-push-retry.test.ts src/components/csat/home` — 30 files · 251 passed · skip 0. `tsc --noEmit -p .` 오류 0. eslint(94fe3561a 이후 변경 ts/tsx 전부) 오류 0.

## 8. run 4 — Codex r3 리뷰 P1 반영(같은 계정 재로그인 저장 거부 → 유실)

재현 테스트 커밋 `af5a2f99d`: CSAT 2건 실패(`saveDissectionRecord` → `false`). SRS 확인 테스트 1건은 수정 전에도 통과했다.

- 수정: `lib/csat/session/store.ts:115-132`. 저장 허가는 **주인 동일성**으로만 판단한다(결속 주인 == 지금 계정). 인증 세대는 진행 중인 비동기 응답을 버리는 데만 쓴다: 읽는 도중 전환(`loadFor:98-110`), GET 대기 중 전환(`loadSyncedDissectionRecord` `switched()`), 늦게 온 세션 조회(`currentOwner`). `updateFor`(`:159-172`)도 주인 동일성만 본다. 읽는 사이에 전환되면 `loadFor` 가 결속 없는 빈 기록을 주므로 그대로 거부된다.
- A→B→A 판단: **허용.** 화면의 A 기록은 읽힌 순간 A 에 결속돼 있다. B 동안의 저장은 거부되고(B 키 · B PUT 에 안 들어감), A 로 돌아오면 A 키에만, owner=A 로 저장된다. B 의 쓰기는 B 키에만 있으므로 섞이지 않는다. B 동안 막혔던 화면 변경은 화면 기록에 누적돼 있다가 A 복귀 후 첫 저장에 함께 실린다. 테스트(`shared-device-stale.test.ts`)는 A 키 `['A-OWN','A-MID','A-NEW']` · B 키 `['B-OWN']` 불변 · 모든 PUT 의 owner=A 로 고정했다.
- SRS 확인: 주인 판(version)은 늦게 온 세션 조회 응답을 버리는 데만 쓴다. 평가의 주인은 평가하는 순간 이벤트로 갱신된 계정이다. 같은 계정이 로그아웃했다가 다시 로그인하면 그 뒤 평가는 owner=A 이고, 이전 A 평가와 함께 A 의 확인 전송에 실린다(테스트 통과, 코드 변경 없음). 로그아웃과 재로그인 사이에 생긴 평가만 주인 없이 보류된다. 그 순간 로그인한 계정이 없으므로 증명할 주인이 없다. 삭제되지는 않는다.
- 남은 위험: 같은 계정의 두 탭이 서로 다른 화면 기록을 저장하면 늦게 쓴 쪽이 기기 사본을 덮는다. 이는 이번 범위 이전부터 있던 다중 탭 동작이며, 서버 쪽은 항목 단위로 병합한다.
- 실행(최종 커밋): vitest 30 files · 254 passed · skip 0(§7 과 같은 범위). tsc 오류 0. eslint(변경 ts/tsx 전부) 오류 0.
