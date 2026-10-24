# C DB 정정 적용 뒤 검증 (2026-10-25) — DB 읽기 전용

## 승인 근거

- 사용자 메시지(2026-10-25) 「승인」 — 직전 보고의 「승인 필요」 목록(1. 6건 forward.sql `d79e119c…` · 2. 2014A#29 단계 1 stage1.sql `12c2915e…` + 되돌리기)에 대한 답. 실행 직전 두 파일 sha256 재확인 · 사전 상태 7/7 before.
- 단일 낱말 승인이라 범위는 해석이다: 1 · 2 의 forward 만 실행했다. 3(사람 내용 승인) · 단계 2 · 되돌리기(삭제)는 실행하지 않았다.
- 실행 경로: claude.ai Supabase 커넥터 `execute_sql`(DO 블록 2회). 정책 `db_apply` 가 적은 `mcp__supabase__*` 와 다른 서버이고, DB 승인 팝업·티켓 훅(`vocaflow-db-approval.mjs`, Bash 전용)은 이 경로에 걸리지 않는다 → **승인 티켓 · 공식 실행 이력 항목 없음**. 남은 증거는 대화 메시지 · 이 문서 · 적용 전후 SELECT 해시뿐이다. 소급 생성하지 않는다.

## 7문항 결속 감사 (`csat-binding-audit.mts --item`, 로컬 main ff0a5da48)

| 문항 | analysisPick | 차단 이유 | 결함 | 판정 |
|---|---|---|---|---|
| 2014A#29 | unbound | no_current_units · analysis_unbound · **footnote_missing** | footnote_mark_without_gloss(「Hours*」) | 「month.」 조각(orphan_fragment) 사라짐. 각주 문장은 복원됐지만 검출기는 「* 용어: 풀이」 형태만 짝으로 센다 — 안내문 각주(문장)는 짝이 없다고 본다 → T-0154 검출 규칙 한계(오탐). 결함 「해소됨」으로 보고하지 않는다 |
| 2025#30 | unbound | no_current_units · analysis_unbound · extraction_defect | choice_overrun ×5 | 밑줄형 선지 40자 초과 규칙. 규칙이 `*` 뒤를 이미 잘라 보므로 이번 정정과 무관한 기존 결함 |
| M1809#35 · M2006#35 · M2106#35 · M2206#35 · M2209#35 | unbound | no_current_units · analysis_unbound | 0 | 정정 뒤 결함 0 |

- `no_current_units` · `analysis_unbound` 는 kice 전체 공통(전수 집계 no_current_units 802 · unbound 963) — 이번 변경이 만든 상태가 아니다.

## 2014A#29 제공 상태 — 판본 충돌 있음

- 로더는 최신 published = **v5**. v6 는 draft(검수 0)라 학습자에게 안 나간다.
- v5 design_intent 는 「지문에 'month.' 조각만 남아 … 판정을 보류」 — DB 지문에는 이제 각주가 있다 → **v5 문구가 현재 DB 지문과 어긋난다**(학습자 화면은 공식 PDF 라 각주는 원래부터 보였다 — 학습자 쪽 어긋남은 정정 전부터 있었다).
- 강의 v2 · 탐구도 같은 「보류」 전제(main). v5 · 강의 v2 · 탐구는 서로 맞고, 셋 다 공식 각주와 어긋난다. 해소는 단계 5(v6 · 강의 v3 · 탐구 동시 전환)뿐이다.
- 실제 HTML/RSC 확인: 로컬 3000 서버가 꺼져 있어 실행 안 함.

## 2단계 준비도

- 콘텐츠 브랜치 `content/2014a29-footnote` 에 최신 main 병합(4cd196fd0) — 충돌 0, main 대비 변경 2파일(강의 2014A · 탐구) 그대로.
- Vitest `src/lib/csat`(900초 제한에서 중단 — 전량 완료 아님): 실패 4 = 기존 3(embargo-gate-coverage · exam-id ×2, 패치 전부터) + disclosure.test 1(「2014A#29」 — 대본 변경으로 digest 불일치, owner 재생성 대상).
- 공식 각주 대조: 강의 c9 v3 · 탐구 6경로 · v6 draft 3필드 모두 「매월 첫째 월요일(the first Monday of every month)」 · 정답 ⑤ 와 일치(감수 판정 파일 · BINDING.json 해시).
- stage2.sql: 사람 승인자 · 시각 · digest 가 없어 **생성하지 않음**(만들려면 승인자 값을 지어내야 한다).
- 사람 내용 승인 0 · AI 역할 검수 3(기록만).
