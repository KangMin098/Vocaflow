# Codex 독립 검증 패킷 — 문항↔TASK 판정 규칙 v2

> 상태: **미실행**(2026-10-23 Claude 세션 환경에 Codex CLI 없음). 결과가 오기 전에는 규칙 v2 를 확정 · 확대에 쓰지 않는다.
> 실행(Codex 가 설치된 터미널, 이 워크트리에서):
> `codex exec "$(cat docs/csat-learner/v62/data-expansion/CODEX_REVIEW_PACKET.md)"` — 또는 `node agents/scripts/review.mjs --plan docs/csat-learner/v62/data-expansion/CODEX_REVIEW_PACKET.md`

## 검토 대상

- [RULES_V2.md](./RULES_V2.md) — 제안 규칙
- [README.md](./README.md) §3 — v1 표본 결과(일치 0.789 · κ 0.584)와 갈림 원인
- `pilot-agreement.json` · `pilot-links.json` — TASK별 κ · 갈림 쌍(원문 인용은 sha 만, 원문은 `scripts/csat/map/v62/data/local/`)
- `rules-v2-agreement.json` — 규칙 v2 로 같은 40문항을 다시 A/B 판정한 결과(생성 후)
- 제품 계약 `apps/web/src/lib/csat/map/v62/relevance.ts` · 정본 `docs/csat-learner/v62/LEARNING_MAP_V6_2_CANON.md` §59 · §251–258 · §445

## 질문 (P0/P1 만 보고)

1. RULES_V2 §1 의 「결정 지점」 조작화가 연구 v1.4 의 direct 정의(한 실제 판단 경로의 고유 수행)를 넓히거나 좁혀 기존 98 검토 · 46 링크와 비교 불가능하게 만드는가?
2. §3 의 통합 TASK · E1 기본값 `unknown` 이 목표 관련도(to-be.ts `relevanceUnknown`) · NeedRank 에서 그 TASK 를 **조용히 지우거나** 「필요 없음」으로 보이게 하는가(정본 §445)?
3. E2 · R2 경계(§2)에 대한 반례 — 규칙대로 하면 명백히 잘못 판정되는 문항 유형이 있는가?
4. 두 AI 일치(R1)를 `candidateRelevance` 에만 두고 `relevance` 를 unknown 으로 남기는 처리가 `makeLink` 가드와 어긋나는 곳이 있는가?
5. 규칙 v2 재판정 κ 가 올랐다면, 그것이 판정의 타당성 개선인지 단순히 기본값 강제로 인한 인위적 일치인지 구별할 증거가 충분한가?

## 하지 말 것

TASK 정의 변경 제안 · 사람 검수 대체 · 학습자 결손 판정 주장.
