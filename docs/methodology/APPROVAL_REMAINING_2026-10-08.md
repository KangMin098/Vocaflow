# 승인 요청 — methodology 잔여 2건(2026-10-08)

> 두 건 모두 **DB 쓰기**라서 사용자 승인이 필요하다. 이 문서를 만드는 동안 DB 에는 읽기만 했다.
> G2 `20261008160000` 은 이미 적용됐다(재실행 없음). G2 · Practice 제품 통합과 M8 은 vocaflow-f5 담당이라 이 문서 범위 밖이다.

## A. `_pending_20261008170000_knowledge_trial_evidence_guard.sql`

| 항목 | 값 |
|---|---|
| SHA-256 | `38fb5a5b3d0023475b96682ac019ae26fd94ce53cd60d4e604e18a9ddc918d8f` |
| 막는 것 | Codex 가 PR #153 머지 리뷰에서 낸 DB P1 2건. ① 합성으로 만든 검증을 analyzed 로 둔 뒤 synthetic=false 로 바꿔 실제 효과 근거로 올리는 경로. ② 같은 등급의 근거를 다른 출처로 바꿔치기해도 재검토가 일어나지 않는 경로 |
| 바꾸는 객체 | 트리거 함수 `knowledge_trials_synthetic_immutable` 와 그 트리거를 새로 만든다. `knowledge_evidence_review_item` 은 150000 본문에 출처 필드 비교를 더해 교체한다. **표 · 데이터 변경 없음** |
| 160000 과의 관계 | 160000 이 만지는 함수와 겹치지 않는다(160000 은 `knowledge_trials_analyzed_guard` · 학습 세션 RPC). 둘이 서로를 보완한다: 160000 은 analyzed 로 들어갈 때 실학습자 표본을 검사하고, 170000 은 그 뒤 합성 표시를 뒤집어 검사를 피하는 길을 막는다 |
| 격리 검증 | `scripts/knowledge/pending-guards-test.mjs` 20/20. 이번에 **실제 원장 순서(…150000 → 160000 → 170000)** 로 바꿔 다시 돌렸다 |
| 실제 DB(읽기) | 함수 · 트리거 아직 없음(이름 충돌 없음). trial 2행 모두 `synthetic=false · planned` 라서 새 트리거에 걸릴 기존 행 없음. 항목 156 · 근거 121 · 검토 이력 165 · 적용 2 |
| 되돌리기 | 파일 끝 주석: 트리거 · 함수를 지우고 `knowledge_evidence_review_item` 을 150000 본문으로 되돌린다 |
| 적용 뒤 | PR #153 의 머지 blocker 가 풀린다 |

## B. 응집 사슬 DB 빌드(`scripts/knowledge/vertical-cohesion-link-build.mts`)

관리자 화면을 거쳐 정본 지식 행을 바꾼다. 재실행해도 안전하다.

| 바뀌는 것 | 지금(실측) | 빌드 뒤 |
|---|---|---|
| `cohesion-cues`(principle) 문장 | 「연결사·지시어·반복되는 핵심어가 문장과 문단을 잇는다. 이 단서를 추적하면 글의 구조와 요지가 드러난다. (추론 초안)」 · in_review | 2차 블라인드 양측 채택 문장(근거는 순서 문항 1개 · 일반화 · 필수성 · 효과 미확인) → **adopted** |
| `method-cohesion-tracking`(method) 문장 | 「…순서·삽입·문맥 어휘. (분석자 추론 초안)」 · in_review | 후보 표시 → 실제 연결 확인 → 애매하면 보류 → **adopted** |
| `task-cohesion-link` · 탐구 질문 `cohesion-relation-csat` | 없음 | 새로 만들고 근거(기출 관찰 1건 · 원천 등급 A(knowledge_csat_origins 조회값)) · 연결을 단다 → 과제 adopted |
| 적용 | 없음 | `cohesion-link:2022-36`(문항 화면) · `a3-4`(학습 지도 FIND) 를 만들고 검증 계획을 세운 뒤 **켬** → 학습자 노출 시작 |
| 이웃 항목 | 이 두 항목에 이어진 8개(yt-* 5 extracted · method-gist-synthesis · essence-meaning-processing 모두 in_review) | 노출 중인 이웃이 없다 → 문장을 바꿔도 다른 적용이 멈추지 않는다 |

- 두 항목은 한 번도 채택된 적이 없다(검토 이력은 in_review 각 1건). 그래서 빌더의 「보류 사슬은 다시 켜지 않는다」 가드에 걸리지 않고 끝까지 간다.
- 효과(efficacy)는 `not_assessed` 그대로다. 합성 학습자 결과로 올리지 않는다.
- 빌드 뒤 할 일: 응집 과제 E2E(학습자 패널 · 시도 기록 · 지도 A3-4 링크 · 관리자 추적 · 게이트). 시도 기록 경로가 f5 의 G2 통합과 겹치므로, **E2E 는 f5 의 통합이 끝난 뒤 그 기록 계약으로 돌린다.**

## 결정할 것

1. A — SHA `38fb5a5b…` 적용 승인 여부
2. B — 응집 사슬 빌드(정본 두 항목 문장 교체 + 학습자 노출) 승인 여부. 노출만 미루려면 「켜기 없이 빌드」로 승인할 수 있다 — `--no-activate` 로 돌리면 적용은 초안으로 남고 과제는 adopted 에서 멈춘다(노출 0 — 쓰기 전에 기존 active 적용 · applied 과제가 있으면 중단하고, 끝난 뒤 노출 0 을 다시 확인한다)
