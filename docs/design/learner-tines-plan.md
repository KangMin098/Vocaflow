# PC 학습자 화면 Tines 적용 — 다음 단계 실행 계획

> 작성 2026-10-18 · Claude Code · 기준 [DESIGN.md](../../DESIGN.md)(DD-83) · 근거 [learner-tines-audit](./learner-tines-audit.md) · 코드 origin/main `c3a03d168`.
> 범위 PC 웹(1440/1280). 관리자·모바일 웹·`apps/mobile`·`/csat` 디자인 변경 제외. 학습 데이터·채점·FSRS·기억 4색·권한 불변.

## 목적과 완료 기준

목적: 학습자가 공개 메인부터 학습 세션까지 **같은 Tines 계열의 한 제품**으로 느끼게 한다(색 교체가 아니라 골격·위계·부품·팝업·삽화·동작).
단계 완료 기준(모든 단계 공통):
1. 변경 화면마다 감사 표의 **R·I·V 칸을 날짜·커밋 SHA·캡처 경로·대조표로 채운다** — 캡처 없는 「완료」 금지, 로그인/오류/로딩 캡처는 증거 아님.
2. `pnpm turbo run lint typecheck test` 통과, 기존 학습 e2e(스모크) 통과.
3. 학습 기능 회귀 0: 채점·FSRS 기록·기억 4색 계산(동적 R(t))·권한 경로는 diff 대상 밖이거나 테스트로 고정.
4. 접근성: 44px · 보이는 focus · 색만으로 정보 금지 · `break-keep` · reduced-motion 낮추기.

## 단계

| 단계 | 내용 | 산출물 · 검증 | 되돌리기 |
|---|---|---|---|
| **S0 증거 기반(코드 변경 없음)** | 검증 계정 1개(학습 기록 있는) 확보 → 계정 소유 `texts.id`·`dictation_sessions.id` 조회 → 감사 표 P1 행(약 20개)을 PC 1440/1280 라이트/다크로 **현재 상태 캡처**(R 칸 채움) · 팝업·탭 실행(I 칸). Tines 대응 화면도 같은 뷰포트로 캡처(`tmp/`, 커밋 금지) | 감사 표 갱신 · 캡처는 로컬 `docs/design/shots/learner-tines/`(gitignore) · 실패/튕김 행 목록 | 문서만 |
| **S1 차단 해제** | ① 스킨 해제 경로 제거(`layout.tsx` env·쿼리·저장값, 관련 주석 3곳) + 회귀(스킨 속성 항상 `tines`) ② `playwright.visual.config.ts` 기본 프로젝트를 1440/1280 으로, 모바일은 opt-in ③ `apps/web/CLAUDE.md` 390 측정 문단에 「과거 기록」 표기 | 단위 테스트 1 · `test:design --project=1440-light` 실행 기록 | 커밋 단위 revert |
| **S2 공통 부품** | B4 팝오버/모달 규격 하나(Tines ui-kit 모달·팝오버 측정값 → 스킨 변수) · B3 세리프 하드코딩 클래스 → 변수 · B9 빈/오류/로딩 SpotState 배정 · B2 학습자 셸 검색(기존 `SearchDialog` 재사용 — 새 API 없음) | 부품별 전/후 캡처 · 대조표 · 키보드(Esc·Tab 가둠·포커스 복귀) | 부품별 |
| **S3 P1 화면** | 순서: `/hub` → `/library/books`(+상세·시트) → `/wordvault`(+browse/study/review) → `/text` → `/text/[id]`(작업면, 마케팅 요소 금지) → `/dashboard` → `/flashcard/play` 세션 공통(B7) → 인증(B8) | 화면별 R·I·V 갱신 · `pnpm design:ref-compare` 계열 대조표(없으면 측정 스크립트 추가) | 화면별 커밋 |
| **S4 P2/P3 일괄** | 나머지 모듈 허브·세션·결과, 서가 하위, 계정·교사(학습자 구역), 게임 브리프·일시정지 공통부 | 같은 기준 | 묶음별 |
| **S5 정리** | DESIGN_SYSTEM.md 절 분리(B11) · 미사용 부품 결정(B10) · 감사 표 최종 | CHANGELOG · 문서 | — |

## 위험과 대응

| 위험 | 대응 |
|---|---|
| 메인 워크트리(`design/replica-first`, 미커밋 309 · 충돌 7 · main 대비 664 커밋 뒤)의 Tines 작업과 중복 | 그 변경은 되돌리거나 해결하지 않는다. 필요한 자산(삽화 path-* 등)은 **파일·커밋 출처를 표기해 개별 반입**(B14). 반입 전 소유 세션 확인 |
| `/csat` 3B 장치가 main 에 없음 | 이 트랙에서 만들지 않는다(B13, CSAT 담당과 조율) — 학습자 변경이 `/csat` 에 번지지 않도록 셀렉터를 `/csat` 밖으로 한정하고 `/csat` 캡처로 무변화 확인 |
| 스킨 값 변경이 RN 토큰 동기를 부른다 | 학습자 값은 `skins/tines.css`(+`tines.ts` 동기)에만, 기본 `tokens.css` 불변 |
| 「측정 항목 일치 = 화면 일치」 오보 | 대조표에는 측정 항목과 남은 차이를 함께 적는다 |
| 고정 문구가 검증 상태로 오인 | `remaining-learning-audit.mjs` 식 경로별 고정 상태 출력 금지 — 상태는 캡처·테스트 산출물 경로를 읽어 표시 |

## 이번 단계(1단계)에서 한 것 / 안 한 것

- 한 것: 작업 기반 확인(새 워크트리·잠금) · DD-83 · DESIGN.md 정본화 · 지침 충돌 20건 수정/표기 · 전수 목록(학습자 90 + CSAT 11) · 백로그 14.
- 안 한 것: 화면 CSS·컴포넌트 변경 · 렌더/상호작용/시각 검증(R·I·V 전부 미실행) · 메인 워크트리 변경 반입.

## 계획 리뷰

AGENTS.md(origin/main) 규약상 자동 Codex 리뷰는 없고 `review.mjs` 는 사용자 요청 시 수동이다. 이번 요청이 명시했으므로 `node agents/scripts/review.mjs --plan docs/design/learner-tines-plan.md` 결과를 아래에 붙인다.

**결과(2026-10-18, Codex)** — 지적 1건:
- [P2] 목적 이탈 — 감사·계획 문서와 지침 수정이 미커밋이라 HEAD 에 산출물이 없다 → **반영**: 검사 통과 후 커밋·push(이 문서가 그 커밋에 들어 있다).
계획 내용(단계·순서·범위)에 대한 결함 지적은 없었다.
