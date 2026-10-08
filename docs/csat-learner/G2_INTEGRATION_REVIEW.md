<!-- docs/csat-learner/G2_INTEGRATION_REVIEW.md -->
# G2: 통합 데이터 계약 검토 · 사전 검증 보고서 (2026-10-08)

| 항목 | 내용 |
|---|---|
| 범위 | 조사 · 설계 · 정적 및 오프라인 검증 · 문서화 |
| 하지 않은 것 | **DB 쓰기 0건** · 다른 세션 브랜치 수정 0건 · 데이터 삭제 0건. 공유 DB에는 SELECT만 했습니다 |
| 기준 | G1 `00b16d639`, [G2_SESSION_CONTRACT](./G2_SESSION_CONTRACT.md)(사용자 결정), 정본 `origin/feat/methodology-vnext` `07ddb2e06` |
| 산출물 | 통합 SQL 초안 [`g2-draft/20261008160000_learning_sessions_integrated.sql`](./g2-draft/20261008160000_learning_sessions_integrated.sql) · 오프라인 검증 [`pglite-harness.mjs`](./g2-draft/pglite-harness.mjs) + [결과](./g2-draft/pglite-harness.result.json) |

## 0. 사용자 결정 (2026-10-08 · 이 보고서 검토 뒤)
| 업무 | 담당 | 권한 |
|---|---|---|
| G2 통합 SQL 검토 · 적용 | **vocaflow-18** (methodology-vnext) | **단일 DB 쓰기 담당으로 지정** — 지정만으로 적용 승인은 아니다. SQL 전문 · sha256 · 변경 객체 · 영향 · 롤백을 보고하고 명시적 승인 뒤 적용. 다른 세션이 DB 쓰기 중이면 적용하지 않는다 |
| `/csat/practice` 이식 | **별도 깨끗한 worktree 의 신규 세션** (b5 종료로 재배정 · 51 재사용 안 함) | 코드 이식 · 검증. 실제 DB · 다른 브랜치 변경 금지 — 인계서 [PRACTICE_PORT_BRIEF](./PRACTICE_PORT_BRIEF.md) |
| G1 학습 루프 | `feat/csat-learning-loop-g1` | 완료 상태 유지 |
| 공통 계약 변경 | vocaflow-18 중심 조정 | 상호 검토 후 적용 |
| Workspace | map-vnext 담당 | 병합 보류 유지 |

**G2 적용 전 필수 조건**: sha256 `779eb9bb…4182a01` 일치(이전 `179d884b…` · `5f3f108f…` 제외) · 최신 마이그레이션 충돌 없음 · 실제 개발 DB 스키마 · RLS · RPC · 이벤트 CHECK 확인 · 세션 공개 전 시도 거부 동작 · Practice 이관 · API 계약 호환 · 트랜잭션 · 롤백 · 영향 범위 · 테스트 계정 · 합성 이벤트 격리. 현재 승인 범위는 **검토 · 검증 · 적용 준비까지**.

## 1. 담당 세션과 소유권 확인
세션 이름이 아니라 아래 네 가지 근거로 판단했습니다. **DB 쓰기 담당은 지정하지 않았습니다**(사용자 승인 대기).

| 세션 | 워크트리 · 브랜치 | 근거 | 판단 |
|---|---|---|---|
| **vocaflow-18** | `Vocaflow-methodology-vnext` · `feat/methodology-vnext` `07ddb2e06` | 본인 답변: 「사용자 결정상 공유 스키마(learning_task_attempts · 이벤트 허용 목록 · efficacy · 통합 계약)는 이 세션」. 오늘 개발 DB에 `20261008120000`·`140000`·`150000` 적용(`schema_migrations`로 확인). 현재 진행 중인 DB 쓰기 없음. 잠금 해제. 멱등 후보 `_pending_20261008140100`은 미적용 | **정본 소유 근거 있음.** 담당 후보 1순위. 지정은 사용자 승인으로 |
| **vocaflow-51** | `Vocaflow-knowledge-vnext` · `feat/knowledge-vnext` `08f2dffb8` | 본인 답변: 「DB 쓰기 없음 · 계획 없음 · 브랜치 동결 · 마이그레이션 폐기 · 공유 스키마 담당 아님」 | 담당 아님 |
| vocaflow-b5 / cd | — | 현재 세션 목록에 없음 | `/csat/practice` 이식 코드를 누가 쓸지는 **사용자 결정 대기**(vocaflow-51 답변) |
| (이 세션) vocaflow-f5 | `Vocaflow-csat-g1` · `feat/csat-learning-loop-g1` | 기출 학습 UX · 세션 계약 설계 | DB 쓰기 담당 아님(설계만) |

참고: 같은 시각 `feat/textbook-factory-phase1` 워크트리를 Codex가 잠그고 있습니다(교재 공장. 이 계약과 겹치는 표 없음).

## 2. 공통 스키마 차이 분석
| 대상 | 개발 DB 현재(SELECT) | 정본 브랜치 | G2 통합 초안 |
|---|---|---|---|
| `learning_task_attempts` | 13열 · 0행 · phase 5종 · 유일 키 없음 | 같음 + `_pending_…140100`(`client_attempt_id`, 미적용) | `session_id`(FK) · `activity` · `help_level` · `client_mutation_id`(+ 부분 유일). phase에 `review` 추가. **`_pending_…140100`을 대체**(같은 목적, 사용자 결정 명칭) |
| 학습 세션 | 없음 | 없음 | `learning_sessions` 새 표(0시도 세션 · 단조 · 삭제 표시 · provenance) |
| 요청 멱등 | 없음 | 위 pending | `learning_mutations` 원장. 세션 변경과 시도 기록이 **같은 키 공간** |
| 첫 시도 | 없음 | `evaluateProtocol`이 코드에서 「문항당 첫 시도만」 | `learning_first_attempts` 뷰(security_invoker) · `after_viewed_first` 표시 |
| `funnel_events` CHECK | 68종 · 기존 20,722행 모두 68종 안(46개 이벤트 실사용) | knowledge 2종은 폐기된 마이그레이션에만 | 68 ∪ knowledge 2 ∪ 기출 13 = **83종** |
| Practice 쓰기 경로 | — | `lib/knowledge/product-server.ts` 직접 INSERT(user_id · task_key · application_id · item_ref · content_hash · phase · response · is_correct · sec) | **그대로 동작**(새 열이 모두 NULL 허용). 멱등 · 세션 연결은 `learning_attempt_record` RPC로 옮길 때 생김 |

## 3. 통합 SQL 초안과 SHA-256
- 파일: `docs/csat-learner/g2-draft/20261008160000_learning_sessions_integrated.sql` (272줄)
- **sha256 `779eb9bb0812719702e16e4fcf34fe5813ed6f9adaa8173cc81a1f7aa4182a01`** (Codex 리뷰 P1 1·2회차 반영본 · 이전 `179d884b…` · `5f3f108f…` 대체)
- 번호: 개발 DB 최신 `20261008150000` 다음입니다. `supabase/migrations`에 **두지 않았습니다**(자동 적용과 번호 선점 방지). 적용 직전에 다시 확인합니다.
- 이전 초안 `learning_task_attempts_ext.sql`(`664ef0e8…`)은 참고 자료로만 썼습니다.

### 변경 대상
| 종류 | 이름 |
|---|---|
| 새 표 | `learning_sessions` · `learning_mutations` |
| 변경 표 | `learning_task_attempts`(열 4 · 인덱스 2 · phase CHECK) · `funnel_events`(CHECK 재정의) |
| 새 함수 | `learning_mutation_claim` · `learning_session_apply` · `learning_attempt_record` (모두 `security invoker` · `search_path=''` · service_role만 실행) |
| 새 뷰 | `learning_first_attempts` (`security_invoker`) |
| 정책 | `learning_sessions_own_select`(본인 SELECT). `learning_mutations`는 학습자 접근 없음 |
| 트리거 | 없음 |

## 4. 데이터 영향 범위
| 대상 | 현재 행 | 영향 |
|---|---|---|
| `learning_task_attempts` | **0** | 열 추가만(백필 없음). 잠금은 ADD COLUMN(널 허용) 메타데이터 수준 |
| `funnel_events` | 20,722 | CHECK 재정의 때 전 행을 재검증합니다. 이미 모두 기존 68종 안이라 실패 없음(사전 SELECT 확인). 짧은 ACCESS EXCLUSIVE 잠금 |
| 새 표 2개 | 0 | 빈 표 |
| 기존 화면 · 코드 | — | 영향 없음. 이벤트 13종은 적용 뒤 별도 커밋으로 켭니다(§6) |

## 5. RLS · RPC · 멱등성 검증 (오프라인, 44/44 PASS)
PGlite 0.2.17 메모리 Postgres에 정본 `learning_task_attempts` DDL과 권한, 현재 68종 CHECK를 **그대로** 만들고 초안을 적용했습니다. 공유 DB에는 닿지 않았습니다.

| 영역 | 검사 |
|---|---|
| 적용 · 호환 | 적용 성공 · 기존 이벤트 행 통과 · 허용 83종 · 목록 밖 이벤트 거부 · 기존 practice INSERT(새 열 없이) 동작 |
| 세션 | 0시도 세션 저장 · 같은 키 같은 내용은 duplicate · 같은 키 다른 내용은 conflict(**변경 없음**) · 도움 수준은 먼저 공개한 값 · 단계는 최신 · 마친 세션은 되돌아가지 않음(stage · finished_at · step) · 복습 예약은 먼저 정한 값 · 삭제 표시 비부활 · 모양이 틀린 세션 거부 |
| 시도 | inserted · 재전송은 duplicate(1행) · 다른 채점은 conflict · 다시 풀기는 새 시도이고 첫 시도는 1개 · 남의 세션 연결 거부 · 해설 먼저 본 세션의 첫 시도에 `after_viewed_first=true` |
| 권한 | 다른 학습자의 세션은 안 보임(RLS) · 학습자의 RPC 직접 호출 거부 · 학습자의 세션 표 직접 쓰기 거부 · 학습자의 멱등 원장 읽기 거부 · 본인 읽기 허용 |
| 되돌리기 | 실행 성공 · 새 표 제거 · 시도 표 13열 복원 |
| 시도의 세션 상속(2회차 P1) | 세션이 있으면 시도는 세션의 activity · phase · item_ref · task_key · help_level 을 상속 · 모순 값(viewed_first 세션에 independent 등) 거부 · 공개 전(open) 세션에 시도 거부 · 첫 시도 뷰는 세션 도움 수준이 정본 |
| Codex 리뷰 P1 회귀 | 늦게 도착한 이른 판단이 첫 시도(판단 시각 순) · 같은 키 다른 판단 시각 → conflict · 같은 키 다른 `application_id` → conflict · 세션 같은 키 다른 `synthetic` → conflict · 이미 쓴 키로 다른 세션 → conflict **이고 빈 세션도 남기지 않음** |

**Codex 리뷰(e601f9a42) 반영**: ① 시도 RPC가 기기의 판단 시각(`p_answered_at`)을 받아 저장하고 첫 시도 뷰가 그 순으로 고른다(네트워크 도착 순이 아님). **클라이언트는 판단 시각을 반드시 보낸다** — 서버가 채운 시각은 재시도마다 달라 비교에서 뺐다(하네스가 잡은 회귀). ② 두 RPC의 멱등 비교에 저장하는 모든 의미 입력(task · application · trial · synthetic · 판단 시각)을 넣었다. ③ 세션 RPC가 세션 행을 만들기 **전에** 멱등 키를 예약해(대상 = client_session_id) 충돌 시 빈 세션도 남기지 않는다. ④ (2회차) 시도가 세션 메타데이터를 상속하고 모순 값을 거부한다 — 판단 제출 전에 세션 공개(reveal)를 먼저 적용해야 한다. 하네스 사본의 import 누락(커밋본에서 실행 불가)도 고쳤다 — 44/44 는 저장소 사본으로 돌린 결과다.

**한계**: 하네스는 마이그레이션 전체 이력이 아니라 **닿는 대상만 정본과 같게 만든 스텁**입니다. Supabase 고유 동작(`auth.uid()`, PostgREST 역할 전환)은 흉내만 냈습니다. 적용 전 최종 확인은 담당 세션이 적용 트랜잭션 안의 사전 검사(§8)로 합니다.

## 6. 이벤트 허용 목록 충돌 여부
- **충돌 없음.** 현재 68종에 knowledge 2종(`knowledge_task_viewed` · `knowledge_task_submitted`)과 기출 13종을 더한 합집합입니다. 정본 브랜치에는 별도 CHECK SQL이 없습니다(vocaflow-18 확인: 「funnel CHECK는 아직 SQL 없음」).
- **규칙**: CHECK는 재정의하는 방식이라 **나중 SQL이 앞 SQL을 덮습니다.** 이 세트 밖에서 다른 CHECK SQL을 만들지 않습니다.
- 기출 13종은 코드에 정의 0건 · 송신 0건입니다(2026-10-08 grep). 적용·확인 뒤 `events.ts` 정의와 송신을 **한 커밋**으로 켭니다.

## 7. G1 기록 이전 계획 (기기 → 서버)
| 기기 기록 | 서버 | 키 |
|---|---|---|
| `sessions[]`(G1) | `learning_session_apply` | `client_session_id = session.id`. 백필 mutation id는 `(session.id, 'g1-backfill', updatedAt)`에서 결정론적으로 만든 uuid → 재실행해도 duplicate |
| `predictions[]`에서 `attempt` 있는 것 | `learning_attempt_record` | `client_mutation_id = prediction.attempt` |
| `attempt` 없는 옛 예측 | **올리지 않음** | 같은 시도라고 단정할 수 없음(G0 §6) |
| 「모르겠어요」 | 시도 아님 → 세션 `help_level=viewed_first` | — |

- 순서: ① 화면이 새 기록부터 서버 API로 이중 기록(기기 기록은 그대로 유지) → ② 기존 기기 기록은 다음에 열 때 클라이언트가 백필(위 키라 재시도해도 안전) → ③ 서버 집계가 기기 집계와 맞는지 합성 계정으로 대조.
- 서버 측 일괄 백필(`csat_learner_state.record` 읽기 → RPC)도 가능하지만 DB 쓰기라 **별도 승인 대상**입니다. 실제 학습자 기록은 검증 계정 2명분뿐입니다(G1 실측).
- 복구: 서버 기록이 실패해도 기기 기록(정본 사본)이 남습니다. 서버가 늦게 받아도 단조 규칙으로 되돌아가지 않습니다.

## 8. 롤백 · 복구 절차
1. **적용 전 사전 검사**(같은 트랜잭션 안. 하나라도 어긋나면 롤백):
   - `learning_task_attempts`의 열 수 13, phase 제약 정의가 정본과 같음
   - `funnel_events`의 기존 이벤트가 모두 68종 안
   - `schema_migrations` 최신이 `20261008150000` 이하
2. **적용 직후 검사**: 열 · 인덱스 · 함수 · 정책 존재, 허용 83종, 학습자 역할의 RPC 실행 거부.
3. **되돌리기**: 초안 끝 주석 블록(한 트랜잭션. 오프라인에서 실행 확인).
   - 전제: 되돌리기 전에 새 이벤트 13종 · knowledge 2종 행, `phase='review'` 시도, `session_id`가 있는 시도가 생겼다면 **그 처리(보존 사본 · 삭제 여부)를 먼저 사용자 승인으로 정합니다.** CHECK와 FK 복원이 실패하기 때문입니다.
4. 앱 쪽 되돌리기: 새 API · 이벤트 송신 커밋만 되돌리면 G1 기기 기록 동작으로 돌아갑니다(서버 기록과 무관하게 동작).

## 9. 남은 차단 요인
| # | 차단 요인 | 누가 |
|---|---|---|
| B1 | ~~DB 쓰기 담당 지정~~ → **vocaflow-18 지정(2026-10-08)** · 적용 승인은 별도 | 해소(지정) |
| B2 | 정본 소유 세션의 이 초안 검토 · 채택. `_pending_20261008140100`(client_attempt_id) 철회 또는 명칭 통일 합의 | vocaflow-18 + 사용자 |
| B3 | ~~Practice 이식 담당~~ → **신규 세션(별도 worktree) 지정** · 인계서 PRACTICE_PORT_BRIEF — 이식 때 쓰기 경로를 어댑터 뒤에 두고 G2 뒤 `learning_attempt_record` 로 | 해소(지정) |
| B4 | `phase='review'`를 효과 프로토콜(pre/post/delayed/transfer)과 같은 축에 둘지 최종 확인 | vocaflow-18 |
| B5 | 효과 측정에서 `after_viewed_first` 시도를 뺄지 · 합성 계정 판정 주체(서버 목록) 확정 | vocaflow-18 + 사용자 |
| B6 | Supabase 실환경 검증(브랜치 DB 또는 적용 트랜잭션 사전 검사) — 오프라인 하네스의 한계 보완 | DB 쓰기 담당 |

## 10. DB 적용 승인 요청 사항 (지금 요청하지 않음 · B1–B3 해소 뒤)
승인 요청서에는 다음을 넣습니다.
- 파일과 sha256(위, 최종 수정 시 재계산)
- 적용 세션
- §8 사전 검사 · 직후 검사 · 되돌리기
- §4 영향 범위
- 이벤트 송신 활성화 커밋은 **적용 확인 뒤 별도**

그 전까지는 다음을 유지합니다.
- 이 초안은 적용하지 않습니다.
- 이벤트 13종은 계속 보내지 않습니다.
- 기존 오염 행 삭제는 다시 실행하지 않습니다.

## 사고 재발 방지 확인 (G1 incident 후속)
- 이번 단위는 브라우저 E2E를 실행하지 않았습니다. 공유 DB에는 SELECT만 했습니다.
- SQL 검증은 전부 메모리 DB에서 했습니다.
- G1 E2E의 로그인 단계 가로채기(`36af66acc`)는 그대로 유지됩니다. 쓰기 검증이 필요하면 별도 격리 환경(오프라인 하네스 또는 브랜치 DB)을 씁니다.
