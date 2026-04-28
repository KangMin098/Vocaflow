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
