# 두 번째 수직 경로 — 문장 관계: 연결어 · 지시어 / 순서 (2026-10-08)

> 상태: **코드 · 주석 · 심사 완료 · DB 빌드 미실행(승인 대기)**. 학습자 노출 0 — 게이트가 적용 행(`cohesion-link:2022-36`)이 없으면 막는다.

## 사슬

탐구 질문 `cohesion-relation-csat` → 근거(기출 관찰 1건 · 원천 B · 연구 근거 아님) → 기제 `cohesion-cues`(재사용) → 방법 `method-cohesion-tracking` → 과제 `task-cohesion-link` → 문항 주석 `cohesion-link-2022-36.v1` → 문항 화면 `CohesionPanel` → 학습 지도 FIND A3-4(relation 단계).

## 문항 선택(Claude Code 위임)

2022학년도 36번(순서 · `(B)-(A)-(C)`). 고른 이유: 단락 순서를 정하는 단서가 지시어(such) · the + 명사(The results) · 되풀이 핵심어로 셋 다 들어 있고, 이 문항 안에서 확인할 수 있다.

## 주석(문장 번호만 · 원문 없음 · 골격 서명 고정)

- 단서 1(1번째 뒤 문장) → 정답 [3] · 갈림 [4](채점 제외)
- 단서 2(5번째) → 정답 [2]
- 순서 정답 = 1(`(B)-(A)-(C)`)
- Claude · Codex **블라인드 독립 주석 합의**(갈린 문장은 disputed 로 남김)

## 채택 심사(블라인드 2인)

| 항목 | 1차 Claude | 1차 Codex | 2차 Claude | 2차 Codex |
|---|---|---|---|---|
| cohesion-cues(P) | adopt | **hold**(삽입 문항까지 일반화) | adopt | adopt |
| method-cohesion-tracking(M) | adopt | **hold**(모든 단서가 잇는다고 암시) | adopt | adopt |
| task-cohesion-link(T) | adopt | adopt | — | — |

2차는 P를 「근거는 순서 문항 한 개 · 일반화 · 필수성 · 효과 미확인」으로, M을 「후보 표시 → 실제 연결 확인 → 애매하면 보류」로 고친 뒤 받았다. 2차 Claude 권고(차단 아님): M 단서 목록에 「되풀이 핵심어」를 더할 것.

## 실행 — 승인 뒤

`apps/web` 에서 `tsx --env-file=… ../../scripts/knowledge/vertical-cohesion-link-build.mts`(dev 서버 3001 · 관리자 화면 경유 · 재실행 안전 · REVIEW_HOLD 사슬은 다시 켜지 않는다 · 검토 이력 조회 실패 시 중단).
이 실행은 기존 정본 `cohesion-cues` 진술을 고치고 적용을 켜므로 **별도 승인 범위**다.

## 하지 않은 것

- 효과 주장 없음(합성 학습자 결과는 효과 근거가 아니다) · 삽입 문항은 이 경로 밖 · 진단을 약점으로 확정하지 않음.
