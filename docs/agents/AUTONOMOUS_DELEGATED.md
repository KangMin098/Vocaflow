# AUTONOMOUS_DELEGATED — 승인 위임 정책 설계(제안 · 미채택)

> 상태: **제안(proposed)**. 이 문서와 `agents/policies/delegation.json` 은 채택 전이다. 채택 전에는 기존 `PR_AUTOMATION v1.1` 과 FINAL 승인 패키지(A · B · B2 · C)가 그대로 적용된다.
> 목적: Claude Code(구현)와 Codex(독립 검증)가 사용자 개입을 최소화하며 FINAL MISSION A~H 를 이어 가도록, **사람 결정이 필요한 곳과 기계가 집행할 수 있는 곳을 분리**한다. 목표 · TASK 정본은 바꾸지 않는다.

## 1. 역할과 경계

| 주체 | 하는 일 | 하지 못하는 일 |
|---|---|---|
| Claude Code | 설계 · 구현 · 수정 · 통합 · 실행 | 자기 결과의 독립 수용 · 사람 사실 확인 |
| Codex | 독립 검토 · 반례 · 안전 판정(수용 기록) | 제품 파일 동시 수정 · 사람 사실 확인 |
| 사람(권한자) | 위임 범위 **채택** · 예외 승인 · Gold · 권리 · 출시 | — |
| 실행기 | 정책 · 권한의 기계 집행(`delegation.mjs` · 승인 훅 · safe-merge) | 정책을 스스로 켜기 |

**두 AI 의 합의만으로 시스템 권한이나 사람의 사실 확인이 생기지 않는다.** 두 에이전트는 같은 GitHub 계정 · 같은 OS 계정으로 움직이므로 「Codex 가 승인했다」는 기록은 사람 승인과 구별되는 경계가 아니다. 그래서:

- 정책 **채택**은 사람만 누를 수 있는 기존 승인 창(1회용 난수 티켓 · `db-approval-hook.mjs`)으로만 기록한다(`adoption.by='human'` · `ticketHash` · `scopeSha`). `status` 만 `adopted` 로 바꾸면 비활성이다(`policyActive` · 시험 DL2).
- 정책 · 실행기 · 가드 · 승인 훅 · CI 정의(`code.protected_paths`)를 바꾸는 PR 은 **safe-merge 가 병합하지 않는다**(사람 병합). 정책 변경을 에이전트가 자기 승인하지 못하게 하는 경계다.
- 한계(정직하게): 같은 OS 계정의 에이전트가 정책을 어기고 파일을 직접 고치는 의도적 위조는 막지 못한다(`db-approval.mjs` 의 문서화된 한계와 같다). 이 설계가 막는 것은 관성 적용 · 자기 승인 · 다른 SHA 로의 승인 전용이다.

## 2. 코드 — 자동(기존 정책 그대로)

기획 · 설계 · 구현 · 개선 · 시험 · 실제 브라우저 · PR · push · Codex 독립 수용 · 필수 CI · 목적 리뷰 · safe-merge. GitHub 보호 규칙과 FI-018 보호(완전한 변경 목록)를 유지한다. 새로 더하는 것은 보호 경로 게이트 하나다.

## 3. DB — 위임 가능한 범위(채택 + 실행 환경 허용 뒤에만)

**위임 가능**: 개발 DB(`jajenrevcbmrpaliomxv`)의 `additive` 등급 마이그레이션 — 새 표 · 새 컬럼(nullable/default) · 새 인덱스 · 권한 · RLS 변화 없는 함수 · 주석.

**위임 불가(기존 사용자 승인)**: 데이터 삭제(DROP · TRUNCATE · DELETE · DROP COLUMN) · 기존 행 변경(UPDATE · 타입 변경 · 백필) · GRANT · REVOKE · RLS · OWNER · ROLE · SECURITY DEFINER · auth/storage 스키마 · 동적 SQL · DO 블록 · EXTENSION · 운영 DB. 등급은 `classifySql` 이 가장 무거운 쪽으로 판정한다(시험 DL3).

**전 조건(하나라도 어긋나면 적용 안 함 · `evaluateDelegatedApply` · 시험 DL4)**

1. 정책 채택됨(사람 티켓) · `db.enabled=true`
2. 대상 DB = 위임 목록
3. 버전 번호 있는 마이그레이션 파일(`_pending_` · 임의 경로 불가)
4. 파일 본문 sha256 = 승인 대상 sha256
5. **같은 sha256** 에 결속된 Codex `ACCEPT`(작성자 자기 수용 불가)
6. 등급 `additive`
7. 적용 전 checkpoint(`/db-checkpoint`)
8. 같은 버전 적용 이력 없음(재적용 금지)
9. 단일 트랜잭션 · 실패 시 롤백 · 적용 후 스키마 · 권한 · `schema_migrations` sha 확인 · 실행 주체 · 결과 감사 기록

실행기(`scripts/db/delegated/deploy.mjs`)는 **채택 뒤 별도 PR** 로 만든다. 이 PR 은 판정기만 넣고 실행기는 넣지 않는다 — 판정기가 있어도 `db.enabled=false` · 미채택이면 어떤 적용도 일어나지 않는다. 기존 승인 티켓을 위조 · 재사용하거나 훅을 우회하지 않는다.

## 4. Gold — HUMAN_REVIEWED 와 AI_VERIFIED 분리

- `HUMAN_REVIEWED`(content_human_decision kind=gold): 사람이 그 revision 의 정답 · 루브릭을 직접 확인한 기록. **의미 불변.** AI 가 이 행을 쓰지 않는다.
- `AI_VERIFIED`(새 원장 `content_ai_verification` · 제안 SQL `supabase/migrations/_pending_ai_verified_ledger.sql` · 미적용): Claude 작성 revision · Codex 독립(맹검) 판정 · 정답/오답/대안 근거 · 형식 validator + 내용 검증 · 다른 지문 전이 검사 · 콘텐츠/Gold 해시 · 실패 · 철회. 작성자(claude)와 판정자(codex)가 달라야 하고 추가 전용이다.
- **출시 등급**: `internal`(격리 · 내부 검증 · 합성 학습자)만 AI_VERIFIED 로 연다. `learner_public`(실제 학습자)은 사람 Gold 필수 — 사용자가 정책으로 AI_VERIFIED 공개를 채택하기 전까지 공급 판정(`supply_human_decisions_ok`)은 바뀌지 않는다.

## 5. 권리

- 출처 · 이용 권리는 사람 결정 원장(kind=rights)과 자체 창작 제작 기록(`authored_item.provenance`)으로 관리한다.
- 자체 창작물 점검: 제작 기록(작성자 · 방법 · `derivedFrom=[]`) · 이용 조건(store · display · transmit · 평가 역할 assess) · 유사성 위험(기출 · 외부 저작물 대조) · 허용 범위.
- 기출 원문 · 외부 저작물은 권리 근거가 불충분하면 공급하지 않는다. **AI 검토를 사람의 법적 확인으로 표시하지 않는다.** 사용자가 「자체 창작물 사용 방침」을 한 번 채택하면 그 방침을 근거로 세트마다 묻지 않고 기록할 수 있다(그 기록의 basis 는 방침 id — 사람 개별 확인으로 표시하지 않는다).

## 6. 단계별 — 자동 · 사람 · 집행 가능 여부

| 단계 | 자동(에이전트) | 사람 결정 | 지금 집행 가능? |
|---|---|---|---|
| 코드 구현 · 시험 · PR · CI · Codex 수용 · safe-merge | ✓ | — | ✓(PR_AUTOMATION v1.1) |
| 정책 · 실행기 · 가드 · CI 정의 변경 병합 | — | ✓ 사람 병합 | ✓(이 PR 의 보호 경로 게이트) |
| 위임 정책 채택 | — | ✓ 승인 창 티켓 | ✗ 채택 기록 경로 미구현(다음 PR) |
| 개발 DB additive 마이그레이션 | 채택 뒤 ✓(Codex 수용 + 판정기 + 실행기) | 채택 1회 | ✗ 실행기 미구현 · `db.enabled=false` |
| 개발 DB 삭제 · 권한/RLS · 운영 | — | ✓ 매번 | ✓(기존 승인 티켓) |
| AI_VERIFIED 기록(internal) | 채택 + 원장 적용 뒤 ✓ | 원장 SQL 승인 1회 | ✗ 원장 미적용 |
| 사람 Gold(HUMAN_REVIEWED) | — | ✓ revision 별 | ✓(사람만) |
| 실제 학습자 공개 | — | ✓ 정책 채택(AI_VERIFIED 공개 허용 여부) | ✗ 사람 Gold 필수 유지 |
| 권리 | 방침 채택 뒤 방침 근거 기록 | ✓ 방침 1회 · 기출/외부는 매번 | ✗ 방침 미채택 |

## 7. 채택 절차(사람)

1. 이 PR 을 Codex 가 독립 검증(정책 · 권한 · 실행기 · Gold 구분 · 권리 · 공개 단계 · 회귀). 기존 안전 조건을 약화하면 거절.
2. 사람이 이 PR 을 병합(보호 경로 — 에이전트 병합 불가).
3. 다음 PR: 채택 기록 러너(`scripts/policy/adopt.mjs` · 승인 창 티켓) + 위임 DB 실행기 + AI_VERIFIED 원장 적용 SQL(사용자 승인). 각각 Codex 수용 · 사람 병합.
4. 사람이 승인 창에서 채택 → `delegation.json` 의 `adoption` 이 티켓으로 채워진다 → 그때부터 판정기가 활성.
