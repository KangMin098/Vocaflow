# @vocaflow/design-tokens — 토큰 추가/변경 규칙

## 위치 (SSoT)

- **CSS Variables 본체** — `src/tokens.css` (웹 전용, `apps/web/src/app/globals.css` 에서 import)
- **JS/TS 토큰 객체** — `src/colors.ts` 외 (RN 전용 + 타입 추론용)
- **루트 SSoT 문서** — 프로젝트 루트 `CLAUDE.md` §Colors / §Spacing / §Motion

## 변경 시 절차

1. `src/tokens.css` 에서 CSS 변수 값 수정
2. 동일 토큰을 `src/colors.ts` (또는 spacing/radius/...) 객체에서 동일하게 수정
3. 루트 `CLAUDE.md` 표를 업데이트
4. 다크모드 값(`[data-theme="dark"]` + `colorsDark`) 도 같이 검토
5. `docs/DESIGN_DECISIONS.md` 에 변경 사유 1줄 추가 (ADR)

## 절대 금지

- 게임 전용 하드코딩 색상(WordBlitz `#3d8a3d`, SpellForge `#4A9FCF` 등)을 `--p` 등 일반 토큰으로 변경
- 토큰 이름 롱폼화(`--color-primary`) — 축약형(`--p`) 만 사용
- 웹/앱 한쪽만 수정 — 두 출처가 불일치하면 디자인이 깨짐
