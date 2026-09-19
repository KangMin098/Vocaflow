# 브리프 — `/flashcard/play` 플래시카드 세션 (S063)

> 생성 2026-09-18 · Claude Code · 근거: [카드](../cards/modules/flashcard_play.md) · [판정](../verdict.md) · DB 질의. 4안은 만들지 않았다.

## 목적 · 여정 위치
- JTBD: "오늘 흐려진 단어를 볼 때, 떠올려 보고 기억을 되살리고 싶다, 그래서 잊기 전에 붙잡는다"
- **여정 ② 의 도착점(첫 학습 완료)** + 여정 ③ 복습 루프의 주 세션.

## 현재 골격 (판정: 평균)
- 첫 시선 = **중앙 단일 카드 + 중앙 대형 Lora 표제어** — Anki/Quizlet 와 같은 모양, R(t)·망각 표시 0.
- 한글 이탤릭 힌트(금지) · risk 계열 분홍 힌트 칩 · 탭처럼 생긴 안내(탭 아님).
- 완료 화면은 `/spellforge` 와 폰트 크기까지 같은 템플릿(✨ 72px + 1s `celebrate` scale+rotate — 모션 예산 초과, `CompletionState.tsx:63,69,77`).
- `components/flashcard/ForgettingCurve.tsx` 는 **0바이트** — 망각 곡선을 여기 두려던 흔적만 있다(카드).

## 자산 (DB 실측)

| 자산 | 값 | 어디 |
|---|---|---|
| 카드별 FSRS | 2,249행 전부 `stability · difficulty · last_review_at` | `vocabularies` |
| R(t) | 코드 | `lib/srs/fsrs.ts` |
| 단어가 나온 글 | `vocabularies.text_id` | 맥락 문장 연결(원칙 5) |

## G1 축 후보
1. **망각** — 카드 뒤(또는 카드 아래 가장자리)에 **이 단어의 R(t) 곡선**: 지금 평가 버튼이 곡선의 다음 모양을 바꾼다(재평가 = 곡선 재설정). "Anki 에 없는 선".
2. **채색 지문** — 카드 앞면이 표제어가 아니라 **그 단어가 나온 원문 한 줄**(단어 칸만 비움) — 맥락 인출(원칙 5), 원문은 `text_id` 로.

## 서명 후보
- 「기억나요」 를 누르는 순간 곡선이 오른쪽으로 늘어난다(안정도 증가) — 정답 scale 대신 곡선 변형. §5.2 화이트리스트 개정 필요(G4).

## 제약
- 모션 7종(카드 뒤집기 유지) · 완료 화면 `celebrate` 1s 제거(예산) · 한글 이탤릭 제거 · 오답에 붉은색 금지(주묵은 앱의 표식).
- D7: 첫 세션이 진단 직후 3번째 전환 — 로딩·빈 상태가 이 자리에서 막히면 활성화가 끊긴다.

## 성공 지표
- 기존: `screen_viewed`(flashcard-play).
- **신설 필요**: `flashcard_session_finished { cards: number; recalled: number; avgRetentionBefore: number }`(숫자만) — 첫 학습 완료는 DB 행에서 파생 가능하면 수집하지 않는다(D4).
