# Vocaflow 디자인 적용 기준

> **정본(2026-10-03 사용자 지정 · main 반영 2026-10-18, DD-83).** 스타일과 화면 틀의 정본은 이 파일이다.
> 디자인을 따로 요청하지 않은 기능 추가·수정에도 적용한다. 옛 주묵 판면(v07)·「동결/수정 금지」(DD-62)·
> DD-24 「Tines 와 닮지 않기」 문구와 충돌하면 이 파일을 따른다. 원문 출처: 브랜치 `design/replica-first` 커밋 `9b9078d90`.
> 외부 취향 스킬(`design-taste-frontend` 등)은 참고 자료다 — 이 파일의 Tines 기준(보라 잉크·다색 틴트·세리프 편집 제목·알약 CTA·진한 구획)을 덮지 않는다.

## 범위

**디자인 작업 대상은 PC 웹만이다.** 모바일 웹(390px 등)과 `apps/mobile`은 제외한다(2026-10-03 사용자 재확인).
별도 요청 없이 모바일 전용 디자인·메뉴·화면·검증을 추가하지 않는다. 옛 모바일 퍼스트·390px 문구보다 이 범위가 우선한다.

| 라우트 | 기준 | main 의 적용 장치(2026-10-18 확인) |
|---|---|---|
| `/csat`, `/csat/*` | [neon-currant.3b.dev](https://neon-currant.3b.dev/) **3B 앱** | **미구현** — `skins/csat-app.css`·`data-design-scope="csat"` 는 main 에 없다(미병합 브랜치에만). 현재는 루트 Tines 스킨 + CSAT 모듈 CSS(`components/csat/space` 등) |
| `/admin`, `/admin/*`(관리자 CSAT 포함) | **3B 앱** | `app/admin/layout.tsx` 의 `data-area="admin"` → `skins/admin-app.css`(DD-82) |
| 그 외 모든 화면(공개·인증·학습·게임·계정) | [www.tines.com](https://www.tines.com/) **웹사이트** | 루트 `app/layout.tsx` `data-skin="tines"`(고정 — 환경변수·쿼리·저장값으로 끄지 않는다, `skin-always-on.test.ts`) → `skins/tines.css` |

본문·모달·시트·팝오버·토스트는 현재 라우트의 토큰을 함께 쓴다. 라이트/다크·모션 감소 설정은 유지한다(다크는 각 스킨의 대응 디자인).

## 참조 범위 — 사이트·앱 전반

두 URL은 진입점이다. **메인 화면과 색·서체에 한정하지 않고 하위 화면·기능·프로세스와 모든 디자인 요소를 기준으로 삼는다.**

| 참조 층 | 포함하는 요소 | 적용 방식 |
|---|---|---|
| 화면 | 목록·상세·작업면·설정·검색·필터·대시보드·생성/편집·빈 상태 | 참조의 해당 유형에서 정보 배치·밀도·폭·간격·스크롤을 가져온다 |
| 기능·프로세스 | 진입 → 선택/입력 → 확인/실행 → 결과, 뒤로·취소·오류·재시도 | 진행 방식과 피드백을 제품의 실제 기능에 대응시킨다 |
| 팝업·탭 | 모달·시트·팝오버·툴팁·메뉴·서랍·탭·아코디언·토스트 | 닫힌/열린/선택 상태, 배경막·포커스·닫기·내부 스크롤·전환을 함께 적용한다 |
| 입력·표시 부품 | 버튼·링크·폼·선택기·체크박스·표·카드·칩·배지·차트 | 크기·위계·배치와 호버·포커스·활성·비활성·검증 상태를 대응시킨다 |
| 이미지·아이콘 | 삽화·썸네일·패턴·도해·제품 액자·기능 아이콘 | 구도·역할·선 굵기·크기·색 조합을 맞추고 자체/허용 자산을 쓴다 |
| 표현·환경 | 서체·색·테두리·모서리·그림자·모션·테마 | 하위 화면에서도 같은 계열을 유지하며 한국어·접근성·테마에 대응한다 |

Tines는 제품·솔루션·목록·상세·라이브러리·가격·교육·이벤트·문의·법률 화면과 공통 검색·메뉴·탭·폼·미디어 동작까지 참조한다.
3B는 Recents·Monitoring·Connectors·Skills·워크플로 작업면·Access map·설정/접근 팝업까지 참조한다.
원래 서비스의 사업 기능은 Vocaflow의 학습 기능으로 대응시킨다. 하위 디자인 적용은 필요 없는 기능을 새로 만드는 근거가 아니다.
**자료가 부족해도 참조 범위가 홈으로 축소되지는 않는다** — 미확보는 [학습자 감사](docs/design/learner-tines-audit.md)에 남긴다.

## 두 디자인의 기본과 틀

| 요소 | CSAT·관리자 — 3B 앱 | 나머지 — Tines 웹사이트 |
|---|---|---|
| 지면·텍스트 | 흰 패널, 웜 중립 캔버스, 먹색 글자 | 크림 지면 `--bg`, 웜 중립 구획, 보라 제목·본문, 다색 틴트·진한 구획 |
| 서체 | Inter + 한글 Pretendard, 수치 JetBrains Mono | Figtree + 한글 Pretendard(UI), Petrona + Hahmlet(편집 제목), Space Mono(라벨) — 참조 상용 서체의 무료 대체 |
| 화면 골격 | 좌측 레일 → 상단 줄 → 작업 패널 → 탭·목록 → 상세/팝업 | 상단 알약 내비·메가메뉴 → 페이지 머리 → 목적에 맞는 구획/목록/작업면 |
| 모서리·선 | 얇은 중립선·작은 컨트롤, 지도/모달 기하는 측정 명세 | 알약 CTA·내비, 얇은 라벤더선, 둥근 액자·카드 |
| 그림 | 패턴 띠·노드·관계도에 대응하는 자체 자산 | `public/illustrations/tines/` 자체 삽화, 틴트면·패턴·액자 |
| 팝업 | 먹색 16% 배경막, 블러 0, 산세리프 제목 | 공통 `Dialog`/`SearchDialog`/시트 + Tines 토큰 |

**색만 바꾸면 적용 완료가 아니다.** 화면 골격·타이포 위계·폭·간격·버튼·입력·팝업·삽화 역할·핵심 동작을 대응시킨다.
좁은 중앙 컨테이너에 네모 카드만 쌓인 화면은 열린 솔루션 제목·비대칭 면·분류 레일/열린 행(Library)·격자 작업면(University)처럼
**기능에 맞는 하위 골격**을 고른다. 학습 세션·관리 표에 마케팅 히어로·푸터를 끼워 넣지 않는다.
학습 기록·문항·채점·FSRS·기억 4색·권한·접근성(44px·focus·색만으로 정보 금지)·실측 수치(I5)·저작권(참조의 로고·삽화·상용 서체 복사 금지)은 제품 정본을 따른다.

## 별도 디자인 요청이 없어도 수행할 절차

1. 라우트로 기준을 정한다. 현재 정상 화면을 PC(1440/1280)로 캡처하고 핵심 행동을 확인한다.
2. **대응하는 하위 참조 화면·부품·프로세스**를 지정한다([tines-mapping](docs/design/tines-mapping.md) · 아래 자산). 변경 기능의 팝업·탭·이미지·아이콘까지 대응시킨다.
3. 기존 셸·공통 부품·스킨을 쓴다. 페이지 `.root`에 브랜드 색·글꼴을 다시 선언하지 않는다. 학습자 값 변경은 기본 `tokens.css` 가 아니라 스킨에 둔다.
4. 진입 → 선택/입력 → 실행 → 결과와 메뉴·팝업·탭·빈 상태·실패·취소를 실제 기능으로 연결한다.
5. PC 1440/1280 라이트/다크에서 정상 렌더·키보드·넘침·팝업·경로 이동을 확인하고, 크기·간격은 측정값으로 설명한다.
6. 참조 URL·확보 날짜·대응 부품·전후 캡처·비교표·검사 결과·남은 차이를 기록한다. 로그인/오류/로딩 캡처는 정상 화면 증거가 아니다.

사용자가 이미 두 기준을 선택했다. 일반 구현마다 새 디자인 4안이나 재승인을 요구하지 않는다. 새 방향은 최신 사용자 지시가 이 파일을 바꾸는 근거가 된다.

## 확보 자산과 적용 위치

| 필요한 것 | 정본/부품 |
|---|---|
| PC 학습자 전수 목록·검증 상태 | [learner-tines-audit](docs/design/learner-tines-audit.md) · 계획 [learner-tines-plan](docs/design/learner-tines-plan.md) |
| Tines DOM·CSS·서체·색 | [computed](docs/design/refs/tines/computed-summary.md) · [css-authored](docs/design/refs/tines/css-authored-summary.md) · [font-lookalike](docs/design/refs/tines/font-lookalike.md) |
| Tines 페이지·이미지·템플릿 대응 | [tines-mapping](docs/design/tines-mapping.md) · [sections](docs/design/refs/tines/sections-summary.md) · [corpus](docs/design/refs/tines/corpus-summary.md) |
| Tines 버튼·폼·팝업·프로세스 | [ui-kit](docs/design/refs/tines/ui-kit-summary.md) · [components](docs/design/refs/tines/components-summary.md) · [interactions](docs/design/refs/tines/interactions-summary.md) |
| 3B 앱 색·서체·지도·팝업 | [reference-analysis](docs/design/reference-analysis.md) · [spec.json](docs/design/refs/3b/access-map/spec.json) · [측정 절차](docs/design/refs/3b/access-map/README.md) · [CAPTURE](docs/design/refs/3b/CAPTURE.md) |
| 구현 | `skins/tines.css`(+ 값 동기 `skins/tines.ts`, `skin-parity.test.ts`) · `components/marketing/site` · `components/marketing/sections` · `components/layout` · `components/ui` |
| 검증 절차 | [06-workflow](docs/design/06-workflow.md) · `scripts/design/style-gate.mjs` |
| 학습·운영 기능 | [LEARNING_MODEL](docs/LEARNING_MODEL.md) · [MODULES](docs/MODULES.md) · [ADMIN_CONSOLE](docs/ADMIN_CONSOLE.md) |

외부 원본 HTML/CSS·이미지·캡처는 로컬 분석용으로만 보관한다(커밋 금지). 쿠키·로그인 상태·사용자 데이터는 출력·커밋하지 않는다.
옛 판(주묵 판면 · 화면별 골격·서명 · 관리자 「정오표」)은 git 이력(`c3a03d168:DESIGN.md`)과 [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md)(과거 기록)에 있다.
