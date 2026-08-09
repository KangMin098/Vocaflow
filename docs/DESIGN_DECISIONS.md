# Design Decisions (ADR)

각 항목: 결정 / 맥락 / 결과 / 일자 형식. 토큰·라이브러리·구조 변경 시 1줄 이상 추가.

## ADR-001 — 모노레포 (Turborepo + pnpm)
- **결정**: 단일 레포에서 web + mobile + 공유 패키지 관리.
- **맥락**: 디자인 토큰·타입 SSoT 필요, 두 플랫폼 동시 배포.
- **결과**: `apps/`, `packages/` 구조 채택.

## ADR-002 — CSS Variables 축약형(`--p`, `--bg`)
- **결정**: 롱폼(`--color-primary`) 대신 축약형만.
- **맥락**: Parts Kit v05 이미 축약형 / 타이핑 비용 감소.
- **결과**: `packages/design-tokens/src/tokens.css` 가 SSoT.

## ADR-003 — Plus Jakarta Sans / DM Sans / Lora / JetBrains Mono
- **결정**: Hurme Geometric Sans(유료) 대안으로 4종 무료 폰트 채택.
- **맥락**: 라이선스 + 영어 원문(Lora 세리프) 가독성.

## ADR-004 — 면(fill)과 잉크(ink) 토큰 분리 (2026-08-09)
- **결정**: 색 토큰을 "칠하는 색"과 "그 위의 글자색"으로 쪼갠다 — `--active-ink` · `--ios-*-ink` · `--learn-*-ink` · `--on-p`.
- **맥락**: axe(WCAG 2.1 AA) 실측 결과, 브랜드/시스템 원색을 **작은 글자**로 쓰면 거의 전부 4.5:1 미달이었다.
  실측치: `--active` 3.24 · `--ios-green` 2.02 · `--ios-orange` 1.99 · `--learn-known` 2.23 · `--t3` 2.35(최대 2.4 — 어떤 알파로도 AA 불가).
  다크에서는 반대로 밝은 원색이 흰 글자와 부딪혔다(`--p` 위 흰 글자 2.90 · `--success` 위 흰 글자 2.98).
- **결과**:
  - 배경/아이콘/테두리 = 기존 원색 유지(디자인 톤 불변), **글자만** `-ink` 토큰으로 교체.
  - `--t3` 는 **텍스트 색이 아니다**(장식·아이콘·비활성 전용). 의미 있는 글자는 `--t2` 이상.
  - 회귀 방어선: `apps/web/tests/e2e/14-learner-quality.spec.ts` (axe 위반 0 · 44px 터치 타겟 · 라이트/다크 양쪽).
