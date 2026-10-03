# @vocaflow/design-tokens — 토큰 추가/변경 규칙

## 위치 (SSoT)

- **CSS Variables 본체** — `src/tokens.css` (웹 전용, `apps/web/src/app/globals.css` 에서 import)
- **JS/TS 토큰 객체** — `src/colors.ts` 외 (RN 전용 + 타입 추론용)
- **스타일·라우트 정본** — 프로젝트 루트 `DESIGN.md`. 웹 스킨 `skins/tines.css`(기본)와 `skins/csat-app.css`(`/csat` 표식). 베이스 토큰과 분리한다.

## 변경 시 절차

1. `src/tokens.css` 에서 CSS 변수 값 수정
2. 동일 토큰을 `src/colors.ts` (또는 spacing/radius/...) 객체에서 동일하게 수정
3. `DESIGN.md`·`docs/DESIGN_SYSTEM.md`를 갱신(스킨은 베이스 표를 덮지 않는다)
4. 다크모드 값(`[data-theme="dark"]` + `colorsDark`) 도 같이 검토
5. `docs/design/DECISIONS.md`에 변경 사유를 기록. 라우트 스킨 범위만 바꾸면 RN 색 객체를 변경하지 않는다.

## 절대 금지

- 웹/앱 한쪽만 수정 — 두 출처가 불일치하면 디자인이 깨짐
