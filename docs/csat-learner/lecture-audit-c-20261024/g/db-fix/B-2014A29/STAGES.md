# 2014A#29 — 일괄 발행(bundle.sql) 대신 단계 분리 (2026-10-24)

`bundle.sql` 은 **승인하지 않음**(사용자 결정 2026-10-24). 실행하지 않고 기록으로만 둔다.
AI 세 역할(setter=Codex · analyst=Claude · tutor=Claude) 검수는 **AI 검토 결과**이며 사람 내용 승인이 아니다.

## 단계

| # | 내용 | 산출물 | 승인 | 학습자 화면 영향 |
|---|---|---|---|---|
| 1 | 지문 각주 정정(compare-and-set) + 분석 v6 **draft** 1행 | `stage1.sql` · 되돌리기 `stage1-recovery.sql`(초안 1행 삭제 포함 → 삭제 승인 함께) | DB 변경 승인 | 없음 — 화면은 공식 PDF, 로더는 최신 **published**(v5) |
| 2 | AI 검수 기록 | 저장소 `g/review-2014A29/` (DB 미기록) | 불필요 | 없음 |
| 3 | 사람 내용 승인 | 승인자 · 시각 · `BINDING.json` sha256 | **사람 승인** | 없음 |
| 4 | digest 재생성 | owner `csat-lecture-disclosure` 가 강의 c9 v3 기준으로 | owner | 없음(브랜치 안) |
| 5 | 발행 | `make-stages.mjs --approver … --approved-at … --binding …` → `stage2.sql`(AI 검수 행 3 + `checked` 에 「reviewer_kind: ai」·사람 승인 표시 + published) | DB 변경 승인 | v6 · 강의 v3 · 탐구 동시 전환 |

AI 검수 행은 발행 게이트(`csat_guard_published`: 페르소나 3 pass)를 채우므로 **단계 1 에 넣지 않는다**. 넣으면 사람 승인 없이 발행할 수 있는 상태가 된다.

## 판본 결속 — `BINDING.json`

강의 2014A#29 v3 sha256 `68707d77…` · 탐구 항목 sha256 `ffbe86d9…`(콘텐츠 커밋 `b449561b3`) · v6 예정 md5(SELECT 로 미리 계산: choice_analysis `6d6966e6…` · design_intent `26bda96c…` · solve_procedure `6a6e9fb5…`) · digest(**미정** — owner 재생성 뒤 채움). digest 가 비어 있으면 단계 5 금지.

## 전환(섞임 방지)

현재 강의 v2 · 탐구는 「각주 잘림·보류」 전제, v5 분석도 같은 전제라 **지금은 서로 맞는다**. 섞이는 경우는 둘: (가) v6 만 발행 (나) 강의 v3 만 main 통합.
1. 단계 1 은 언제 해도 섞이지 않는다(draft · 화면 불변).
2. 단계 5 는 하나의 잠금 구간에서: `lock.mjs acquire` → 콘텐츠 브랜치 + digest 를 로컬 main 에 `merge --no-ff` → 즉시 `stage2.sql` → 검증 → `release`. 실패하면 main 병합을 되돌리는 커밋(revert) 과 v6 를 draft 로 되돌리는 승인 SQL 로 v2/v5 판본에 복귀.
3. 검증(발행 직후, 같은 구간): `/csat/…/2014A#29` 실제 HTML·RSC 응답에 v6 문구(「오답 넷은」) 포함 · 「보류」「month.」 없음 · 강의 c9 낭독 문구 · 정답 공개 경계(disclosure.test 통과 · 공개 전 화면에 정답 ⑤ 근거 미노출).
4. 원격 코드(origin/main)는 일일 main-sync 전까지 강의 v2 다. 같은 개발 DB 를 읽는 다른 실행 환경(다른 worktree 서버 등)은 그 사이 v6 + 강의 v2 를 보일 수 있다 — 단계 5 는 sync 직전에 하고, 그 환경 목록은 실행 전에 확인한다(미확인).

## SHA-256

| 파일 | sha256 |
|---|---|
| `stage1.sql` | `12c2915e873623b3a133fb9b20fa51bf272c8880d14741515da76a4c03b58764` |
| `stage1-recovery.sql` | `49912c564cd9f0b34dca06b8765683c3f174b69d23d92a4bfc884cdcd4c77966` |
| `bundle.sql`(미승인 · 미실행) | `7d4460257733e6b37f62a63caf9c5b180e6359d353daa8b242db4d82b6f2cb63` |

## 다른 작업과의 관계 (로컬 main 0d801ece0 기준)

- T-0154(원문·근거·선지 결속 계층)는 2014A#29 를 `footnote_missing` 실례로 쓴다. 테스트는 고정 fixture(`binding/__tests__/fixtures/real-items.json`)라 단계 1 뒤에도 깨지지 않는다. 실데이터 감사(`csat-binding-audit.mts`)에서는 단계 1 뒤 이 결함이 사라지는 것이 기대 결과다 — 단계 1 검증에 이 감사 1 문항 실행을 넣는다.
- 콘텐츠 브랜치 `content/2014a29-footnote`(b449561b3)는 0430c9ece 기준이다. 단계 5 병합 전에 최신 main 을 합쳐 재검증한다.

## 적용 기록 (2026-10-25 · 사용자 승인 「승인」 — 단계 1 만)

- stage1.sql sha256 `12c2915e…8764` 재확인 → 적용. 지문 md5 354dba3d… → `6b4dd8818f63a6c9086b06dd8833027a`(각주 문장 포함).
- v6 draft 1행: choice_analysis `6d6966e6…` · design_intent `26bda96c…` · solve_procedure `6a6e9fb5…` = BINDING 예정값. 검수 행 0 · 최신 published = v5(학습자 화면 불변).
- 원장 수리 기록(passage) 로컬 main ff0a5da48 에 병합 · 재생성 원장 지문 = DB.
- 미실행: 단계 2(사람 내용 승인 · digest 재생성 대기) · stage1-recovery.sql(초안 삭제 — 별도 삭제 승인 필요).

## 2026-10-25 사용자 결정 반영

- 발행 보류: 권한 있는 **실제 사람** 검수자의 트랙별(분석 v6 · 강의 c9 v3 · 탐구) 내용 승인 전에는 단계 2 SQL 생성 · 실행 · 브랜치 통합을 하지 않는다. AI 세 역할 검수는 AI 검토 기록일 뿐이다.
- 실행 경로: 단계 2 는 MCP 가 아니라 승인형 러너 단계로만(dev-mode `db_apply` 2026-10-25) — 러너 단계는 사람 승인 뒤 만든다.
- 판본 충돌(published v5 · 강의 v2 「보류」 ↔ DB 지문 각주)은 **미해결**. 혼합 방지: v6 발행과 강의 v3 통합은 한 잠금 구간(단계 5)에서만.
- digest 재생성: owner `csat-lecture-disclosure` 에 요청(AI-Control `runtime/c-2014a29-review/DELIVERY-digest.md`). HTML/RSC 검증은 digest · 사람 승인 뒤 단계 5 에서.
