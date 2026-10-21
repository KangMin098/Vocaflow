# @vocaflow/design-tokens — 토큰 추가/변경 규칙

## 위치 (SSoT)

- **CSS Variables 본체** — `src/tokens.css` (웹 전용, `apps/web/src/app/globals.css` 에서 import)
- **JS/TS 토큰 객체** — `src/colors.ts` 외 (RN 전용 + 타입 추론용)
- **스킨(웹 PC 디자인 층)** — `src/skins/tines.css`(학습자 Tines) · `src/skins/admin-app.css`(관리자 3B). 값 동기 대상은 `skins/tines.ts` 하나(`skin-parity.test.ts`) — RN 앱 화면을 바꾸라는 뜻이 아니다
- **PC 학습자 색 역할** — `src/skins/learner-pc.css`는 1024px 이상·학습자 라우트 표식에만 적용하는 웹 전용 재정의다. 중립 읽기/보조 문구·다색 면/잉크 조합을 소유하며 기본/RN 값과 동기화하지 않는다. `/admin`·`/csat`는 표식이 없다.
- **디자인 기준 문서** — 루트 `DESIGN.md`(라우트별 기준)

## 변경 시 절차

> 적용 범위: 아래 절차는 **기본 토큰(`src/tokens.css`)** 을 바꿀 때다(`token-parity.test.ts` 가 `colors.ts` 와 대조). 웹 스킨(`skins/*.css`)만 바꾸는 PC 디자인 작업은 `skins/tines.ts` 값 동기만 하면 되고 `apps/mobile` 은 건드리지 않는다(디자인 범위 PC 웹만 — DESIGN.md).

1. `src/tokens.css` 에서 CSS 변수 값 수정
2. 동일 토큰을 `src/colors.ts` (또는 spacing/radius/...) 객체에서 동일하게 수정
3. 바뀐 결정이 디자인 기준이면 루트 `DESIGN.md` 를 갱신
4. 다크모드 값(`[data-theme="dark"]` + `colorsDark`) 도 같이 검토
5. `docs/DESIGN_DECISIONS.md` 에 변경 사유 1줄 추가 (ADR)

## 절대 금지

- 기본 토큰을 웹/앱 한쪽만 수정 — 두 출처가 불일치하면 디자인이 깨짐(스킨 파일은 웹 전용이라 해당 없음, 단 `tines.css`↔`tines.ts` 는 함께)
